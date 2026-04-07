import fs from "node:fs";
import path from "node:path";

import YAML from "yaml";

import type { WorkProfile } from "@aifiction/schemas";

import { type SqliteClient, getSqliteClient, resolveWorkspaceRoot } from "../client";
import {
  SqliteKnowledgeMethodRepository,
  SqliteProjectCatalogRepository,
  SqliteSyncSourceRepository,
  type KnowledgeItemRecord,
  type SyncFileSourceRecord,
} from "../repositories/v2";
import { ensureSqliteV2Bootstrap } from "../v2/bootstrap";
import { NovelWorkbenchService, type WorkbenchProjectSnapshot, type WorkbenchReviewBundleSummary } from "../workbench";

interface WorkspaceBookIndexEntry {
  book_id: string;
  title: string;
  root_path?: string;
  book_file?: string;
  root_dir?: string;
  stage?: string;
  status?: string;
}

interface WorkspaceDefaults {
  chapter_file_pattern?: string;
  encoding?: string;
  auto_sync_after_finalize?: boolean;
  context_pack_dirname?: string;
  proposal_dirname?: string;
}

interface WorkspaceKnowledgeWorkflowActiveBudgetProtocol {
  global_rules?: number;
  book_rules?: number;
  batch_focus_findings?: number;
  total_book_rules?: number;
  total_validated_global_rules?: number;
}

interface WorkspaceKnowledgeWorkflowPromotionPolicyProtocol {
  book_only_after_hits?: number;
  validated_global_after_batch_hits?: number;
  validated_global_after_book_hits?: number;
}

interface WorkspaceExecutionPolicyPlanningFirstProtocol {
  require_full_volume_plan_before_drafting?: boolean;
  require_stage_map_before_batch_drafting?: boolean;
  require_current_batch_outline_before_drafting?: boolean;
}

interface WorkspaceExecutionPolicyVerificationProtocol {
  require_evidence_before_mark_done?: boolean;
  required_after_batch?: string[];
  required_before_claiming_completion?: string[];
}

interface WorkspaceExecutionPolicyRootCauseProtocol {
  require_issue_classification_before_rewrite?: boolean;
  default_categories?: string[];
}

interface WorkspaceExecutionPolicyProtocol {
  planning_first?: WorkspaceExecutionPolicyPlanningFirstProtocol;
  verification_before_completion?: WorkspaceExecutionPolicyVerificationProtocol;
  root_cause_first?: WorkspaceExecutionPolicyRootCauseProtocol;
}

export interface WorkspaceKnowledgeWorkflowProtocol {
  batch_size?: number;
  require_batch_review_before_next_batch?: boolean;
  auto_create_candidates_from_feedback?: boolean;
  opening_arc_review_points?: number[];
  phase_review_word_counts?: number[];
  active_budget?: WorkspaceKnowledgeWorkflowActiveBudgetProtocol;
  promotion_policy?: WorkspaceKnowledgeWorkflowPromotionPolicyProtocol;
  enabled_gates?: string[];
}

export interface WorkspaceProtocol {
  workspace_id: string;
  workspace_name: string;
  root_dir: string;
  books_dir?: string;
  active_book_id?: string;
  default_book_id?: string;
  book_index: WorkspaceBookIndexEntry[];
  defaults?: WorkspaceDefaults;
  knowledge_workflow?: WorkspaceKnowledgeWorkflowProtocol;
  execution_policy?: WorkspaceExecutionPolicyProtocol;
  task_routing?: Record<string, Record<string, unknown>>;
}

interface BookPathsProtocol {
  root_dir?: string;
  settings_dir?: string;
  outlines_dir?: string;
  chapters_dir?: string;
  artifacts_dir?: string;
}

interface BookSourceOfTruthProtocol {
  project_brief?: string;
  world_settings?: string;
  character_settings?: string;
  master_outline?: string;
  active_volume_outline?: string;
}

interface BookCurrentFocusProtocol {
  task_type?: string;
  task_label?: string;
  goal?: string;
  summary?: string;
}

interface BookLastOutputsProtocol {
  latest_chapter_file?: string;
  latest_summary_file?: string;
  latest_review_file?: string;
  latest_review_data_file?: string;
  latest_knowledge_candidates_file?: string;
  latest_sync_source?: string;
}

interface BookSyncProtocol {
  auto_sync_enabled?: boolean;
  root_source?: string;
  include_patterns?: string[];
  exclude_patterns?: string[];
}

interface BookProposalCommitProtocol {
  auto_commit_low_risk?: boolean;
  require_manual_commit_for?: string[];
}

export interface BookKnowledgeStateProtocol {
  inherit_workspace_workflow?: boolean;
  active_global_profile?: string;
  active_book_profile?: string;
  current_batch_id?: string;
  current_batch_review_required?: boolean;
  current_batch_review_status?: string;
  opening_arc_status?: string;
  next_required_review_at_chapter?: number;
  enabled_rule_sets?: string[];
}

interface BookExecutionControlsPlanningFirstProtocol {
  required_prewrite_sequence?: string[];
}

interface BookExecutionControlsVerificationProtocol {
  require_evidence_before_mark_done?: boolean;
  required_after_current_batch?: string[];
}

interface BookExecutionControlsRootCauseProtocol {
  require_issue_classification_before_rewrite?: boolean;
  allowed_rewrite_triggers?: string[];
}

interface BookExecutionControlsProtocol {
  planning_first?: BookExecutionControlsPlanningFirstProtocol;
  verification_before_completion?: BookExecutionControlsVerificationProtocol;
  root_cause_first?: BookExecutionControlsRootCauseProtocol;
}

export interface BookProtocol {
  book_id: string;
  title: string;
  genre?: string;
  platform?: string;
  stage?: string;
  status?: string;
  active_volume?: number;
  active_chapter?: number;
  paths?: BookPathsProtocol;
  source_of_truth?: BookSourceOfTruthProtocol;
  current_focus?: BookCurrentFocusProtocol;
  hard_constraints?: string[];
  execution_controls?: BookExecutionControlsProtocol;
  knowledge_state?: BookKnowledgeStateProtocol;
  last_outputs?: BookLastOutputsProtocol;
  sync?: BookSyncProtocol;
  proposal_commit?: BookProposalCommitProtocol;
}

export interface ProtocolContextPackSummary {
  kind: "writing-pack" | "risk-investigation-pack";
  label: string;
  absolutePath: string;
  displayPath: string;
  updatedAt: string;
}

export interface WorkProtocolSummary {
  workId: string;
  workSlug: string;
  workTitle: string;
  protocolStatus: "ready" | "needs-bootstrap" | "partial";
  workspaceFilePath: string;
  workspaceFileExists: boolean;
  bookFilePath: string;
  bookFileExists: boolean;
  workspace?: WorkspaceProtocol;
  book?: BookProtocol;
  bookRootPath: string;
  sourceRootPath?: string;
  linkedByWorkspace: boolean;
  missingReasons: string[];
  currentFocusLabel?: string;
  currentFocusGoal?: string;
  activeStage?: string;
  activeChapter?: number;
  activeVolume?: number;
  knowledgeWorkflow?: WorkspaceKnowledgeWorkflowProtocol;
  knowledgeState?: BookKnowledgeStateProtocol;
  currentBatchId?: string;
  currentBatchReviewRequired?: boolean;
  currentBatchReviewStatus?: string;
  activeGlobalProfile?: string;
  activeBookProfile?: string;
  nextRequiredReviewAtChapter?: number;
  enabledRuleSets: string[];
  enabledKnowledgeGates: string[];
  contextPackDirectoryPath: string;
  latestContextPacks: ProtocolContextPackSummary[];
}

export interface GeneratedProtocolPack {
  kind: "writing-pack" | "risk-investigation-pack";
  absolutePath: string;
  displayPath: string;
  updatedAt: string;
}

export interface GeneratedBatchReviewArtifact {
  kind: "batch-review";
  absolutePath: string;
  displayPath: string;
  jsonAbsolutePath: string;
  jsonDisplayPath: string;
  knowledgeCandidatesAbsolutePath: string;
  knowledgeCandidatesDisplayPath: string;
  updatedAt: string;
}

export interface BatchKnowledgePromotionDecision {
  knowledgeItemId: string;
  targetStatus: "book_only" | "validated_global" | "deprecated";
  applicationResult?: "helpful" | "neutral" | "harmful";
  note?: string;
}

export interface BatchKnowledgeGateDecision {
  gateCode: string;
  gateStatus: "passed" | "blocked" | "waived";
  note?: string;
}

export interface ResolveBatchKnowledgeInput {
  promotions?: BatchKnowledgePromotionDecision[];
  gateResults?: BatchKnowledgeGateDecision[];
}

export interface ResolvedBatchKnowledgeSummary {
  batchId: string;
  promotedCount: number;
  boundBookRuleCount: number;
  boundGlobalRuleCount: number;
  updatedApplicationCount: number;
  resolvedGateCount: number;
  reviewStatus: string;
}

interface BatchReviewChapterRecord {
  order: number;
  title: string;
  summary: string;
}

interface BatchReviewFindingRecord {
  id: string;
  title: string;
  summary: string;
  blockingLevel: string;
  riskNature: string;
  sourcePath?: string;
  sourceDocumentId?: string;
  riskReasons: string[];
}

interface BatchReviewArtifactData {
  artifactKind: "batch-review";
  generatedAt: string;
  workId: string;
  workSlug: string;
  workTitle: string;
  batchId?: string;
  stage?: string;
  focusLabel?: string;
  reviewRequired: boolean;
  reviewStatus?: string;
  nextRequiredReviewAtChapter?: number;
  activeGlobalProfile?: string;
  activeBookProfile?: string;
  enabledRuleSets: string[];
  enabledGates: string[];
  recentChapters: BatchReviewChapterRecord[];
  findings: BatchReviewFindingRecord[];
  candidatePrompts: string[];
  nextActions: string[];
}

interface KnowledgeCandidateRecord {
  id: string;
  status: "candidate";
  suggestedScope: "pending";
  sourceKind: "batch-review";
  domain: string;
  priority: string;
  title: string;
  summary: string;
  rationale: string;
  prompt: string;
  suggestedRuleSets: string[];
  sourceFindingIds: string[];
  evidencePaths: string[];
}

interface KnowledgeCandidatesArtifactData {
  artifactKind: "knowledge-candidates";
  generatedAt: string;
  workId: string;
  workSlug: string;
  workTitle: string;
  batchId?: string;
  sourceReviewJsonPath: string;
  candidates: KnowledgeCandidateRecord[];
}

interface WritingPackGateStatusRecord {
  gateCode: string;
  gateStatus: string;
  note?: string;
}

export class WorkspaceProtocolService {
  private readonly workspaceRoot: string;
  private readonly knowledgeMethodRepository: SqliteKnowledgeMethodRepository;
  private readonly projectCatalogRepository: SqliteProjectCatalogRepository;
  private readonly syncSourceRepository: SqliteSyncSourceRepository;
  private readonly workbenchService: NovelWorkbenchService;

  constructor(private readonly client: SqliteClient = getSqliteClient()) {
    this.workspaceRoot = resolveWorkspaceRoot();
    this.knowledgeMethodRepository = new SqliteKnowledgeMethodRepository(client);
    this.projectCatalogRepository = new SqliteProjectCatalogRepository(client);
    this.syncSourceRepository = new SqliteSyncSourceRepository(client);
    this.workbenchService = new NovelWorkbenchService(client);
  }

  async getWorkProtocolSummaryBySlug(workSlug: string): Promise<WorkProtocolSummary | null> {
    await ensureSqliteV2Bootstrap(this.client);

    const work = await this.projectCatalogRepository.getProjectBySlug(workSlug);
    if (!work) {
      return null;
    }

    const fileSources = await this.syncSourceRepository.listFileSources(work.id);
    const primarySource = this.pickPrimaryFileSource(fileSources);
    const workspaceFilePath = path.join(this.workspaceRoot, "workspace.yml");
    const workspace = this.loadWorkspaceProtocol(workspaceFilePath);
    const workspaceEntry = this.findWorkspaceEntry(workspace, work, primarySource);
    const bookRootPath = this.resolveBookRootPath(work, primarySource, workspaceEntry);
    const bookFilePath = this.resolveBookFilePath(bookRootPath, workspaceEntry);
    const book = this.loadBookProtocol(bookFilePath);
    const latestContextPacks = this.listLatestContextPacks(this.resolveContextPackDirectory(bookRootPath, workspace, book));
    const missingReasons: string[] = [];

    if (!fs.existsSync(workspaceFilePath)) {
      missingReasons.push("工作区协议文件还没有初始化。");
    }
    if (!workspaceEntry) {
      missingReasons.push("这本书还没有写进 workspace.yml 的 book_index。");
    }
    if (!fs.existsSync(bookFilePath)) {
      missingReasons.push("当前作品还没有 book.yml，智能体无法直接按协议取上下文。");
    }
    if (!primarySource) {
      missingReasons.push("这本书还没有绑定正文目录，暂时无法自动对齐本地稿件。");
    }

    return {
      workId: work.id,
      workSlug: work.slug,
      workTitle: work.title,
      protocolStatus:
        missingReasons.length === 0
          ? "ready"
          : fs.existsSync(bookFilePath) || fs.existsSync(workspaceFilePath)
            ? "partial"
            : "needs-bootstrap",
      workspaceFilePath,
      workspaceFileExists: fs.existsSync(workspaceFilePath),
      bookFilePath,
      bookFileExists: fs.existsSync(bookFilePath),
      workspace,
      book,
      bookRootPath,
      sourceRootPath: primarySource?.rootPath,
      linkedByWorkspace: Boolean(workspaceEntry),
      missingReasons,
      currentFocusLabel: this.readString(book?.current_focus?.task_label),
      currentFocusGoal: this.readString(book?.current_focus?.goal),
      activeStage: this.readString(book?.stage) ?? work.status,
      activeChapter: this.readNumber(book?.active_chapter),
      activeVolume: this.readNumber(book?.active_volume),
      knowledgeWorkflow: workspace?.knowledge_workflow,
      knowledgeState: book?.knowledge_state,
      currentBatchId: this.readString(book?.knowledge_state?.current_batch_id),
      currentBatchReviewRequired: this.readBoolean(book?.knowledge_state?.current_batch_review_required),
      currentBatchReviewStatus: this.readString(book?.knowledge_state?.current_batch_review_status),
      activeGlobalProfile: this.readString(book?.knowledge_state?.active_global_profile),
      activeBookProfile: this.readString(book?.knowledge_state?.active_book_profile),
      nextRequiredReviewAtChapter: this.readNumber(book?.knowledge_state?.next_required_review_at_chapter),
      enabledRuleSets: this.readStringArray(book?.knowledge_state?.enabled_rule_sets),
      enabledKnowledgeGates: this.readStringArray(workspace?.knowledge_workflow?.enabled_gates),
      contextPackDirectoryPath: this.resolveContextPackDirectory(bookRootPath, workspace, book),
      latestContextPacks,
    };
  }

  async bootstrapWorkProtocolBySlug(workSlug: string): Promise<WorkProtocolSummary | null> {
    const summary = await this.getWorkProtocolSummaryBySlug(workSlug);
    if (!summary) {
      return null;
    }

    const snapshot = await this.workbenchService.getProjectSnapshotBySlug(workSlug);
    if (!snapshot) {
      return null;
    }

    const workspaceProtocol = this.buildNextWorkspaceProtocol(summary, snapshot);
    const bookProtocol = this.buildBookProtocol(summary, snapshot);

    fs.mkdirSync(path.dirname(summary.workspaceFilePath), { recursive: true });
    fs.writeFileSync(summary.workspaceFilePath, YAML.stringify(workspaceProtocol), "utf8");

    fs.mkdirSync(summary.bookRootPath, { recursive: true });
    fs.writeFileSync(summary.bookFilePath, YAML.stringify(bookProtocol), "utf8");

    return this.getWorkProtocolSummaryBySlug(workSlug);
  }

  async generateWritingPackBySlug(workSlug: string): Promise<GeneratedProtocolPack> {
    const summary = await this.requireReadyProtocol(workSlug);
    const snapshot = await this.workbenchService.getProjectSnapshotBySlug(workSlug);

    if (!snapshot) {
      throw new Error("找不到对应作品，无法生成写作包。");
    }

    const book = summary.book!;
    const knowledgeItems = await this.loadKnowledgeItemsForWritingPack(summary, snapshot.work.id, book);
    const gateStatuses = await this.loadWritingPackGateStatuses(summary, snapshot.work.id, book);
    const content = this.buildWritingPackMarkdown(summary, snapshot, book, knowledgeItems, gateStatuses);
    const pack = this.writeContextPack(summary, "writing-pack", content);
    await this.persistKnowledgeApplications(summary, snapshot.work.id, book, knowledgeItems, "writing-pack");
    return pack;
  }

  async generateRiskInvestigationPackBySlug(workSlug: string, bundleId?: string): Promise<GeneratedProtocolPack> {
    const summary = await this.requireReadyProtocol(workSlug);
    const snapshot = await this.workbenchService.getProjectSnapshotBySlug(workSlug);

    if (!snapshot) {
      throw new Error("找不到对应作品，无法生成风险排查包。");
    }

    const bundle = this.pickRiskBundle(snapshot, bundleId);
    if (!bundle) {
      throw new Error("当前没有可生成排查包的风险项。");
    }

    const content = this.buildRiskInvestigationPackMarkdown(summary, snapshot, bundle);
    return this.writeContextPack(summary, "risk-investigation-pack", content);
  }

  async generateBatchReviewBySlug(workSlug: string): Promise<GeneratedBatchReviewArtifact> {
    const summary = await this.requireReadyProtocol(workSlug);
    const snapshot = await this.workbenchService.getProjectSnapshotBySlug(workSlug);

    if (!snapshot) {
      throw new Error("找不到对应作品，无法生成当前批次复盘单。");
    }

    const book = summary.book!;
    const artifactData = this.buildBatchReviewArtifactData(summary, snapshot, book);
    const candidatesData = this.buildKnowledgeCandidatesArtifactData(
      artifactData,
      path.join(summary.bookRootPath, "03-中间产物", "latest-review.json"),
    );
    const content = this.buildBatchReviewMarkdownFromData(artifactData);
    const artifact = this.writeBatchReviewArtifact(summary, book, content, artifactData, candidatesData);
    await this.persistBatchKnowledge(summary, artifactData, candidatesData, artifact);
    await this.persistKnowledgeGates(summary, artifactData, book);
    this.persistGeneratedBatchReviewState(summary, book, artifact);
    return artifact;
  }

  async resolveBatchKnowledgeBySlug(
    workSlug: string,
    input: ResolveBatchKnowledgeInput = {},
  ): Promise<ResolvedBatchKnowledgeSummary> {
    const summary = await this.requireReadyProtocol(workSlug);
    const snapshot = await this.workbenchService.getProjectSnapshotBySlug(workSlug);

    if (!snapshot) {
      throw new Error("找不到对应作品，无法完成当前批次知识回写。");
    }

    const book = summary.book!;
    const batchId = this.readString(book.knowledge_state?.current_batch_id);
    if (!batchId) {
      throw new Error("当前作品还没有 batch id，无法回写批次知识结果。");
    }

    const batchItems = await this.knowledgeMethodRepository.listBatchKnowledgeItems(batchId);
    const candidateItems = batchItems.filter((item) => item.status === "candidate");
    const profileSet = await this.knowledgeMethodRepository.ensureKnowledgeProfiles({
      projectId: snapshot.work.id,
      globalProfileKey: this.readString(book.knowledge_state?.active_global_profile),
      bookProfileKey: this.readString(book.knowledge_state?.active_book_profile),
    });

    const normalizedPromotions = this.normalizeBatchKnowledgePromotions(candidateItems, input.promotions);
    const gateResults = this.normalizeBatchKnowledgeGateResults(summary.enabledKnowledgeGates, input.gateResults);

    await this.knowledgeMethodRepository.promoteKnowledgeItems({
      decisions: normalizedPromotions.map((promotion) => ({
        knowledgeItemId: promotion.knowledgeItemId,
        nextStatus: promotion.targetStatus,
        nextScope: this.mapKnowledgePromotionStatusToScope(promotion.targetStatus),
        incrementValidationCount: promotion.targetStatus === "deprecated" ? 0 : 1,
        note: promotion.note,
      })),
    });

    const bindings = normalizedPromotions.flatMap((promotion) => {
      if (promotion.targetStatus === "validated_global" && profileSet.globalProfile) {
        return [
          {
            profileId: profileSet.globalProfile.id,
            knowledgeItemId: promotion.knowledgeItemId,
            bindingStatus: "active",
            bindingReason: promotion.note ?? "Promoted from batch review into active global profile.",
          },
        ];
      }
      if (promotion.targetStatus === "book_only" && profileSet.bookProfile) {
        return [
          {
            profileId: profileSet.bookProfile.id,
            knowledgeItemId: promotion.knowledgeItemId,
            bindingStatus: "active",
            bindingReason: promotion.note ?? "Promoted from batch review into active book profile.",
          },
        ];
      }
      return [];
    });

    await this.knowledgeMethodRepository.bindKnowledgeProfileRules({ bindings });
    await this.knowledgeMethodRepository.updateKnowledgeApplicationResults({
      projectId: snapshot.work.id,
      batchId,
      results: normalizedPromotions.map((promotion) => ({
        knowledgeItemId: promotion.knowledgeItemId,
        packKind: "writing-pack",
        applicationResult: promotion.applicationResult ?? this.defaultApplicationResultForPromotion(promotion.targetStatus),
        note: promotion.note,
      })),
    });
    await this.knowledgeMethodRepository.replaceKnowledgeGates({
      projectId: snapshot.work.id,
      batchId,
      gates: gateResults.map((gate) => ({
        gateCode: gate.gateCode,
        gateStatus: gate.gateStatus,
        note: gate.note,
      })),
    });

    this.persistResolvedBatchReviewState(summary, book);

    return {
      batchId,
      promotedCount: normalizedPromotions.length,
      boundBookRuleCount: bindings.filter((binding) => binding.profileId === profileSet.bookProfile?.id).length,
      boundGlobalRuleCount: bindings.filter((binding) => binding.profileId === profileSet.globalProfile?.id).length,
      updatedApplicationCount: normalizedPromotions.length,
      resolvedGateCount: gateResults.length,
      reviewStatus: "resolved",
    };
  }

  private async requireReadyProtocol(workSlug: string): Promise<WorkProtocolSummary> {
    const summary = await this.getWorkProtocolSummaryBySlug(workSlug);
    if (!summary) {
      throw new Error("找不到对应作品。");
    }
    if (summary.protocolStatus === "needs-bootstrap" || !summary.book) {
      throw new Error("请先初始化这本书的协议文件，再生成上下文包。");
    }
    return summary;
  }

  private loadWorkspaceProtocol(filePath: string): WorkspaceProtocol | undefined {
    if (!fs.existsSync(filePath)) {
      return undefined;
    }

    if (fs.statSync(filePath).isDirectory()) {
      return undefined;
    }

    const raw = fs.readFileSync(filePath, "utf8");
    return YAML.parse(raw) as WorkspaceProtocol | undefined;
  }

  private loadBookProtocol(filePath: string): BookProtocol | undefined {
    if (!fs.existsSync(filePath)) {
      return undefined;
    }

    if (fs.statSync(filePath).isDirectory()) {
      return undefined;
    }

    const raw = fs.readFileSync(filePath, "utf8");
    return YAML.parse(raw) as BookProtocol | undefined;
  }

  private findWorkspaceEntry(
    workspace: WorkspaceProtocol | undefined,
    work: WorkProfile,
    primarySource?: SyncFileSourceRecord,
  ): WorkspaceBookIndexEntry | undefined {
    const entries = workspace?.book_index ?? [];
    if (!entries.length) {
      return undefined;
    }

    return entries.find((entry) => {
      if (entry.book_id === work.slug || entry.book_id === work.id) {
        return true;
      }
      if (entry.title === work.title) {
        return true;
      }
      if (primarySource) {
        const resolvedRootPath = this.resolveWorkspaceEntryRootPath(entry);
        return this.normalizePath(resolvedRootPath) === this.normalizePath(primarySource.rootPath);
      }
      return false;
    });
  }

  private pickPrimaryFileSource(fileSources: SyncFileSourceRecord[]): SyncFileSourceRecord | undefined {
    return fileSources.find((fileSource) => fileSource.isActive) ?? fileSources[0];
  }

  private resolveBookRootPath(
    work: WorkProfile,
    primarySource: SyncFileSourceRecord | undefined,
    workspaceEntry: WorkspaceBookIndexEntry | undefined,
  ): string {
    if (workspaceEntry) {
      return this.resolveWorkspaceEntryRootPath(workspaceEntry);
    }
    if (primarySource?.rootPath) {
      return primarySource.rootPath;
    }
    return path.join(this.workspaceRoot, "books", work.slug);
  }

  private resolveBookFilePath(bookRootPath: string, workspaceEntry: WorkspaceBookIndexEntry | undefined): string {
    const configuredBookFile = this.readString(workspaceEntry?.book_file);
    if (configuredBookFile) {
      return this.resolveWorkspaceLinkedPath(configuredBookFile);
    }

    return path.join(bookRootPath, "book.yml");
  }

  private resolveWorkspaceEntryRootPath(entry: WorkspaceBookIndexEntry): string {
    const configuredRoot = this.readString(entry.root_path) ?? this.readString(entry.root_dir);
    if (configuredRoot) {
      return this.resolveWorkspaceLinkedPath(configuredRoot);
    }

    return this.workspaceRoot;
  }

  private resolveWorkspaceLinkedPath(linkedPath: string): string {
    if (!linkedPath) {
      return this.workspaceRoot;
    }
    return path.isAbsolute(linkedPath)
      ? path.normalize(linkedPath)
      : path.normalize(path.join(this.workspaceRoot, linkedPath));
  }

  private resolveContextPackDirectory(
    bookRootPath: string,
    workspace: WorkspaceProtocol | undefined,
    book: BookProtocol | undefined,
  ): string {
    const workspaceDir = this.readString(workspace?.defaults?.context_pack_dirname);
    if (workspaceDir) {
      return path.join(bookRootPath, workspaceDir);
    }

    const artifactsDir = this.readString(book?.paths?.artifacts_dir);
    if (artifactsDir) {
      return path.join(bookRootPath, artifactsDir, "context-packs");
    }

    return path.join(bookRootPath, "03-中间产物", "context-packs");
  }

  private listLatestContextPacks(directoryPath: string): ProtocolContextPackSummary[] {
    if (!fs.existsSync(directoryPath)) {
      return [];
    }

    const candidates = fs
      .readdirSync(directoryPath)
      .filter((fileName) => fileName.endsWith(".latest.md"))
      .map((fileName) => {
        const absolutePath = path.join(directoryPath, fileName);
        const stats = fs.statSync(absolutePath);
        const kind = fileName.startsWith("risk-investigation-pack")
          ? "risk-investigation-pack"
          : "writing-pack";

        return {
          kind,
          label: kind === "writing-pack" ? "当前写作包" : "当前风险排查包",
          absolutePath,
          displayPath: this.toDisplayPath(absolutePath),
          updatedAt: stats.mtime.toISOString(),
        } satisfies ProtocolContextPackSummary;
      })
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt, "zh-CN"));

    return candidates;
  }

  private buildNextWorkspaceProtocol(
    summary: WorkProtocolSummary,
    snapshot: WorkbenchProjectSnapshot,
  ): WorkspaceProtocol {
    const current = summary.workspace;
    const currentEntryIndex = current?.book_index.findIndex((entry) => entry.book_id === snapshot.work.slug) ?? -1;
    const nextEntry: WorkspaceBookIndexEntry = {
      book_id: snapshot.work.slug,
      title: snapshot.work.title,
      root_path: this.toWorkspaceLinkedPath(summary.bookRootPath),
      book_file: this.toWorkspaceLinkedPath(summary.bookFilePath),
      stage: summary.activeStage ?? snapshot.work.status,
      status: snapshot.work.status,
    };

    const nextBookIndex = [...(current?.book_index ?? [])];
    if (currentEntryIndex >= 0) {
      nextBookIndex[currentEntryIndex] = nextEntry;
    } else {
      nextBookIndex.push(nextEntry);
    }

    return {
      workspace_id: current?.workspace_id ?? "aifiction-workspace",
      workspace_name: current?.workspace_name ?? "AiFiction 工作区",
      root_dir: current?.root_dir ?? this.toDisplayPath(this.workspaceRoot),
      books_dir: current?.books_dir ?? "books",
      active_book_id: snapshot.work.slug,
      default_book_id: current?.default_book_id ?? snapshot.work.slug,
      book_index: nextBookIndex,
      defaults: {
        chapter_file_pattern: current?.defaults?.chapter_file_pattern ?? "{index:04d}-{title}.md",
        encoding: current?.defaults?.encoding ?? "utf-8",
        auto_sync_after_finalize: current?.defaults?.auto_sync_after_finalize ?? true,
        context_pack_dirname: current?.defaults?.context_pack_dirname ?? "03-中间产物/context-packs",
        proposal_dirname: current?.defaults?.proposal_dirname ?? "03-中间产物/proposals",
      },
      knowledge_workflow: {
        batch_size: current?.knowledge_workflow?.batch_size ?? 10,
        require_batch_review_before_next_batch: current?.knowledge_workflow?.require_batch_review_before_next_batch ?? true,
        auto_create_candidates_from_feedback: current?.knowledge_workflow?.auto_create_candidates_from_feedback ?? true,
        opening_arc_review_points:
          current?.knowledge_workflow?.opening_arc_review_points?.length
            ? current.knowledge_workflow.opening_arc_review_points
            : [3, 5, 10],
        phase_review_word_counts:
          current?.knowledge_workflow?.phase_review_word_counts?.length
            ? current.knowledge_workflow.phase_review_word_counts
            : [30000, 50000],
        active_budget: {
          global_rules: current?.knowledge_workflow?.active_budget?.global_rules ?? 12,
          book_rules: current?.knowledge_workflow?.active_budget?.book_rules ?? 12,
          batch_focus_findings: current?.knowledge_workflow?.active_budget?.batch_focus_findings ?? 5,
          total_book_rules: current?.knowledge_workflow?.active_budget?.total_book_rules ?? 20,
          total_validated_global_rules: current?.knowledge_workflow?.active_budget?.total_validated_global_rules ?? 30,
        },
        promotion_policy: {
          book_only_after_hits: current?.knowledge_workflow?.promotion_policy?.book_only_after_hits ?? 2,
          validated_global_after_batch_hits:
            current?.knowledge_workflow?.promotion_policy?.validated_global_after_batch_hits ?? 3,
          validated_global_after_book_hits:
            current?.knowledge_workflow?.promotion_policy?.validated_global_after_book_hits ?? 2,
        },
        enabled_gates:
          current?.knowledge_workflow?.enabled_gates?.length
            ? current.knowledge_workflow.enabled_gates
            : ["batch-review-required", "meta-language-check", "continuity-review", "anchoring-review", "opening-arc-review"],
      },
      execution_policy: {
        planning_first: {
          require_full_volume_plan_before_drafting:
            current?.execution_policy?.planning_first?.require_full_volume_plan_before_drafting ?? true,
          require_stage_map_before_batch_drafting:
            current?.execution_policy?.planning_first?.require_stage_map_before_batch_drafting ?? true,
          require_current_batch_outline_before_drafting:
            current?.execution_policy?.planning_first?.require_current_batch_outline_before_drafting ?? true,
        },
        verification_before_completion: {
          require_evidence_before_mark_done:
            current?.execution_policy?.verification_before_completion?.require_evidence_before_mark_done ?? true,
          required_after_batch:
            current?.execution_policy?.verification_before_completion?.required_after_batch?.length
              ? current.execution_policy.verification_before_completion.required_after_batch
              : ["writing:meta-check", "writing:budget-check"],
          required_before_claiming_completion:
            current?.execution_policy?.verification_before_completion?.required_before_claiming_completion?.length
              ? current.execution_policy.verification_before_completion.required_before_claiming_completion
              : ["encoding:check", "db:protocol-smoke"],
        },
        root_cause_first: {
          require_issue_classification_before_rewrite:
            current?.execution_policy?.root_cause_first?.require_issue_classification_before_rewrite ?? true,
          default_categories:
            current?.execution_policy?.root_cause_first?.default_categories?.length
              ? current.execution_policy.root_cause_first.default_categories
              : ["planning-gap", "continuity-gap", "anchor-gap", "knowledge-layer-gap", "exposition-gap", "pacing-gap", "volume-budget-gap", "execution-bug"],
        },
      },
      task_routing: current?.task_routing ?? {
        create_book: {
          trigger_examples: ["我想写一本都市悬疑", "新建一本玄幻复仇文"],
          default_stage: "planning",
        },
        continue_book: {
          trigger_examples: ["继续写这本书", "继续写当前作品"],
          use_active_book: true,
        },
        write_chapter: {
          trigger_examples: ["从第 12 章开始写", "继续写第 25 章"],
          required_context_pack: "writing-pack",
        },
        investigate_risk: {
          trigger_examples: ["处理这个风险", "看看这个冲突怎么改"],
          required_context_pack: "risk-investigation-pack",
        },
      },
    };
  }

  private buildBookProtocol(
    summary: WorkProtocolSummary,
    snapshot: WorkbenchProjectSnapshot,
  ): BookProtocol {
    const existing = summary.book;
    const fileSource = snapshot.fileSources[0];
    const chapterDir = this.resolveRelativeDirectory(summary.bookRootPath, fileSource?.chapterPath, "02-正文");
    const outlineDir = this.resolveRelativeDirectory(summary.bookRootPath, fileSource?.outlinePath, "01-大纲");
    const settingsDir = existing?.paths?.settings_dir ?? "00-设定";
    const latestDocumentPath = fileSource?.latestDocumentPath ?? existing?.last_outputs?.latest_chapter_file;
    const latestChapter = snapshot.latestChapter;
    const resolvedActiveVolume = latestChapter?.volumeId
      ? snapshot.volumes.find((volume) => volume.id === latestChapter.volumeId)?.order
      : undefined;
    const activeVolume = existing?.active_volume ?? resolvedActiveVolume ?? 1;
    const activeChapter = existing?.active_chapter ?? latestChapter?.order ?? 1;
    const batchSize = summary.workspace?.knowledge_workflow?.batch_size ?? 10;
    const defaultBatchId = this.createDefaultBatchId(activeVolume, activeChapter, batchSize);

    return {
      book_id: snapshot.work.slug,
      title: snapshot.work.title,
      genre: snapshot.work.genre,
      platform: snapshot.work.targetPlatform,
      stage: existing?.stage ?? (snapshot.work.status === "planning" ? "planning" : "drafting"),
      status: snapshot.work.status,
      active_volume: activeVolume,
      active_chapter: activeChapter,
      paths: {
        root_dir: ".",
        settings_dir: settingsDir,
        outlines_dir: outlineDir,
        chapters_dir: chapterDir,
        artifacts_dir: existing?.paths?.artifacts_dir ?? "03-中间产物",
      },
      source_of_truth: {
        project_brief: existing?.source_of_truth?.project_brief ?? `${settingsDir}/作品定位.md`,
        world_settings: existing?.source_of_truth?.world_settings ?? `${settingsDir}/世界设定.md`,
        character_settings: existing?.source_of_truth?.character_settings ?? `${settingsDir}/角色设定.md`,
        master_outline: existing?.source_of_truth?.master_outline ?? `${outlineDir}/全书大纲.md`,
        active_volume_outline: existing?.source_of_truth?.active_volume_outline ?? `${outlineDir}/卷一大纲.md`,
      },
      current_focus: {
        task_type: existing?.current_focus?.task_type ?? "write_chapter",
        task_label: existing?.current_focus?.task_label ?? `写第 ${Math.max((latestChapter?.order ?? 0) + 1, 1)} 章`,
        goal: existing?.current_focus?.goal ?? snapshot.work.tagline,
        summary: existing?.current_focus?.summary ?? "继续推进当前主线，确保结构化事实与正文同步。",
      },
      hard_constraints: existing?.hard_constraints?.length ? existing.hard_constraints : snapshot.work.hardConstraints,
      execution_controls: {
        planning_first: {
          required_prewrite_sequence:
            existing?.execution_controls?.planning_first?.required_prewrite_sequence?.length
              ? existing.execution_controls.planning_first.required_prewrite_sequence
              : ["full-volume-plan", "stage-map", "chapter-function-mix", "transition-and-daily-slots", "current-batch-outline"],
        },
        verification_before_completion: {
          require_evidence_before_mark_done:
            existing?.execution_controls?.verification_before_completion?.require_evidence_before_mark_done ?? true,
          required_after_current_batch:
            existing?.execution_controls?.verification_before_completion?.required_after_current_batch?.length
              ? existing.execution_controls.verification_before_completion.required_after_current_batch
              : ["writing:meta-check", "writing:budget-check"],
        },
        root_cause_first: {
          require_issue_classification_before_rewrite:
            existing?.execution_controls?.root_cause_first?.require_issue_classification_before_rewrite ?? true,
          allowed_rewrite_triggers:
            existing?.execution_controls?.root_cause_first?.allowed_rewrite_triggers?.length
              ? existing.execution_controls.root_cause_first.allowed_rewrite_triggers
              : ["planning-gap", "continuity-gap", "anchor-gap", "knowledge-layer-gap", "exposition-gap", "pacing-gap", "volume-budget-gap", "execution-bug"],
        },
      },
      knowledge_state: {
        inherit_workspace_workflow: existing?.knowledge_state?.inherit_workspace_workflow ?? true,
        active_global_profile: existing?.knowledge_state?.active_global_profile ?? "default-global",
        active_book_profile: existing?.knowledge_state?.active_book_profile ?? `${snapshot.work.slug}-opening`,
        current_batch_id: existing?.knowledge_state?.current_batch_id ?? defaultBatchId,
        current_batch_review_required: existing?.knowledge_state?.current_batch_review_required ?? false,
        current_batch_review_status: existing?.knowledge_state?.current_batch_review_status ?? "not-started",
        opening_arc_status:
          existing?.knowledge_state?.opening_arc_status ?? (activeChapter >= 10 ? "completed" : "in-progress"),
        next_required_review_at_chapter:
          existing?.knowledge_state?.next_required_review_at_chapter ??
          this.computeNextRequiredReviewAtChapter(activeChapter, batchSize),
        enabled_rule_sets:
          existing?.knowledge_state?.enabled_rule_sets?.length
            ? existing.knowledge_state.enabled_rule_sets
            : ["continuity", "opening-arc", "anchoring", "exposition", "pacing"],
      },
      last_outputs: {
        latest_chapter_file: existing?.last_outputs?.latest_chapter_file ?? latestDocumentPath,
        latest_summary_file: existing?.last_outputs?.latest_summary_file ?? "03-中间产物/latest-summary.md",
        latest_review_file: existing?.last_outputs?.latest_review_file ?? "03-中间产物/latest-review.md",
        latest_review_data_file: existing?.last_outputs?.latest_review_data_file ?? "03-中间产物/latest-review.json",
        latest_knowledge_candidates_file:
          existing?.last_outputs?.latest_knowledge_candidates_file ?? "03-中间产物/latest-knowledge-candidates.json",
        latest_sync_source: existing?.last_outputs?.latest_sync_source ?? latestDocumentPath,
      },
      sync: {
        auto_sync_enabled: existing?.sync?.auto_sync_enabled ?? true,
        root_source: existing?.sync?.root_source ?? chapterDir,
        include_patterns: existing?.sync?.include_patterns?.length ? existing.sync.include_patterns : ["*.md", "*.txt"],
        exclude_patterns: existing?.sync?.exclude_patterns?.length ? existing.sync.exclude_patterns : [".git/**", "node_modules/**", "dist/**"],
      },
      proposal_commit: {
        auto_commit_low_risk: existing?.proposal_commit?.auto_commit_low_risk ?? true,
        require_manual_commit_for: existing?.proposal_commit?.require_manual_commit_for?.length
          ? existing.proposal_commit.require_manual_commit_for
          : ["factual-conflict", "timeline-conflict", "major-relationship-shift", "rule-break"],
      },
    };
  }

  private buildWritingPackMarkdown(
    summary: WorkProtocolSummary,
    snapshot: WorkbenchProjectSnapshot,
    book: BookProtocol,
    knowledgeItems: KnowledgeItemRecord[],
    gateStatuses: WritingPackGateStatusRecord[],
  ): string {
    const recentChapters = [...snapshot.chapters].slice(-3).reverse();
    const recentCharacters = snapshot.characters.slice(0, 5);
    const relevantGenericEntities = snapshot.genericEntities.slice(0, 8);
    const relevantTagTaxonomies = snapshot.tagTaxonomies.slice(0, 5);
    const relevantTaskTemplates = snapshot.taskTemplates.slice(0, 5);
    const sourceOfTruth = book.source_of_truth ?? {};
    const hardConstraints = book.hard_constraints ?? [];
    const knowledgeWorkflow = summary.knowledgeWorkflow;
    const knowledgeState = book.knowledge_state;
    const enabledRuleSets = this.readStringArray(knowledgeState?.enabled_rule_sets);
    const enabledGates = this.readStringArray(knowledgeWorkflow?.enabled_gates);
    const currentBatchReviewRequired = this.readBoolean(knowledgeState?.current_batch_review_required);
    const currentBatchReviewStatus = this.readString(knowledgeState?.current_batch_review_status);
    const nextRequiredReviewAtChapter = this.readNumber(knowledgeState?.next_required_review_at_chapter);
    const activeKnowledgeItems = knowledgeItems.slice(0, knowledgeWorkflow?.active_budget?.batch_focus_findings ?? 5);
    const writingGateAssessment = this.assessWritingPackGateState(summary, book, gateStatuses);
    const gateLines = gateStatuses.length
      ? gateStatuses.map((gate) => `- ${gate.gateCode}：${gate.gateStatus}${gate.note ? `（${gate.note}）` : ""}`)
      : ["- 当前没有可用的 gate 状态。"];

    const lines = [
      `# 写作包：${snapshot.work.title}`,
      "",
      `- 生成时间：${new Date().toISOString()}`,
      `- 当前阶段：${book.stage ?? snapshot.work.status}`,
      `- 当前焦点：${book.current_focus?.task_label ?? "待补当前任务"}`,
      `- 目标：${book.current_focus?.goal ?? snapshot.work.tagline}`,
      `- 当前用途：${writingGateAssessment.mode}`,
      `- 当前是否允许继续正文：${writingGateAssessment.canDraft ? "是" : "否"}`,
      "",
      "## 关键锚点",
      `- 协议文件：${this.toDisplayPath(summary.bookFilePath)}`,
      `- 作品目录：${this.toDisplayPath(summary.bookRootPath)}`,
      `- 作品定位：${sourceOfTruth.project_brief ?? "待补"}`,
      `- 世界设定：${sourceOfTruth.world_settings ?? "待补"}`,
      `- 角色设定：${sourceOfTruth.character_settings ?? "待补"}`,
      `- 全书大纲：${sourceOfTruth.master_outline ?? "待补"}`,
      `- 当前卷纲：${sourceOfTruth.active_volume_outline ?? "待补"}`,
      "",
      "## 必须遵守的硬约束",
      ...(hardConstraints.length ? hardConstraints.map((item) => `- ${item}`) : ["- 当前还没有写入硬约束，请先确认作品定位。"]),
      "",
      "## 知识流程与当前关卡",
      `- 全局 profile：${this.readString(knowledgeState?.active_global_profile) ?? "未设置"}`,
      `- 本书 profile：${this.readString(knowledgeState?.active_book_profile) ?? "未设置"}`,
      `- 当前 batch：${this.readString(knowledgeState?.current_batch_id) ?? "未设置"}`,
      `- batch 大小：${this.readNumber(knowledgeWorkflow?.batch_size) ?? 10} 章`,
      `- 当前 batch 是否必须复盘：${currentBatchReviewRequired ? "是" : "否"}`,
      `- 复盘状态：${currentBatchReviewStatus ?? "未设置"}`,
      `- 下一个必复盘章节节点：${nextRequiredReviewAtChapter ?? "未设置"}`,
      ...(enabledRuleSets.length ? [`- 启用规则集：${enabledRuleSets.join(" / ")}`] : ["- 当前没有启用规则集。"]),
      ...(enabledGates.length ? [`- 启用 gate：${enabledGates.join(" / ")}`] : ["- 当前没有启用 gate。"]),
      "",
      "## gate 状态",
      ...gateLines,
      "",
      "## 当前阻断原因",
      ...(writingGateAssessment.blockers.length
        ? writingGateAssessment.blockers.map((item) => `- ${item}`)
        : ["- 当前没有阻断项，可以继续按当前批次章纲推进正文。"]),
      "",
      "## 最近章节摘要",
      ...(recentChapters.length
        ? recentChapters.map((chapter) => `- 第 ${chapter.order} 章《${chapter.title}》：${chapter.summary}`)
        : ["- 当前还没有章节摘要。"]),
      "",
      "## 当前重点角色",
      ...(recentCharacters.length
        ? recentCharacters.map((character) => `- ${character.name}：${character.role} / ${character.coreDesire}`)
        : ["- 当前还没有稳定的角色资产。"]),
      "",
      "## 当前相关通用实体",
      ...(relevantGenericEntities.length
        ? relevantGenericEntities.map(
            (entity) =>
              `- ${entity.displayName}（${entity.entityType}）：关系 ${entity.edgeCount} / 面板值 ${entity.panelValueCount} / 标签 ${entity.tagCount}${entity.summary ? ` / ${entity.summary}` : ""}`,
          )
        : ["- 当前还没有通用实体投影。"]),
      "",
      "## 标签投影",
      ...(relevantTagTaxonomies.length
        ? relevantTagTaxonomies.map((taxonomy) => {
            const topTags = taxonomy.topTags.length
              ? taxonomy.topTags.map((tag) => `${tag.tagLabel}×${tag.count}`).join("、")
              : "暂无高频标签";
            return `- ${taxonomy.label}：覆盖 ${taxonomy.taggedEntityCount} 个实体 / ${taxonomy.totalTagCount} 条标签 / 高频标签：${topTags}`;
          })
        : ["- 当前还没有标签投影。"]),
      "",
      "## 任务与匹配投影",
      ...(relevantTaskTemplates.length
        ? relevantTaskTemplates.map((task) => {
            const topMatch =
              task.topMatchEntityId && task.topMatchScore !== undefined
                ? ` / 最高匹配：${task.topMatchEntityId}（${task.topMatchScore}）`
                : "";
            return `- ${task.label}（${task.taskType}）：要求 ${task.requirementCount} / 指派 ${task.assignmentCount} / 匹配 ${task.matchCount}${topMatch}`;
          })
        : ["- 当前还没有任务模板投影。"]),
      "",
      "## 系统建议的下一步",
      ...(writingGateAssessment.canDraft
        ? [`- 优先完成：${book.current_focus?.summary ?? "继续按照当前焦点任务推进。"} `]
        : writingGateAssessment.nextActions.map((item) => `- ${item}`)),
    ];

    lines.splice(
      26,
      0,
      `- 候选经验文件：${book.last_outputs?.latest_knowledge_candidates_file ?? "尚未生成"}`,
      "",
      "## 当前候选经验",
      `- 候选数量：${knowledgeItems.length}`,
      ...(activeKnowledgeItems.length
        ? activeKnowledgeItems.map(
            (candidate, index) => `- ${index + 1}. ${candidate.title}（${candidate.status} / ${candidate.scope} / ${candidate.domain}）`,
          )
        : ["- 当前还没有候选经验对象，写完当前 batch 后请先生成复盘单。"]),
      "",
    );

    return lines.join("\n");
  }

  private async loadWritingPackGateStatuses(
    summary: WorkProtocolSummary,
    projectId: string,
    book: BookProtocol,
  ): Promise<WritingPackGateStatusRecord[]> {
    const batchId = this.readString(book.knowledge_state?.current_batch_id);
    const enabledGates = this.readStringArray(summary.knowledgeWorkflow?.enabled_gates);
    if (!enabledGates.length) {
      return [];
    }

    if (!batchId) {
      return enabledGates.map((gateCode) => ({
        gateCode,
        gateStatus: this.inferGateStatusWithoutStoredRecord(gateCode, summary, book),
        note: this.inferGateNoteWithoutStoredRecord(gateCode, summary, book),
      }));
    }

    try {
      const storedGates = await this.knowledgeMethodRepository.listBatchKnowledgeGates(batchId);
      const storedByCode = new Map(
        storedGates.map((gate) => [this.normalizeGateCode(gate.gateCode), gate]),
      );

      return enabledGates.map((gateCode) => {
        const normalizedGateCode = this.normalizeGateCode(gateCode);
        const stored = storedByCode.get(normalizedGateCode);
        if (stored) {
          return {
            gateCode,
            gateStatus: stored.gateStatus,
            note: stored.note,
          };
        }

        return {
          gateCode,
          gateStatus: this.inferGateStatusWithoutStoredRecord(gateCode, summary, book),
          note: this.inferGateNoteWithoutStoredRecord(gateCode, summary, book),
        };
      });
    } catch {
      return enabledGates.map((gateCode) => ({
        gateCode,
        gateStatus: this.inferGateStatusWithoutStoredRecord(gateCode, summary, book),
        note: this.inferGateNoteWithoutStoredRecord(gateCode, summary, book),
      }));
    }
  }

  private assessWritingPackGateState(
    summary: WorkProtocolSummary,
    book: BookProtocol,
    gateStatuses: WritingPackGateStatusRecord[],
  ): {
    mode: "drafting" | "review" | "planning";
    canDraft: boolean;
    blockers: string[];
    nextActions: string[];
  } {
    const taskType = this.readString(book.current_focus?.task_type);
    const reviewStatus = this.readString(book.knowledge_state?.current_batch_review_status);
    const planningPolicy = summary.workspace?.execution_policy?.planning_first;
    const verificationPolicy = summary.workspace?.execution_policy?.verification_before_completion;

    const blockers: string[] = [];
    const nextActions: string[] = [];
    let mode: "drafting" | "review" | "planning" = "drafting";

    if (
      planningPolicy?.require_full_volume_plan_before_drafting &&
      ["planning", "replanning"].includes(taskType ?? "")
    ) {
      mode = "planning";
      blockers.push("当前焦点仍处于规划态，必须先完成整卷骨架、阶段地图和当前批次章纲。");
      nextActions.push("先补整卷功能、阶段事件和当前批次章纲，再继续正文。");
    }

    if (
      verificationPolicy?.require_evidence_before_mark_done &&
      this.readBoolean(book.knowledge_state?.current_batch_review_required) &&
      reviewStatus !== "resolved"
    ) {
      mode = "review";
      blockers.push("当前 batch 仍要求先完成复盘，复盘状态未 resolved。");
      nextActions.push("先完成当前批次复盘，再继续下一批正文。");
    }

    for (const gate of gateStatuses) {
      if (["pending", "blocked"].includes(gate.gateStatus)) {
        if (!blockers.includes(`${gate.gateCode} 未通过`)) {
          blockers.push(`${gate.gateCode} 未通过`);
        }
      }
    }

    if (!nextActions.length) {
      if (mode === "planning") {
        nextActions.push("先完成规划门禁，再重新生成写作包。");
      } else if (mode === "review") {
        nextActions.push("先处理当前批次复盘和 gate，再重新生成写作包。");
      } else {
        nextActions.push("继续按当前批次章纲推进正文。");
      }
    }

    return {
      mode,
      canDraft: blockers.length === 0,
      blockers,
      nextActions,
    };
  }

  private async loadKnowledgeItemsForWritingPack(
    summary: WorkProtocolSummary,
    projectId: string,
    book: BookProtocol,
  ): Promise<KnowledgeItemRecord[]> {
    const knowledgeWorkflow = summary.knowledgeWorkflow;
    const fetchLimit = this.resolveKnowledgeFetchLimit(knowledgeWorkflow);
    const batchId = this.readString(book.knowledge_state?.current_batch_id);
    const activeGlobalProfile = this.readString(book.knowledge_state?.active_global_profile);
    const activeBookProfile = this.readString(book.knowledge_state?.active_book_profile);

    try {
      await this.knowledgeMethodRepository.ensureKnowledgeProfiles({
        projectId,
        globalProfileKey: activeGlobalProfile,
        bookProfileKey: activeBookProfile,
      });

      const profileItems = await this.knowledgeMethodRepository.listKnowledgeItemsForActiveProfiles({
        projectId,
        globalProfileKey: activeGlobalProfile,
        bookProfileKey: activeBookProfile,
        limit: fetchLimit,
      });
      const batchItems = batchId ? await this.knowledgeMethodRepository.listBatchKnowledgeItems(batchId) : [];
      const candidateItems = batchItems.filter((item) => item.status === "candidate");
      const mergedItems = this.mergeKnowledgeItems(profileItems, candidateItems);

      if (mergedItems.length) {
        return this.applyKnowledgeActiveBudget(mergedItems, summary);
      }

      const dbItems = await this.knowledgeMethodRepository.listKnowledgeItemsForWritingPack({
        projectId,
        limit: fetchLimit,
      });
      if (dbItems.length) {
        return this.applyKnowledgeActiveBudget(dbItems, summary);
      }
    } catch {
      // Fall back to file artifacts when the DB layer is not ready yet.
    }

    const fallbackCandidates = this.readKnowledgeCandidatesArtifact(summary, book);
    const fallbackItems = fallbackCandidates.slice(0, fetchLimit).map((candidate) => ({
      id: candidate.id,
      projectId,
      batchId: this.readString(book.knowledge_state?.current_batch_id),
      sourceFindingId: candidate.sourceFindingIds[0],
      scope: this.mapSuggestedScopeToKnowledgeScope(candidate.suggestedScope),
      status: candidate.status,
      domain: candidate.domain,
      priority: candidate.priority,
      title: candidate.title,
      summary: candidate.summary,
      rationale: candidate.rationale,
      prompt: candidate.prompt,
      validationCount: 0,
      profileAffinity: candidate.suggestedRuleSets,
      evidencePaths: candidate.evidencePaths,
      updatedAt: new Date(0).toISOString(),
    }));
    return this.applyKnowledgeActiveBudget(fallbackItems, summary);
  }

  private mergeKnowledgeItems(
    profileItems: KnowledgeItemRecord[],
    candidateItems: KnowledgeItemRecord[],
  ): KnowledgeItemRecord[] {
    const merged: KnowledgeItemRecord[] = [];
    const seen = new Set<string>();

    for (const item of [...profileItems, ...candidateItems]) {
      if (seen.has(item.id)) {
        continue;
      }
      seen.add(item.id);
      merged.push(item);
    }

    return merged;
  }

  private resolveKnowledgeFetchLimit(
    knowledgeWorkflow: WorkspaceKnowledgeWorkflowProtocol | undefined,
  ): number {
    const globalLimit = knowledgeWorkflow?.active_budget?.global_rules ?? 12;
    const bookLimit = knowledgeWorkflow?.active_budget?.book_rules ?? 12;
    const batchFocusLimit = knowledgeWorkflow?.active_budget?.batch_focus_findings ?? 5;
    return Math.max(globalLimit + bookLimit + batchFocusLimit, batchFocusLimit, 5);
  }

  private applyKnowledgeActiveBudget(
    items: KnowledgeItemRecord[],
    summary: WorkProtocolSummary,
  ): KnowledgeItemRecord[] {
    const workflow = summary.knowledgeWorkflow;
    const globalLimit = workflow?.active_budget?.global_rules ?? 12;
    const bookLimit = workflow?.active_budget?.book_rules ?? 12;
    const batchFocusLimit = workflow?.active_budget?.batch_focus_findings ?? 5;

    const selected: KnowledgeItemRecord[] = [];
    const seen = new Set<string>();

    let added = 0;
    for (const item of items.filter((entry) => this.isGlobalKnowledgeItem(entry))) {
      if (added >= globalLimit || seen.has(item.id)) {
        continue;
      }
      selected.push(item);
      seen.add(item.id);
      added += 1;
    }

    added = 0;
    for (const item of items.filter((entry) => this.isBookKnowledgeItem(entry, summary.workId))) {
      if (added >= bookLimit || seen.has(item.id)) {
        continue;
      }
      selected.push(item);
      seen.add(item.id);
      added += 1;
    }

    added = 0;
    for (const item of items.filter((entry) => entry.status === "candidate")) {
      if (added >= batchFocusLimit || seen.has(item.id)) {
        continue;
      }
      selected.push(item);
      seen.add(item.id);
      added += 1;
    }

    return selected;
  }

  private isGlobalKnowledgeItem(item: KnowledgeItemRecord): boolean {
    return item.scope === "global" || item.status === "validated_global";
  }

  private isBookKnowledgeItem(item: KnowledgeItemRecord, workId: string): boolean {
    return item.projectId === workId && (item.status === "active" || item.status === "book_only");
  }

  private readKnowledgeCandidatesArtifact(
    summary: WorkProtocolSummary,
    book: BookProtocol,
  ): KnowledgeCandidateRecord[] {
    const storedPath = this.readString(book.last_outputs?.latest_knowledge_candidates_file);
    if (!storedPath) {
      return [];
    }

    const resolvedPath = this.resolveStoredBookPath(summary.bookRootPath, storedPath);
    if (!resolvedPath || !fs.existsSync(resolvedPath)) {
      return [];
    }

    try {
      const raw = fs.readFileSync(resolvedPath, "utf8");
      const parsed = JSON.parse(raw) as Partial<KnowledgeCandidatesArtifactData>;
      if (!Array.isArray(parsed.candidates)) {
        return [];
      }

      return parsed.candidates.filter((candidate): candidate is KnowledgeCandidateRecord => {
        return Boolean(candidate?.id && candidate?.title && candidate?.status && candidate?.suggestedScope);
      });
    } catch {
      return [];
    }
  }

  private resolveStoredBookPath(bookRootPath: string, storedPath: string): string {
    const normalized = storedPath.replace(/\//g, path.sep);
    return path.isAbsolute(normalized) ? normalized : path.join(bookRootPath, normalized);
  }

  private buildBatchReviewArtifactData(
    summary: WorkProtocolSummary,
    snapshot: WorkbenchProjectSnapshot,
    book: BookProtocol,
  ): BatchReviewArtifactData {
    const knowledgeWorkflow = summary.knowledgeWorkflow;
    const knowledgeState = book.knowledge_state;
    const enabledRuleSets = this.readStringArray(knowledgeState?.enabled_rule_sets);
    const enabledGates = this.readStringArray(knowledgeWorkflow?.enabled_gates);
    const recentChapters = [...snapshot.chapters].slice(-5).reverse();
    const reviewBundles = [...snapshot.pendingConflictBundles, ...snapshot.pendingReviewBundles].slice(
      0,
      knowledgeWorkflow?.active_budget?.batch_focus_findings ?? 5,
    );
    const syntheticFindings = this.buildSyntheticBatchReviewFindings(summary, book, enabledRuleSets, recentChapters);
    const candidatePrompts = this.buildBatchCandidatePrompts(summary, enabledRuleSets, knowledgeState);

    return {
      artifactKind: "batch-review",
      generatedAt: new Date().toISOString(),
      workId: snapshot.work.id,
      workSlug: snapshot.work.slug,
      workTitle: snapshot.work.title,
      batchId: this.readString(knowledgeState?.current_batch_id),
      stage: book.stage ?? snapshot.work.status,
      focusLabel: book.current_focus?.task_label,
      reviewRequired: this.readBoolean(knowledgeState?.current_batch_review_required) ?? false,
      reviewStatus: this.readString(knowledgeState?.current_batch_review_status),
      nextRequiredReviewAtChapter: this.readNumber(knowledgeState?.next_required_review_at_chapter),
      activeGlobalProfile: this.readString(knowledgeState?.active_global_profile),
      activeBookProfile: this.readString(knowledgeState?.active_book_profile),
      enabledRuleSets,
      enabledGates,
      recentChapters: recentChapters.map((chapter) => ({
        order: chapter.order,
        title: chapter.title,
        summary: chapter.summary,
      })),
      findings: [
        ...reviewBundles.map((bundle) => ({
          id: bundle.id,
          title: bundle.title,
          summary: bundle.summary,
          blockingLevel: bundle.blockingLevel,
          riskNature: bundle.riskNature,
          sourcePath: bundle.sourcePath,
          sourceDocumentId: bundle.sourceDocumentId,
          riskReasons: bundle.riskReasons,
        })),
        ...syntheticFindings,
      ],
      candidatePrompts,
      nextActions: [
        "先确认本批次最重要的 1-3 个问题是否成立。",
        "将跨书适用的结论记为 global candidate，将本书特有问题记为 book-only rule。",
        "完成批次复盘后，再生成下一批写作包。",
      ],
    };
  }

  private buildSyntheticBatchReviewFindings(
    summary: WorkProtocolSummary,
    book: BookProtocol,
    enabledRuleSets: string[],
    recentChapters: BatchReviewChapterRecord[],
  ): BatchReviewFindingRecord[] {
    if (!enabledRuleSets.includes("anchoring")) {
      return [];
    }

    const openingArcIncomplete = this.readString(book.knowledge_state?.opening_arc_status) !== "completed";
    const focusTask = this.readString(book.current_focus?.task_type) ?? "";
    const isPlanningOrOpening = openingArcIncomplete || focusTask.includes("opening") || focusTask.includes("replan");

    if (!isPlanningOrOpening) {
      return [];
    }

    const recentSourcePath = this.readString(book.last_outputs?.latest_chapter_file);
    const chapterLabels = recentChapters.slice(0, 3).map((chapter) => `第 ${chapter.order} 章《${chapter.title}》`);

    return [
      {
        id: "synthetic-anchor-gap",
        title: "关键人物首次出场缺少身份锚点",
        summary:
          "当前开篇批次需要确认：关键人物第一次正式进入戏里时，是否给了读者身份、职能或压制力支点，而不是只让文中人物自己知道。",
        blockingLevel: "review",
        riskNature: "anchor-gap",
        sourcePath: recentSourcePath,
        riskReasons: chapterLabels.length
          ? [`优先检查 ${chapterLabels.join("、")} 里的首次人物出场。`]
          : ["优先检查开篇批次里的首次人物出场。"],
      },
      {
        id: "synthetic-knowledge-layer-gap",
        title: "世界词汇和旧事信号缺少最低限度解释",
        summary:
          "当前开篇批次需要确认：重要地点、组织、秩序词第一次进入情节时，是否给了基础关系解释；角色提到旧事、旧账、熟人关系时，是否给了读者最低限度支点。",
        blockingLevel: "review",
        riskNature: "knowledge-layer-gap",
        sourcePath: recentSourcePath,
        riskReasons: [
          "悬疑可以后置真相，但不能后置基础理解。",
          "如果旧事和舞台关系只丢信号不给支点，读者会把它读成莫名其妙。",
        ],
      },
    ];
  }
  private async persistBatchKnowledge(
    summary: WorkProtocolSummary,
    artifactData: BatchReviewArtifactData,
    candidatesData: KnowledgeCandidatesArtifactData,
    artifact: GeneratedBatchReviewArtifact,
  ): Promise<void> {
    const chapterOrders = artifactData.recentChapters.map((chapter) => chapter.order);
    const batchId = artifactData.batchId ?? `${summary.workId}-batch-${this.createTimestampStamp()}`;
    const findingIdMap = new Map<string, string>();
    const findings = artifactData.findings.map((finding, index) => {
      const persistedFindingId = `${batchId}-finding-${index + 1}`;
      findingIdMap.set(finding.id, persistedFindingId);
      return {
        id: persistedFindingId,
        sourceType: "review-bundle",
        feedbackTier: "system",
        domain: this.mapRiskNatureToKnowledgeDomain(finding.riskNature),
        severity: this.mapBlockingLevelToSeverity(finding.blockingLevel),
        title: finding.title,
        summary: finding.summary,
        sourcePath: finding.sourcePath,
        sourceDocumentId: finding.sourceDocumentId,
        riskNature: finding.riskNature,
        riskReasons: finding.riskReasons,
        evidencePaths: finding.sourcePath ? [finding.sourcePath] : [],
      };
    });

    await this.knowledgeMethodRepository.saveBatchKnowledge({
      projectId: artifactData.workId,
      batchId,
      batchKey: artifactData.batchId ?? batchId,
      stageLabel: artifactData.stage,
      focusLabel: artifactData.focusLabel,
      chapterFrom: chapterOrders.length ? Math.min(...chapterOrders) : undefined,
      chapterTo: chapterOrders.length ? Math.max(...chapterOrders) : undefined,
      reviewStatus: artifactData.reviewStatus ?? "generated",
      sourceReviewFile: artifact.displayPath,
      sourceReviewDataFile: artifact.jsonDisplayPath,
      sourceCandidatesFile: artifact.knowledgeCandidatesDisplayPath,
      findings,
      items: candidatesData.candidates.map((candidate) => ({
        id: candidate.id,
        scope: this.mapSuggestedScopeToKnowledgeScope(candidate.suggestedScope),
        status: candidate.status,
        domain: candidate.domain,
        priority: candidate.priority,
        title: candidate.title,
        summary: candidate.summary,
        rationale: candidate.rationale,
        prompt: candidate.prompt,
        validationCount: 0,
        profileAffinity: candidate.suggestedRuleSets,
        evidencePaths: candidate.evidencePaths,
        sourceFindingIds: candidate.sourceFindingIds.map((id) => findingIdMap.get(id) ?? id),
      })),
    });
  }

  private async persistKnowledgeApplications(
    summary: WorkProtocolSummary,
    projectId: string,
    book: BookProtocol,
    knowledgeItems: KnowledgeItemRecord[],
    packKind: "writing-pack" | "risk-investigation-pack",
  ): Promise<void> {
    const batchId = this.readString(book.knowledge_state?.current_batch_id);
    if (!batchId) {
      return;
    }

    await this.knowledgeMethodRepository.recordKnowledgeApplications({
      projectId,
      batchId,
      packKind,
      itemIds: knowledgeItems.map((item) => item.id),
      note: `Auto-recorded when generating ${packKind}.`,
    });
  }

  private async persistKnowledgeGates(
    summary: WorkProtocolSummary,
    artifactData: BatchReviewArtifactData,
    book: BookProtocol,
  ): Promise<void> {
    const batchId = artifactData.batchId ?? this.readString(book.knowledge_state?.current_batch_id);
    if (!batchId) {
      return;
    }

    const gates = artifactData.enabledGates.map((gateCode) => ({
      gateCode,
      gateStatus: this.resolveGateStatus(gateCode, artifactData, book),
      note: this.resolveGateNote(gateCode, artifactData, book),
    }));

    await this.knowledgeMethodRepository.replaceKnowledgeGates({
      projectId: artifactData.workId,
      batchId,
      gates,
    });
  }

  private buildBatchReviewMarkdownFromData(data: BatchReviewArtifactData): string {
    return [
      `# 当前批次复盘单：${data.workTitle}`,
      "",
      `- artifact_kind: ${data.artifactKind}`,
      `- 生成时间：${data.generatedAt}`,
      `- 当前 batch：${data.batchId ?? "未设置"}`,
      `- 当前阶段：${data.stage ?? "未设置"}`,
      `- 当前焦点：${data.focusLabel ?? "待补当前任务"}`,
      `- 复盘要求：${data.reviewRequired ? "必须先复盘再继续下一批" : "当前未强制要求"}`,
      `- 复盘状态：${data.reviewStatus ?? "未设置"}`,
      `- 下一个必复盘章节点：${data.nextRequiredReviewAtChapter ?? "未设置"}`,
      "",
      "## 当前启用的知识规则",
      ...(data.enabledRuleSets.length ? data.enabledRuleSets.map((item) => `- ${item}`) : ["- 当前没有启用规则集。"]),
      "",
      "## 当前启用的 gate",
      ...(data.enabledGates.length ? data.enabledGates.map((item) => `- ${item}`) : ["- 当前没有启用 gate。"]),
      "",
      "## 最近批次章节",
      ...(data.recentChapters.length
        ? data.recentChapters.map((chapter) => `- 第 ${chapter.order} 章《${chapter.title}》：${chapter.summary}`)
        : ["- 当前没有可复盘的章节。"]),
      "",
      "## 系统识别到的重点 findings",
      ...(data.findings.length
        ? data.findings.map((finding, index) => {
            const reasons = finding.riskReasons.length ? `；原因：${finding.riskReasons.join(" / ")}` : "";
            return `${index + 1}. [${finding.blockingLevel}] ${finding.title}：${finding.summary}${reasons}`;
          })
        : ["1. 当前没有挂起的 review bundle，可以优先做人手复盘和经验提炼。"]),
      "",
      "## 建议转成候选经验的问题",
      ...(data.candidatePrompts.length ? data.candidatePrompts.map((prompt) => `- ${prompt}`) : ["- 当前没有生成候选经验提示。"]),
      "",
      "## 下一步动作",
      ...data.nextActions.map((action) => `- ${action}`),
    ].join("\n");
  }
  private buildBatchReviewMarkdown(
    summary: WorkProtocolSummary,
    snapshot: WorkbenchProjectSnapshot,
    book: BookProtocol,
  ): string {
    const knowledgeWorkflow = summary.knowledgeWorkflow;
    const knowledgeState = book.knowledge_state;
    const enabledRuleSets = this.readStringArray(knowledgeState?.enabled_rule_sets);
    const enabledGates = this.readStringArray(knowledgeWorkflow?.enabled_gates);
    const recentChapters = [...snapshot.chapters].slice(-5).reverse();
    const reviewBundles = [...snapshot.pendingConflictBundles, ...snapshot.pendingReviewBundles].slice(
      0,
      knowledgeWorkflow?.active_budget?.batch_focus_findings ?? 5,
    );
    const candidatePrompts = this.buildBatchCandidatePrompts(summary, enabledRuleSets, knowledgeState);

    return [
      `# 当前批次复盘单：${snapshot.work.title}`,
      "",
      "- artifact_kind: batch-review",
      `- 生成时间：${new Date().toISOString()}`,
      `- 当前 batch：${this.readString(knowledgeState?.current_batch_id) ?? "未设置"}`,
      `- 当前阶段：${book.stage ?? snapshot.work.status}`,
      `- 当前焦点：${book.current_focus?.task_label ?? "待补当前任务"}`,
      `- 复盘要求：${this.readBoolean(knowledgeState?.current_batch_review_required) ? "必须先复盘再继续下一批" : "当前未强制要求"}`,
      `- 复盘状态：${this.readString(knowledgeState?.current_batch_review_status) ?? "未设置"}`,
      `- 下一个必复盘章节点：${this.readNumber(knowledgeState?.next_required_review_at_chapter) ?? "未设置"}`,
      "",
      "## 当前启用的知识规则",
      ...(enabledRuleSets.length ? enabledRuleSets.map((item) => `- ${item}`) : ["- 当前没有启用规则集。"]),
      "",
      "## 当前启用的 gate",
      ...(enabledGates.length ? enabledGates.map((item) => `- ${item}`) : ["- 当前没有启用 gate。"]),
      "",
      "## 最近批次章节",
      ...(recentChapters.length
        ? recentChapters.map((chapter) => `- 第 ${chapter.order} 章《${chapter.title}》：${chapter.summary}`)
        : ["- 当前没有可复盘的章节。"]),
      "",
      "## 系统识别到的重点 findings",
      ...(reviewBundles.length
        ? reviewBundles.map((bundle, index) => {
            const reasons = bundle.riskReasons.length ? `；原因：${bundle.riskReasons.join(" / ")}` : "";
            return `${index + 1}. [${bundle.blockingLevel}] ${bundle.title}：${bundle.summary}${reasons}`;
          })
        : ["1. 当前没有挂起的 review bundle，可以优先做人手复盘和经验提炼。"]),
      "",
      "## 建议转成候选经验的问题",
      ...(candidatePrompts.length ? candidatePrompts.map((prompt) => `- ${prompt}`) : ["- 当前没有生成候选经验提示。"]),
      "",
      "## 下一步动作",
      "- 先确认本批次最重要的 1-3 个问题是否成立。",
      "- 将跨书适用的结论记为 global candidate，将本书特有问题记为 book-only rule。",
      "- 完成批次复盘后，再生成下一批写作包。",
    ].join("\n");
  }
  private buildRiskInvestigationPackMarkdown(
    summary: WorkProtocolSummary,
    snapshot: WorkbenchProjectSnapshot,
    bundle: WorkbenchReviewBundleSummary,
  ): string {
    const impactSummary = bundle.impactSummary;
    const relatedSourceRefs = snapshot.recentSourceRefs.filter((sourceRef) =>
      bundle.sourceDocumentId ? sourceRef.sourceDocumentId === bundle.sourceDocumentId : sourceRef.sourcePath === bundle.sourcePath,
    );

    return [
      `# 风险排查包：${snapshot.work.title}`,
      "",
      `- 生成时间：${new Date().toISOString()}`,
      `- 风险标题：${bundle.title}`,
      `- 风险性质：${bundle.riskNature}`,
      `- 风险级别：${bundle.blockingLevel}`,
      `- 协议文件：${this.toDisplayPath(summary.bookFilePath)}`,
      "",
      "## 问题摘要",
      bundle.summary,
      "",
      "## 风险原因",
      ...(bundle.riskReasons.length ? bundle.riskReasons.map((reason) => `- ${reason}`) : ["- 当前没有额外原因说明。"]),
      "",
      "## 推荐动作",
      `- 主动作：${bundle.actionPlan.primaryAction}`,
      ...(bundle.actionPlan.steps.length ? bundle.actionPlan.steps.map((step) => `- ${step}`) : ["- 当前没有额外动作步骤。"]),
      "",
      "## 影响范围",
      ...(impactSummary?.topEntries.length
        ? impactSummary.topEntries.map((entry) => `- ${entry.label}：${entry.reason}`)
        : ["- 当前没有识别出明确的影响条目。"]),
      "",
      "## 建议回看章节",
      ...(impactSummary?.recommendedReviewChapters.length
        ? impactSummary.recommendedReviewChapters.map((chapter) => `- ${chapter.label}：${chapter.reason}`)
        : ["- 当前没有建议回看的章节。"]),
      "",
      "## 证据",
      ...(bundle.latestEvidenceQuote ? [`> ${bundle.latestEvidenceQuote}`] : ["- 当前没有可展示的引用片段。"]),
      "",
      "## 最近来源引用",
      ...(relatedSourceRefs.length
        ? relatedSourceRefs.map((sourceRef) => `- ${sourceRef.assetType} / ${sourceRef.sourcePath ?? sourceRef.locator}`)
        : ["- 当前没有额外来源引用。"]),
    ].join("\n");
  }

  private writeContextPack(
    summary: WorkProtocolSummary,
    kind: "writing-pack" | "risk-investigation-pack",
    content: string,
  ): GeneratedProtocolPack {
    const outputDir = summary.contextPackDirectoryPath;
    fs.mkdirSync(outputDir, { recursive: true });

    const stamp = this.createTimestampStamp();
    const latestFileName = `${kind}.latest.md`;
    const archiveFileName = `${kind}.${stamp}.md`;
    const latestPath = path.join(outputDir, latestFileName);
    const archivePath = path.join(outputDir, archiveFileName);

    fs.writeFileSync(latestPath, content, "utf8");
    fs.writeFileSync(archivePath, content, "utf8");

    const stats = fs.statSync(latestPath);
    return {
      kind,
      absolutePath: latestPath,
      displayPath: this.toDisplayPath(latestPath),
      updatedAt: stats.mtime.toISOString(),
    };
  }

  private writeBatchReviewArtifact(
    summary: WorkProtocolSummary,
    book: BookProtocol,
    content: string,
    artifactData: BatchReviewArtifactData,
    candidatesData: KnowledgeCandidatesArtifactData,
  ): GeneratedBatchReviewArtifact {
    const latestConfiguredPath = this.readString(book.last_outputs?.latest_review_file) ?? "03-中间产物/latest-review.md";
    const latestAbsolutePath = path.isAbsolute(latestConfiguredPath)
      ? path.normalize(latestConfiguredPath)
      : path.join(summary.bookRootPath, latestConfiguredPath);
    const outputDir = path.dirname(latestAbsolutePath);
    fs.mkdirSync(outputDir, { recursive: true });

    const stamp = this.createTimestampStamp();
    const archivePath = path.join(outputDir, `batch-review.${stamp}.md`);
    const latestJsonPath = path.join(outputDir, "latest-review.json");
    const archiveJsonPath = path.join(outputDir, `batch-review.${stamp}.json`);
    const latestCandidatesPath = path.join(outputDir, "latest-knowledge-candidates.json");
    const archiveCandidatesPath = path.join(outputDir, `knowledge-candidates.${stamp}.json`);
    fs.writeFileSync(latestAbsolutePath, content, "utf8");
    fs.writeFileSync(archivePath, content, "utf8");
    fs.writeFileSync(latestJsonPath, JSON.stringify(artifactData, null, 2), "utf8");
    fs.writeFileSync(archiveJsonPath, JSON.stringify(artifactData, null, 2), "utf8");
    fs.writeFileSync(latestCandidatesPath, JSON.stringify(candidatesData, null, 2), "utf8");
    fs.writeFileSync(archiveCandidatesPath, JSON.stringify(candidatesData, null, 2), "utf8");

    const stats = fs.statSync(latestAbsolutePath);
    return {
      kind: "batch-review",
      absolutePath: latestAbsolutePath,
      displayPath: this.toDisplayPath(latestAbsolutePath),
      jsonAbsolutePath: latestJsonPath,
      jsonDisplayPath: this.toDisplayPath(latestJsonPath),
      knowledgeCandidatesAbsolutePath: latestCandidatesPath,
      knowledgeCandidatesDisplayPath: this.toDisplayPath(latestCandidatesPath),
      updatedAt: stats.mtime.toISOString(),
    };
  }

  private persistGeneratedBatchReviewState(
    summary: WorkProtocolSummary,
    book: BookProtocol,
    artifact: GeneratedBatchReviewArtifact,
  ): void {
    const relativeToBookRoot = path.relative(summary.bookRootPath, artifact.absolutePath);
    const nextLatestReviewFile =
      !path.isAbsolute(relativeToBookRoot) && !relativeToBookRoot.startsWith("..")
        ? this.normalizeForYaml(relativeToBookRoot)
        : this.toDisplayPath(artifact.absolutePath);
    const relativeJsonToBookRoot = path.relative(summary.bookRootPath, artifact.jsonAbsolutePath);
    const nextLatestReviewDataFile =
      !path.isAbsolute(relativeJsonToBookRoot) && !relativeJsonToBookRoot.startsWith("..")
        ? this.normalizeForYaml(relativeJsonToBookRoot)
        : this.toDisplayPath(artifact.jsonAbsolutePath);
    const relativeCandidatesToBookRoot = path.relative(summary.bookRootPath, artifact.knowledgeCandidatesAbsolutePath);
    const nextLatestKnowledgeCandidatesFile =
      !path.isAbsolute(relativeCandidatesToBookRoot) && !relativeCandidatesToBookRoot.startsWith("..")
        ? this.normalizeForYaml(relativeCandidatesToBookRoot)
        : this.toDisplayPath(artifact.knowledgeCandidatesAbsolutePath);

    const nextBookProtocol: BookProtocol = {
      ...book,
      knowledge_state: {
        ...book.knowledge_state,
        current_batch_review_status: "generated",
      },
      last_outputs: {
        ...book.last_outputs,
        latest_review_file: nextLatestReviewFile,
        latest_review_data_file: nextLatestReviewDataFile,
        latest_knowledge_candidates_file: nextLatestKnowledgeCandidatesFile,
      },
    };

    fs.writeFileSync(summary.bookFilePath, YAML.stringify(nextBookProtocol), "utf8");
  }

  private persistResolvedBatchReviewState(summary: WorkProtocolSummary, book: BookProtocol): void {
    const currentBatchId = this.readString(book.knowledge_state?.current_batch_id);
    const shouldCompleteOpeningArc = typeof currentBatchId === "string" && currentBatchId.startsWith("opening-");
    const nextBookProtocol: BookProtocol = {
      ...book,
      knowledge_state: {
        ...book.knowledge_state,
        current_batch_review_status: "resolved",
        opening_arc_status: shouldCompleteOpeningArc ? "completed" : book.knowledge_state?.opening_arc_status,
      },
    };

    fs.writeFileSync(summary.bookFilePath, YAML.stringify(nextBookProtocol), "utf8");
  }

  private normalizeBatchKnowledgePromotions(
    candidateItems: KnowledgeItemRecord[],
    promotions: BatchKnowledgePromotionDecision[] | undefined,
  ): BatchKnowledgePromotionDecision[] {
    if (promotions?.length) {
      return promotions.filter((promotion) =>
        candidateItems.some((item) => item.id === promotion.knowledgeItemId),
      );
    }

    return candidateItems.map((item) => ({
      knowledgeItemId: item.id,
      targetStatus: "book_only",
      applicationResult: "helpful",
      note: "Default promotion after batch review resolution.",
    }));
  }

  private normalizeBatchKnowledgeGateResults(
    enabledGates: string[],
    gateResults: BatchKnowledgeGateDecision[] | undefined,
  ): BatchKnowledgeGateDecision[] {
    if (gateResults?.length) {
      const provided = new Map(gateResults.map((gate) => [gate.gateCode, gate]));
      return enabledGates.map((gateCode) => {
        const existing = provided.get(gateCode);
        return (
          existing ?? {
            gateCode,
            gateStatus: "passed",
            note: "Resolved during batch knowledge closure.",
          }
        );
      });
    }

    return enabledGates.map((gateCode) => ({
      gateCode,
      gateStatus: "passed",
      note: "Resolved during batch knowledge closure.",
    }));
  }

  private defaultApplicationResultForPromotion(
    targetStatus: BatchKnowledgePromotionDecision["targetStatus"],
  ): "helpful" | "neutral" | "harmful" {
    if (targetStatus === "deprecated") {
      return "harmful";
    }
    if (targetStatus === "validated_global") {
      return "helpful";
    }
    return "neutral";
  }

  private mapKnowledgePromotionStatusToScope(
    targetStatus: BatchKnowledgePromotionDecision["targetStatus"],
  ): string {
    if (targetStatus === "validated_global") {
      return "global";
    }
    if (targetStatus === "book_only") {
      return "book";
    }
    return "book";
  }

  private buildKnowledgeCandidatesArtifactData(
    artifact: BatchReviewArtifactData,
    sourceReviewJsonPath: string,
  ): KnowledgeCandidatesArtifactData {
    const evidencePaths = [...new Set(artifact.findings.map((finding) => finding.sourcePath).filter((value): value is string => Boolean(value)))];
    const findingIds = artifact.findings.map((finding) => finding.id);

    return {
      artifactKind: "knowledge-candidates",
      generatedAt: artifact.generatedAt,
      workId: artifact.workId,
      workSlug: artifact.workSlug,
      workTitle: artifact.workTitle,
      batchId: artifact.batchId,
      sourceReviewJsonPath: this.toDisplayPath(sourceReviewJsonPath),
      candidates: artifact.candidatePrompts.map((prompt, index) => ({
        id: `${artifact.batchId ?? "batch"}-candidate-${index + 1}`,
        status: "candidate",
        suggestedScope: "pending",
        sourceKind: "batch-review",
        domain: this.inferCandidateDomain(prompt, artifact.enabledRuleSets),
        priority: this.inferCandidatePriority(prompt, artifact.findings),
        title: prompt,
        summary: "来自当前批次复盘的候选写作经验，需要人工确认后再决定是否升级为通用规则或本书规则。",
        rationale: "由系统根据当前批次复盘结果自动提炼，后续应通过复盘确认后再升级。",
        prompt,
        suggestedRuleSets: artifact.enabledRuleSets,
        sourceFindingIds: findingIds,
        evidencePaths,
      })),
    };
  }
  private buildBatchCandidatePrompts(
    summary: WorkProtocolSummary,
    enabledRuleSets: string[],
    knowledgeState: BookKnowledgeStateProtocol | undefined,
  ): string[] {
    const prompts: string[] = [];

    if (enabledRuleSets.includes("continuity")) {
      prompts.push("上一章章尾抛出的问题，下一章开头是否先接住了当场后果。");
    }
    if (enabledRuleSets.includes("anchoring")) {
      prompts.push("重要人物第一次正式进入戏里时，是否补足了身份 / 职能 / 压制力锚点。");
      prompts.push("重要地点、组织、秩序词第一次正式进入情节时，是否给了读者最低限度的关系解释。");
      prompts.push("角色提到旧事、旧账、熟人关系时，是否给了读者可理解的最低限度支点，而不是只丢一句谜语。");
    }
    if (enabledRuleSets.includes("exposition")) {
      prompts.push("当前批次里，主角职业、当前处境、基础舞台关系是否仍然清楚。");
    }
    if (enabledRuleSets.includes("pacing")) {
      prompts.push("这一批是否只堆谜团，还是已经出现了至少一次问题 -> 追查 -> 小兑现。");
    }
    if (enabledRuleSets.includes("opening-arc-repair") || this.readString(knowledgeState?.opening_arc_status) !== "completed") {
      prompts.push("开篇弧线是否让读者在前三章内知道主角是谁、靠什么活、为什么不能出事。");
    }
    if (summary.workspace?.execution_policy?.root_cause_first?.require_issue_classification_before_rewrite) {
      prompts.push(
        `当前批次最主要的问题先归类为：${this.readStringArray(summary.workspace?.execution_policy?.root_cause_first?.default_categories).join(" / ")}。`,
      );
    }

    return prompts;
  }
  private mapRiskNatureToKnowledgeDomain(riskNature?: string): string {
    switch (riskNature) {
      case "factual-conflict":
        return "continuity";
      case "information-gap":
      case "anchor-gap":
      case "knowledge-layer-gap":
        return "exposition";
      case "confidence-review":
        return "pacing";
      case "format-blocker":
        return "delivery";
      default:
        return "continuity";
    }
  }

  private resolveGateStatus(
    gateCode: string,
    artifactData: BatchReviewArtifactData,
    book: BookProtocol,
  ): string {
    const normalizedGateCode = this.normalizeGateCode(gateCode);

    if (normalizedGateCode === "batch-review-required") {
      if (!artifactData.reviewRequired) {
        return "waived";
      }
      return artifactData.reviewStatus === "resolved" ? "passed" : "pending";
    }

    if (normalizedGateCode === "opening-arc-review") {
      return this.readString(book.knowledge_state?.opening_arc_status) === "completed" ? "passed" : "pending";
    }

    if (normalizedGateCode === "continuity-review") {
      return artifactData.findings.some((finding) => this.mapRiskNatureToKnowledgeDomain(finding.riskNature) === "continuity")
        ? "pending"
        : "passed";
    }

    if (normalizedGateCode === "anchoring-review") {
      return artifactData.findings.some((finding) => this.mapRiskNatureToKnowledgeDomain(finding.riskNature) === "exposition") || this.readString(book.knowledge_state?.opening_arc_status) !== "completed"
        ? "pending"
        : "passed";
    }

    if (normalizedGateCode === "meta-language-check") {
      return "pending";
    }

    if (normalizedGateCode === "prewrite-plan-required") {
      return ["planning", "replanning"].includes(this.readString(book.current_focus?.task_type) ?? "") ? "pending" : "passed";
    }

    if (normalizedGateCode === "rhythm-plan-required") {
      return ["planning", "replanning"].includes(this.readString(book.current_focus?.task_type) ?? "") ? "pending" : "passed";
    }

    if (normalizedGateCode === "volume-budget-check") {
      const focusTask = this.readString(book.current_focus?.task_type) ?? "";
      return focusTask.includes("replan") || focusTask.includes("budget") ? "pending" : "passed";
    }

    return "pending";
  }

  private resolveGateNote(
    gateCode: string,
    artifactData: BatchReviewArtifactData,
    book: BookProtocol,
  ): string {
    const normalizedGateCode = this.normalizeGateCode(gateCode);

    if (normalizedGateCode === "batch-review-required") {
      return artifactData.reviewRequired
        ? "Current batch review is required and has been generated, but not yet manually resolved."
        : "Current batch does not require a blocking review gate.";
    }

    if (normalizedGateCode === "opening-arc-review") {
      return this.readString(book.knowledge_state?.opening_arc_status) === "completed"
        ? "Opening arc review is already completed for this book."
        : "Opening arc review is still in progress and should remain active.";
    }

    if (normalizedGateCode === "continuity-review") {
      return artifactData.findings.some((finding) => this.mapRiskNatureToKnowledgeDomain(finding.riskNature) === "continuity")
        ? "Continuity findings are still present in the current batch review."
        : "No blocking continuity finding was detected in the current batch review.";
    }

    if (normalizedGateCode === "anchoring-review") {
      return artifactData.findings.some((finding) => this.mapRiskNatureToKnowledgeDomain(finding.riskNature) === "exposition")
        ? "Anchor or reader-understanding findings are still present in the current batch review."
        : "No blocking anchor or reader-understanding finding was detected in the current batch review.";
    }

    if (normalizedGateCode === "meta-language-check") {
      return "Meta-language scan is still tracked outside the method ledger and should be confirmed separately.";
    }

    if (normalizedGateCode === "prewrite-plan-required") {
      return "Current focus is still planning-oriented, so正文 drafting should remain blocked until the plan gate passes.";
    }

    if (normalizedGateCode === "rhythm-plan-required") {
      return "Rhythm and chapter-function mix should be settled before entering the next drafting batch.";
    }

    if (normalizedGateCode === "volume-budget-check") {
      return "Volume budget gate should stay active until projected volume words and chapter count are consistent.";
    }

    return "Gate status has been recorded but still needs an explicit resolution rule.";
  }

  private inferGateStatusWithoutStoredRecord(
    gateCode: string,
    summary: WorkProtocolSummary,
    book: BookProtocol,
  ): string {
    const normalizedGateCode = this.normalizeGateCode(gateCode);
    const reviewRequired = this.readBoolean(book.knowledge_state?.current_batch_review_required);
    const reviewStatus = this.readString(book.knowledge_state?.current_batch_review_status);
    const focusTask = this.readString(book.current_focus?.task_type) ?? "";

    if (normalizedGateCode === "batch-review-required") {
      if (!reviewRequired) {
        return "waived";
      }
      return reviewStatus === "resolved" ? "passed" : "pending";
    }

    if (normalizedGateCode === "opening-arc-review") {
      return this.readString(book.knowledge_state?.opening_arc_status) === "completed" ? "passed" : "pending";
    }

    if (normalizedGateCode === "anchoring-review") {
      return this.readString(book.knowledge_state?.opening_arc_status) === "completed" && (!reviewRequired || reviewStatus === "resolved") ? "passed" : "pending";
    }

    if (normalizedGateCode === "prewrite-plan-required" || normalizedGateCode === "rhythm-plan-required") {
      return ["planning", "replanning"].includes(focusTask) ? "pending" : "passed";
    }

    if (normalizedGateCode === "volume-budget-check") {
      return focusTask.includes("replan") || focusTask.includes("budget") ? "pending" : "passed";
    }

    if (normalizedGateCode === "meta-language-check" || normalizedGateCode === "continuity-review") {
      return reviewRequired && reviewStatus !== "resolved" ? "pending" : "passed";
    }

    return summary.enabledKnowledgeGates.includes(gateCode) ? "pending" : "waived";
  }

  private inferGateNoteWithoutStoredRecord(
    gateCode: string,
    summary: WorkProtocolSummary,
    book: BookProtocol,
  ): string {
    const normalizedGateCode = this.normalizeGateCode(gateCode);
    const focusTask = this.readString(book.current_focus?.task_type) ?? "";

    if (normalizedGateCode === "batch-review-required") {
      return "Current gate status is inferred from book.yml because no persisted gate record exists yet.";
    }
    if (normalizedGateCode === "prewrite-plan-required" || normalizedGateCode === "rhythm-plan-required") {
      return ["planning", "replanning"].includes(focusTask)
        ? "Current focus is still planning-oriented."
        : "Current focus no longer indicates a planning block.";
    }
    if (normalizedGateCode === "volume-budget-check") {
      return focusTask.includes("replan") || focusTask.includes("budget")
        ? "Current focus indicates a budget replan is still required."
        : "No budget replan flag is currently active in focus state.";
    }
    if (normalizedGateCode === "opening-arc-review") {
      return this.readString(book.knowledge_state?.opening_arc_status) === "completed"
        ? "Opening arc status is already completed."
        : "Opening arc status is still incomplete.";
    }
    if (normalizedGateCode === "anchoring-review") {
      return this.readString(book.knowledge_state?.opening_arc_status) === "completed"
        ? "Opening arc protocol says the anchor review can pass, but persisted review evidence should still be checked."
        : "Opening arc is still incomplete, so anchor review remains active.";
    }
    return summary.enabledKnowledgeGates.includes(gateCode)
      ? "Current gate status is inferred from protocol state."
      : "No gate record exists for this code.";
  }

  private normalizeGateCode(gateCode: string): string {
    return gateCode.replace(/_/g, "-").trim().toLowerCase();
  }

  private mapBlockingLevelToSeverity(blockingLevel: string): string {
    switch (blockingLevel) {
      case "conflict":
        return "high";
      case "review":
        return "medium";
      default:
        return "low";
    }
  }

  private mapSuggestedScopeToKnowledgeScope(suggestedScope: string): string {
    switch (suggestedScope) {
      case "global":
        return "global";
      case "book":
        return "book";
      default:
        return "book";
    }
  }

  private inferCandidateDomain(prompt: string, enabledRuleSets: string[]): string {
    if (prompt.includes("上一章") || prompt.includes("次章") || prompt.includes("接住")) {
      return "continuity";
    }
    if (prompt.includes("首次") || prompt.includes("身份") || prompt.includes("职能") || prompt.includes("组织") || prompt.includes("旧事") || prompt.includes("支点") || prompt.includes("基础信息") || prompt.includes("职业") || prompt.includes("舞台") || prompt.includes("读者")) {
      return "exposition";
    }
    if (prompt.includes("问题 -> 追查 -> 小兑现") || prompt.includes("小兑现") || prompt.includes("只堆谜团")) {
      return "pacing";
    }
    if (prompt.includes("前三章") || prompt.includes("开篇")) {
      return "opening-arc";
    }
    return enabledRuleSets[0] ?? "continuity";
  }

  private inferCandidatePriority(prompt: string, findings: BatchReviewFindingRecord[]): string {
    if (prompt.includes("前三章") || prompt.includes("开篇")) {
      return "high";
    }
    if (findings.some((finding) => finding.blockingLevel === "conflict")) {
      return "high";
    }
    if (findings.some((finding) => finding.blockingLevel === "review")) {
      return "medium";
    }
    return "low";
  }

  private createTimestampStamp(): string {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, "0");
    return [
      now.getFullYear(),
      pad(now.getMonth() + 1),
      pad(now.getDate()),
      "-",
      pad(now.getHours()),
      pad(now.getMinutes()),
      pad(now.getSeconds()),
    ].join("");
  }

  private pickRiskBundle(
    snapshot: WorkbenchProjectSnapshot,
    bundleId?: string,
  ): WorkbenchReviewBundleSummary | undefined {
    const bundles = bundleId
      ? snapshot.pendingReviewBundles.filter((bundle) => bundle.id === bundleId)
      : [...snapshot.pendingConflictBundles, ...snapshot.pendingReviewBundles];

    return bundles[0];
  }

  private resolveRelativeDirectory(bookRootPath: string, fullPath: string | undefined, fallback: string): string {
    if (!fullPath) {
      return fallback;
    }

    const relativePath = path.relative(bookRootPath, fullPath);
    if (!relativePath || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      return fallback;
    }

    return this.normalizeForYaml(relativePath);
  }

  private readString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  }

  private readNumber(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
  }

  private readBoolean(value: unknown): boolean | undefined {
    return typeof value === "boolean" ? value : undefined;
  }

  private readStringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
  }

  private toDisplayPath(targetPath: string): string {
    return this.normalizeForYaml(targetPath);
  }

  private normalizeForYaml(targetPath: string): string {
    return targetPath.replace(/\\/g, "/");
  }

  private toWorkspaceLinkedPath(targetPath: string): string {
    const relativePath = path.relative(this.workspaceRoot, targetPath);
    if (!relativePath.startsWith("..") && !path.isAbsolute(relativePath)) {
      return this.normalizeForYaml(relativePath);
    }
    return this.toDisplayPath(targetPath);
  }

  private normalizePath(targetPath: string): string {
    return path.normalize(targetPath).toLowerCase();
  }

  private createDefaultBatchId(activeVolume: number, activeChapter: number, batchSize: number): string {
    const normalizedBatchSize = Math.max(batchSize, 1);
    const batchNumber = Math.max(Math.ceil(activeChapter / normalizedBatchSize), 1);
    return `volume-${activeVolume}-batch-${batchNumber}`;
  }

  private computeNextRequiredReviewAtChapter(activeChapter: number, batchSize: number): number {
    const normalizedBatchSize = Math.max(batchSize, 1);
    return Math.max(Math.ceil((activeChapter + 1) / normalizedBatchSize) * normalizedBatchSize, normalizedBatchSize);
  }
}



