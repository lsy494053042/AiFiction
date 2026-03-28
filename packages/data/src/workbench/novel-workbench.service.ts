import { createHash } from "node:crypto";

import { asc, eq } from "drizzle-orm";

import type {
  ChapterCard,
  CharacterCard,
  ForeshadowLedgerItem,
  VolumeOutline,
  WorkProfile,
} from "@aifiction/schemas";

import type { RepositoryPageRequest } from "../contracts/repository-contracts";
import { type SqliteClient, getSqliteClient } from "../client";
import { SqliteNarrativeAssetRepository } from "../repositories/v2/narrative-asset.repository";
import { SqliteProjectCatalogRepository } from "../repositories/v2/project-catalog.repository";
import { readStringArray } from "../repositories/v2/repository-base";
import {
  type SyncAssetUpdateRecord,
  type SyncFileSourceRecord,
  type SyncFollowUpTaskStateRecord,
  type SyncReviewQueueRecord,
  type SyncSourceRefRecord,
  SqliteSyncSourceRepository,
  SqliteSyncWorkflowRepository,
} from "../repositories/v2";
import { assessReviewRisk } from "../sync/review-risk";
import { ensureSqliteV2Bootstrap } from "../v2/bootstrap";
import { foreshadowsV2Table, novelProjectsV2Table, volumesV2Table } from "../v2";
import {
  buildReviewBundleImpactSummary,
  type WorkbenchImpactSummary,
  type WorkbenchSourceDocumentContext,
} from "./impact-analysis";
import { buildWorkbenchActionPlan, type WorkbenchActionPlan } from "./action-dispatch";

export interface WorkbenchProjectStats {
  volumeCount: number;
  chapterCount: number;
  characterCount: number;
  foreshadowCount: number;
  relationCount: number;
  sourceCount: number;
  pendingReviewCount: number;
}

export interface WorkbenchProjectSummary {
  work: WorkProfile;
  stats: WorkbenchProjectStats;
  latestChapterTitle?: string;
  updatedAt: string;
}

export interface WorkbenchCharacterGraphNode {
  characterId: string;
  name: string;
  role: string;
  archetype: string;
}

export interface WorkbenchCharacterGraphEdge {
  sourceCharacterId: string;
  sourceCharacterName: string;
  targetCharacterId: string;
  targetCharacterName: string;
  publicLabel: string;
  privateLabel?: string;
  trustLevel: number;
  tensionLevel: number;
  sourceRefCount: number;
  latestSourceDocumentId?: string;
  latestSourcePath?: string;
  latestEvidenceQuote?: string;
}

export interface WorkbenchCharacterGraph {
  nodes: WorkbenchCharacterGraphNode[];
  edges: WorkbenchCharacterGraphEdge[];
}

export interface WorkbenchFileSourceSummary {
  id: string;
  label: string;
  sourceKind: string;
  rootPath: string;
  chapterPath?: string;
  outlinePath?: string;
  exportPath?: string;
  status: string;
  lastScannedAt?: string;
  documentCount: number;
  pendingDocumentCount: number;
  missingDocumentCount: number;
  reviewPendingCount: number;
  latestDocumentPath?: string;
}

export interface WorkbenchReviewItemSummary {
  id: string;
  syncRunId?: string;
  reviewKind: string;
  severity: string;
  status: string;
  summary: string;
  sourceType: string;
  sourceId?: string;
  sourceDocumentId?: string;
  sourcePath?: string;
  documentKind?: string;
  detailJson: Record<string, unknown>;
}

export interface WorkbenchReviewBundleSummary {
  id: string;
  title: string;
  summary: string;
  sourceDocumentId?: string;
  sourcePath?: string;
  documentKind?: string;
  syncRunId?: string;
  severity: string;
  blockingLevel: "none" | "review" | "conflict";
  pendingItemCount: number;
  lowSeverityCount: number;
  mediumSeverityCount: number;
  highSeverityCount: number;
  characterCandidateCount: number;
  relationshipCandidateCount: number;
  foreshadowCandidateCount: number;
  timelineCandidateCount: number;
  reviewHintCount: number;
  reviewKinds: string[];
  riskNature: string;
  riskCategories: string[];
  riskReasons: string[];
  recommendedActions: string[];
  autoApprovalReasons: string[];
  sourceRefCount: number;
  latestReferenceKind?: string;
  latestEvidenceQuote?: string;
  impactSummary?: WorkbenchImpactSummary;
  isAutoApprovable: boolean;
  actionPlan: WorkbenchActionPlan;
  items: WorkbenchReviewItemSummary[];
}

export interface WorkbenchReviewStats {
  bundleCount: number;
  autoApprovableBundleCount: number;
  reviewBundleCount: number;
  conflictBundleCount: number;
  informationGapBundleCount: number;
  confidenceReviewBundleCount: number;
  formatBlockerBundleCount: number;
  factualConflictBundleCount: number;
  formalReviewChapterCount: number;
  watchChapterCount: number;
  attentionChapterCount: number;
  pendingCount: number;
  lowSeverityCount: number;
  mediumSeverityCount: number;
  highSeverityCount: number;
}

export interface WorkbenchSourceRefSummary {
  id: string;
  assetType: string;
  assetId: string;
  referenceKind: string;
  locator: string;
  sourceDocumentId?: string;
  sourcePath?: string;
  documentKind?: string;
  evidenceQuote?: string;
  updatedAt: string;
}

export interface WorkbenchAttentionChapterSummary {
  chapterId: string;
  label: string;
  followUpMode: "watch" | "formal-review";
  priority: "normal" | "high";
  triggerBundleCount: number;
  reviewBundleCount: number;
  conflictBundleCount: number;
  sourceDocumentCount: number;
  riskNatures: string[];
  strategies: string[];
  reasonSummary: string;
  recommendedAction: string;
}

export interface WorkbenchFollowUpTaskSummary {
  id: string;
  chapterId: string;
  label: string;
  taskKind: "formal-review";
  taskFingerprint: string;
  taskStatus: "pending" | "in_review" | "completed" | "dismissed";
  taskOutcome?: "consistent" | "needs-revision" | "needs-rescan" | "deferred";
  outcomeSummary?: string;
  priority: "normal" | "high";
  summary: string;
  nextAction: string;
  decisionNote?: string;
  decidedAt?: string;
  triggerBundleCount: number;
  reviewBundleCount: number;
  conflictBundleCount: number;
  sourceDocumentCount: number;
}

export interface WorkbenchFollowUpQueueSummary {
  formalReviewChapters: WorkbenchAttentionChapterSummary[];
  watchChapters: WorkbenchAttentionChapterSummary[];
  formalReviewTasks: WorkbenchFollowUpTaskSummary[];
  recentResolvedTasks: WorkbenchFollowUpTaskSummary[];
  highestPriorityChapter?: WorkbenchAttentionChapterSummary;
  highestPriorityTask?: WorkbenchFollowUpTaskSummary;
}

interface WorkbenchSourceDocumentIndex extends WorkbenchSourceDocumentContext {
  syncStatus: string;
  lastModifiedAt: string;
}

export interface WorkbenchProjectSnapshot {
  work: WorkProfile;
  stats: WorkbenchProjectStats;
  volumes: VolumeOutline[];
  characters: CharacterCard[];
  chapters: ChapterCard[];
  graph: WorkbenchCharacterGraph;
  latestChapter?: ChapterCard;
  fileSources: WorkbenchFileSourceSummary[];
  pendingReviewBundles: WorkbenchReviewBundleSummary[];
  pendingConflictBundles: WorkbenchReviewBundleSummary[];
  recentSourceRefs: WorkbenchSourceRefSummary[];
  attentionChapters: WorkbenchAttentionChapterSummary[];
  followUpQueue: WorkbenchFollowUpQueueSummary;
  pendingReviews: WorkbenchReviewItemSummary[];
  reviewStats: WorkbenchReviewStats;
}

export class NovelWorkbenchService {
  private readonly projectCatalogRepository: SqliteProjectCatalogRepository;
  private readonly narrativeAssetRepository: SqliteNarrativeAssetRepository;
  private readonly syncSourceRepository: SqliteSyncSourceRepository;
  private readonly syncWorkflowRepository: SqliteSyncWorkflowRepository;

  constructor(private readonly client: SqliteClient = getSqliteClient()) {
    this.projectCatalogRepository = new SqliteProjectCatalogRepository(client);
    this.narrativeAssetRepository = new SqliteNarrativeAssetRepository(client);
    this.syncSourceRepository = new SqliteSyncSourceRepository(client);
    this.syncWorkflowRepository = new SqliteSyncWorkflowRepository(client);
  }

  async listProjectSummaries(page?: RepositoryPageRequest): Promise<WorkbenchProjectSummary[]> {
    await ensureSqliteV2Bootstrap(this.client);

    const works = await this.projectCatalogRepository.listProjects(page);
    if (!works.length) {
      return [];
    }

    const projectRows = await this.client.db
      .select({ id: novelProjectsV2Table.id, updatedAt: novelProjectsV2Table.updatedAt })
      .from(novelProjectsV2Table);
    const updatedAtByProjectId = new Map(projectRows.map((projectRow) => [projectRow.id, projectRow.updatedAt]));

    return Promise.all(
      works.map(async (work) => {
        const snapshot = await this.getProjectSnapshotBySlug(work.slug);
        return {
          work,
          stats: snapshot?.stats ?? this.createEmptyStats(),
          latestChapterTitle: snapshot?.latestChapter?.title,
          updatedAt: updatedAtByProjectId.get(work.id) ?? new Date(0).toISOString(),
        };
      }),
    );
  }

  async getProjectSnapshotBySlug(slug: string): Promise<WorkbenchProjectSnapshot | null> {
    await ensureSqliteV2Bootstrap(this.client);

    const work = await this.projectCatalogRepository.getProjectBySlug(slug);
    if (!work) {
      return null;
    }

    const [characters, chapters, volumes, foreshadows, fileSources, reviewRows, sourceRefs, assetUpdates, followUpTaskStates] = await Promise.all([
      this.narrativeAssetRepository.listCharacters(work.id),
      this.narrativeAssetRepository.listChapters(work.id),
      this.listVolumes(work.id),
      this.listForeshadows(work.id),
      this.syncSourceRepository.listFileSources(work.id),
      this.syncWorkflowRepository.listReviewQueue(work.id, "pending"),
      this.syncWorkflowRepository.listSourceRefs({ projectId: work.id }),
      this.syncWorkflowRepository.listAssetUpdates({ projectId: work.id }),
      this.syncWorkflowRepository.listFollowUpTaskStates(work.id, "formal-review"),
    ]);

    const sourceDocumentsByFileSource = new Map<string, WorkbenchSourceDocumentIndex[]>();
    const sourceDocumentById = new Map<string, WorkbenchSourceDocumentIndex>();

    for (const fileSource of fileSources) {
      const sourceDocuments = this.sortSourceDocuments(await this.syncSourceRepository.listSourceDocuments(fileSource.id));
      sourceDocumentsByFileSource.set(fileSource.id, sourceDocuments);

      for (const sourceDocument of sourceDocuments) {
        sourceDocumentById.set(sourceDocument.id, sourceDocument);
      }
    }

    const relationSourceRefs = this.createSourceRefIndex(
      sourceRefs.filter((sourceRef) => sourceRef.assetType === "character-relationship"),
    );
    const sourceRefsByDocumentId = this.createSourceDocumentSourceRefIndex(sourceRefs);
    const assetUpdatesByDocumentId = this.createAssetUpdateIndex(assetUpdates);
    const graph = this.buildCharacterGraph(characters, relationSourceRefs, sourceDocumentById);
    const pendingReviews = reviewRows.map((review) => this.createReviewSummary(review, sourceDocumentById));
    const pendingReviewBundles = this.createReviewBundles({
      reviews: pendingReviews,
      sourceRefsByDocumentId,
      assetUpdatesByDocumentId,
      sourceDocumentById,
      characters,
      chapters,
      volumes,
      foreshadows,
    });
    const pendingConflictBundles = this.createPendingConflictBundles(pendingReviewBundles);
    const recentSourceRefs = sourceRefs.slice(0, 10).map((sourceRef) => this.createSourceRefSummary(sourceRef, sourceDocumentById));
    const followUpTaskStateIndex = this.createFollowUpTaskStateIndex(followUpTaskStates);
    const derivedAttentionChapters = this.createAttentionChapterSummaries(pendingReviewBundles);
    const followUpQueue = this.createFollowUpQueue(derivedAttentionChapters, followUpTaskStateIndex);
    const attentionChapters = [...followUpQueue.formalReviewChapters, ...followUpQueue.watchChapters];
    const reviewStats = this.createReviewStats(
      reviewRows,
      pendingReviewBundles.length,
      pendingReviewBundles.filter((bundle) => bundle.isAutoApprovable).length,
      pendingReviewBundles.filter((bundle) => bundle.actionPlan.lane === "review").length,
      pendingReviewBundles.filter((bundle) => bundle.actionPlan.lane === "conflict").length,
      pendingReviewBundles.filter((bundle) => bundle.riskNature === "information-gap").length,
      pendingReviewBundles.filter((bundle) => bundle.riskNature === "confidence-review").length,
      pendingReviewBundles.filter((bundle) => bundle.riskNature === "format-blocker").length,
      pendingReviewBundles.filter((bundle) => bundle.riskNature === "factual-conflict").length,
      followUpQueue.formalReviewTasks.length,
      followUpQueue.watchChapters.length,
      attentionChapters.length,
    );
    const fileSourceSummaries = fileSources.map((fileSource) =>
      this.createFileSourceSummary(fileSource, sourceDocumentsByFileSource.get(fileSource.id) ?? [], reviewRows),
    );

    return {
      work,
      stats: {
        volumeCount: volumes.length,
        chapterCount: chapters.length,
        characterCount: characters.length,
        foreshadowCount: foreshadows.length,
        relationCount: graph.edges.length,
        sourceCount: fileSourceSummaries.length,
        pendingReviewCount: reviewRows.length,
      },
      volumes,
      characters,
      chapters,
      graph,
      latestChapter: chapters.at(-1),
      fileSources: fileSourceSummaries,
      pendingReviewBundles,
      pendingConflictBundles,
      recentSourceRefs,
      attentionChapters,
      followUpQueue,
      pendingReviews,
      reviewStats,
    };
  }

  private async listVolumes(projectId: string): Promise<VolumeOutline[]> {
    const volumeRows = await this.client.db
      .select()
      .from(volumesV2Table)
      .where(eq(volumesV2Table.projectId, projectId))
      .orderBy(asc(volumesV2Table.sortOrder));

    return volumeRows.map((volumeRow) => {
      const extraJson = (volumeRow.extraJson ?? {}) as Record<string, unknown>;
      return {
        id: volumeRow.id,
        workId: volumeRow.projectId,
        order: volumeRow.sortOrder,
        title: volumeRow.title,
        goal: volumeRow.phaseGoal,
        mainConflict: volumeRow.mainConflict,
        entryHook: String(extraJson.entryHook ?? "待补开篇钩子"),
        climax: String(extraJson.climax ?? "待补高潮节点"),
        payoff: String(extraJson.payoff ?? "待补回收节点"),
        mustDeliverInfo: readStringArray(extraJson.mustDeliverInfo),
        keyCharacters: readStringArray(extraJson.keyCharacters),
        plannedChapterCount: volumeRow.plannedChapterCount,
      };
    });
  }

  private async listForeshadows(projectId: string): Promise<ForeshadowLedgerItem[]> {
    const foreshadowRows = await this.client.db
      .select()
      .from(foreshadowsV2Table)
      .where(eq(foreshadowsV2Table.projectId, projectId))
      .orderBy(asc(foreshadowsV2Table.createdAt));

    return foreshadowRows.map((foreshadowRow) => ({
      id: foreshadowRow.id,
      workId: foreshadowRow.projectId,
      seedChapterId: foreshadowRow.seedChapterId,
      description: foreshadowRow.description,
      narrativePurpose: foreshadowRow.narrativePurpose,
      expectedPayoffVolumeId: undefined,
      expectedPayoffChapterId: foreshadowRow.expectedPayoffChapterId ?? undefined,
      actualPayoffChapterId: foreshadowRow.actualPayoffChapterId ?? undefined,
      status: foreshadowRow.payoffStatus as ForeshadowLedgerItem["status"],
    }));
  }

  private buildCharacterGraph(
    characters: CharacterCard[],
    relationSourceRefs: Map<string, SyncSourceRefRecord[]>,
    sourceDocumentById: Map<string, WorkbenchSourceDocumentIndex>,
  ): WorkbenchCharacterGraph {
    const nodes: WorkbenchCharacterGraphNode[] = characters.map((character) => ({
      characterId: character.id,
      name: character.name,
      role: character.role,
      archetype: character.archetype,
    }));

    const characterNameById = new Map(characters.map((character) => [character.id, character.name]));
    const edges: WorkbenchCharacterGraphEdge[] = [];

    for (const character of characters) {
      for (const relationship of character.relationships) {
        const relationAssetId = `${character.id}:${relationship.targetCharacterId}:${relationship.publicLabel}`;
        const relationRefRows = relationSourceRefs.get(relationAssetId) ?? [];
        const latestRelationRef = relationRefRows[0];
        const latestRelationDocument = latestRelationRef?.sourceDocumentId
          ? sourceDocumentById.get(latestRelationRef.sourceDocumentId)
          : undefined;

        edges.push({
          sourceCharacterId: character.id,
          sourceCharacterName: character.name,
          targetCharacterId: relationship.targetCharacterId,
          targetCharacterName: characterNameById.get(relationship.targetCharacterId) ?? relationship.targetCharacterId,
          publicLabel: relationship.publicLabel,
          privateLabel: relationship.privateLabel,
          trustLevel: relationship.trustLevel,
          tensionLevel: relationship.tensionLevel,
          sourceRefCount: relationRefRows.length,
          latestSourceDocumentId: latestRelationRef?.sourceDocumentId,
          latestSourcePath: latestRelationDocument?.relativePath,
          latestEvidenceQuote: latestRelationRef?.evidenceQuote,
        });
      }
    }

    return { nodes, edges };
  }

  private sortSourceDocuments(
    documents: Array<{
      id: string;
      relativePath: string;
      documentKind: string;
      syncStatus: string;
      lastModifiedAt: string;
      mappedScopeType?: string;
      mappedScopeId?: string;
    }>,
  ): WorkbenchSourceDocumentIndex[] {
    return [...documents]
      .sort((left, right) => right.lastModifiedAt.localeCompare(left.lastModifiedAt, "zh-CN"))
      .map((document) => ({
        id: document.id,
        relativePath: document.relativePath,
        documentKind: document.documentKind,
        syncStatus: document.syncStatus,
        lastModifiedAt: document.lastModifiedAt,
        mappedScopeType: document.mappedScopeType,
        mappedScopeId: document.mappedScopeId,
      }));
  }

  private createFileSourceSummary(
    fileSource: SyncFileSourceRecord,
    sourceDocuments: WorkbenchSourceDocumentIndex[],
    reviewRows: SyncReviewQueueRecord[],
  ): WorkbenchFileSourceSummary {
    const sourceDocumentIdSet = new Set(sourceDocuments.map((document) => document.id));
    const reviewPendingCount = reviewRows.filter(
      (review) => review.sourceDocumentId && sourceDocumentIdSet.has(review.sourceDocumentId),
    ).length;
    const latestDocumentPath = sourceDocuments[0]?.relativePath;

    return {
      id: fileSource.id,
      label: fileSource.label,
      sourceKind: fileSource.sourceKind,
      rootPath: fileSource.rootPath,
      chapterPath: fileSource.chapterPath,
      outlinePath: fileSource.outlinePath,
      exportPath: fileSource.exportPath,
      status: fileSource.status,
      lastScannedAt: fileSource.lastScannedAt,
      documentCount: sourceDocuments.length,
      pendingDocumentCount: sourceDocuments.filter((document) =>
        document.syncStatus === "pending" || document.syncStatus === "review_pending",
      ).length,
      missingDocumentCount: sourceDocuments.filter((document) => document.syncStatus === "missing").length,
      reviewPendingCount,
      latestDocumentPath,
    };
  }

  private createReviewSummary(
    review: SyncReviewQueueRecord,
    sourceDocumentById: Map<string, WorkbenchSourceDocumentIndex>,
  ): WorkbenchReviewItemSummary {
    const sourceDocument = review.sourceDocumentId ? sourceDocumentById.get(review.sourceDocumentId) : undefined;

    return {
      id: review.id,
      syncRunId: review.syncRunId,
      reviewKind: review.reviewKind,
      severity: review.severity,
      status: review.status,
      summary: review.summary,
      sourceType: review.sourceType,
      sourceId: review.sourceId,
      sourceDocumentId: review.sourceDocumentId,
      sourcePath: sourceDocument?.relativePath,
      documentKind: sourceDocument?.documentKind,
      detailJson: review.detailJson,
    };
  }

  private createReviewBundles(input: {
    reviews: WorkbenchReviewItemSummary[];
    sourceRefsByDocumentId: Map<string, SyncSourceRefRecord[]>;
    assetUpdatesByDocumentId: Map<string, SyncAssetUpdateRecord[]>;
    sourceDocumentById: Map<string, WorkbenchSourceDocumentIndex>;
    characters: CharacterCard[];
    chapters: ChapterCard[];
    volumes: VolumeOutline[];
    foreshadows: ForeshadowLedgerItem[];
  }): WorkbenchReviewBundleSummary[] {
    const bundleMap = new Map<string, WorkbenchReviewBundleSummary>();

    for (const review of input.reviews) {
      const bundleId = this.buildReviewBundleId(review);
      const existingBundle = bundleMap.get(bundleId);
      const reviewHints = Array.isArray(review.detailJson.reviewHints) ? review.detailJson.reviewHints.length : 0;
      const sourceRefRows = review.sourceDocumentId ? (input.sourceRefsByDocumentId.get(review.sourceDocumentId) ?? []) : [];
      const latestSourceRef = sourceRefRows[0];
      const riskAssessment = assessReviewRisk({
        reviewKind: review.reviewKind,
        severity: review.severity,
        detailJson: review.detailJson,
      });
      const impactSummary = review.sourceDocumentId
        ? buildReviewBundleImpactSummary({
            sourceDocument: input.sourceDocumentById.get(review.sourceDocumentId),
            assetUpdates: input.assetUpdatesByDocumentId.get(review.sourceDocumentId) ?? [],
            characters: input.characters,
            chapters: input.chapters,
            volumes: input.volumes,
            foreshadows: input.foreshadows,
          })
        : undefined;

      if (!existingBundle) {
        bundleMap.set(bundleId, {
          id: bundleId,
          title: review.sourcePath ?? `Source ${this.buildSyncRunLabel(review.syncRunId)}`,
          summary: this.buildReviewBundleSummary(review, 1),
          sourceDocumentId: review.sourceDocumentId,
          sourcePath: review.sourcePath,
          documentKind: review.documentKind,
          syncRunId: review.syncRunId,
          severity: review.severity,
          blockingLevel: riskAssessment.blockingLevel,
          pendingItemCount: 1,
          lowSeverityCount: review.severity === "low" ? 1 : 0,
          mediumSeverityCount: review.severity === "medium" ? 1 : 0,
          highSeverityCount: review.severity === "high" ? 1 : 0,
          characterCandidateCount: this.readNumericSignal(review.detailJson, "characterCandidateCount"),
          relationshipCandidateCount: this.readNumericSignal(review.detailJson, "relationshipCandidateCount"),
          foreshadowCandidateCount: this.readNumericSignal(review.detailJson, "foreshadowCandidateCount"),
          timelineCandidateCount: this.readNumericSignal(review.detailJson, "timelineCandidateCount"),
          reviewHintCount: reviewHints,
          reviewKinds: [review.reviewKind],
          riskNature: riskAssessment.nature,
          riskCategories: riskAssessment.categories,
          riskReasons: riskAssessment.reasons,
          recommendedActions: riskAssessment.recommendedActions,
          autoApprovalReasons: riskAssessment.autoApprovalReasons,
          sourceRefCount: sourceRefRows.length,
          latestReferenceKind: latestSourceRef?.referenceKind,
          latestEvidenceQuote: latestSourceRef?.evidenceQuote,
          impactSummary,
          isAutoApprovable: false,
          actionPlan: {
            lane: "review",
            strategy: "review-source-evidence",
            title: "等待动作分发",
            primaryAction: "等待动作分发",
            steps: [],
            systemActions: [],
          },
          items: [review],
        });
        continue;
      }

      existingBundle.items.push(review);
      existingBundle.pendingItemCount += 1;
      existingBundle.lowSeverityCount += review.severity === "low" ? 1 : 0;
      existingBundle.mediumSeverityCount += review.severity === "medium" ? 1 : 0;
      existingBundle.highSeverityCount += review.severity === "high" ? 1 : 0;
      existingBundle.characterCandidateCount += this.readNumericSignal(review.detailJson, "characterCandidateCount");
      existingBundle.relationshipCandidateCount += this.readNumericSignal(review.detailJson, "relationshipCandidateCount");
      existingBundle.foreshadowCandidateCount += this.readNumericSignal(review.detailJson, "foreshadowCandidateCount");
      existingBundle.timelineCandidateCount += this.readNumericSignal(review.detailJson, "timelineCandidateCount");
      existingBundle.reviewHintCount += reviewHints;
      existingBundle.riskCategories = this.mergeUniqueStrings(existingBundle.riskCategories, riskAssessment.categories);
      existingBundle.riskReasons = this.mergeUniqueStrings(existingBundle.riskReasons, riskAssessment.reasons);
      existingBundle.recommendedActions = this.mergeUniqueStrings(existingBundle.recommendedActions, riskAssessment.recommendedActions);
      existingBundle.autoApprovalReasons = this.mergeUniqueStrings(existingBundle.autoApprovalReasons, riskAssessment.autoApprovalReasons);
      existingBundle.sourceRefCount = Math.max(existingBundle.sourceRefCount, sourceRefRows.length);
      existingBundle.latestReferenceKind ??= latestSourceRef?.referenceKind;
      existingBundle.latestEvidenceQuote ??= latestSourceRef?.evidenceQuote;
      existingBundle.impactSummary ??= impactSummary;
      if (!existingBundle.reviewKinds.includes(review.reviewKind)) {
        existingBundle.reviewKinds.push(review.reviewKind);
      }
      if (this.getSeverityRank(review.severity) > this.getSeverityRank(existingBundle.severity)) {
        existingBundle.severity = review.severity;
      }
      if (this.getBlockingLevelRank(riskAssessment.blockingLevel) > this.getBlockingLevelRank(existingBundle.blockingLevel)) {
        existingBundle.blockingLevel = riskAssessment.blockingLevel;
      }
      if (this.getRiskNatureRank(riskAssessment.nature) > this.getRiskNatureRank(existingBundle.riskNature)) {
        existingBundle.riskNature = riskAssessment.nature;
      }
      existingBundle.summary = this.buildReviewBundleSummary(review, existingBundle.pendingItemCount);
    }

    return [...bundleMap.values()]
      .map((bundle) => {
        const isAutoApprovable = this.isReviewBundleAutoApprovable(bundle);
        return {
          ...bundle,
          isAutoApprovable,
          actionPlan: buildWorkbenchActionPlan({
            blockingLevel: bundle.blockingLevel,
            riskNature: bundle.riskNature,
            reviewKinds: bundle.reviewKinds,
            recommendedActions: bundle.recommendedActions,
            isAutoApprovable,
            impactSummary: bundle.impactSummary,
          }),
        };
      })
      .sort((left, right) => {
        const severityDelta = this.getSeverityRank(right.severity) - this.getSeverityRank(left.severity);
        if (severityDelta !== 0) {
          return severityDelta;
        }
        return right.pendingItemCount - left.pendingItemCount;
      });
  }

  private createPendingConflictBundles(
    bundles: WorkbenchReviewBundleSummary[],
  ): WorkbenchReviewBundleSummary[] {
    return bundles
      .filter((bundle) => bundle.actionPlan.lane === "conflict")
      .sort((left, right) => {
        const blockingDelta = this.getBlockingLevelRank(right.blockingLevel) - this.getBlockingLevelRank(left.blockingLevel);
        if (blockingDelta !== 0) {
          return blockingDelta;
        }
        return this.getSeverityRank(right.severity) - this.getSeverityRank(left.severity);
      })
      .slice(0, 6);
  }

  private createSourceRefSummary(
    sourceRef: SyncSourceRefRecord,
    sourceDocumentById: Map<string, WorkbenchSourceDocumentIndex>,
  ): WorkbenchSourceRefSummary {
    const sourceDocument = sourceRef.sourceDocumentId ? sourceDocumentById.get(sourceRef.sourceDocumentId) : undefined;

    return {
      id: sourceRef.id,
      assetType: sourceRef.assetType,
      assetId: sourceRef.assetId,
      referenceKind: sourceRef.referenceKind,
      locator: sourceRef.locator,
      sourceDocumentId: sourceRef.sourceDocumentId,
      sourcePath: sourceDocument?.relativePath,
      documentKind: sourceDocument?.documentKind,
      evidenceQuote: sourceRef.evidenceQuote,
      updatedAt: sourceRef.updatedAt,
    };
  }

  private createSourceRefIndex(sourceRefs: SyncSourceRefRecord[]): Map<string, SyncSourceRefRecord[]> {
    const index = new Map<string, SyncSourceRefRecord[]>();

    for (const sourceRef of sourceRefs) {
      const bucket = index.get(sourceRef.assetId);
      if (bucket) {
        bucket.push(sourceRef);
      } else {
        index.set(sourceRef.assetId, [sourceRef]);
      }
    }

    return index;
  }

  private createSourceDocumentSourceRefIndex(sourceRefs: SyncSourceRefRecord[]): Map<string, SyncSourceRefRecord[]> {
    const index = new Map<string, SyncSourceRefRecord[]>();

    for (const sourceRef of sourceRefs) {
      if (!sourceRef.sourceDocumentId) {
        continue;
      }

      const bucket = index.get(sourceRef.sourceDocumentId);
      if (bucket) {
        bucket.push(sourceRef);
      } else {
        index.set(sourceRef.sourceDocumentId, [sourceRef]);
      }
    }

    return index;
  }

  private createAssetUpdateIndex(assetUpdates: SyncAssetUpdateRecord[]): Map<string, SyncAssetUpdateRecord[]> {
    const index = new Map<string, SyncAssetUpdateRecord[]>();

    for (const assetUpdate of assetUpdates) {
      if (!assetUpdate.sourceDocumentId) {
        continue;
      }

      const bucket = index.get(assetUpdate.sourceDocumentId);
      if (bucket) {
        bucket.push(assetUpdate);
      } else {
        index.set(assetUpdate.sourceDocumentId, [assetUpdate]);
      }
    }

    return index;
  }


  private createFollowUpTaskStateIndex(
    taskStates: SyncFollowUpTaskStateRecord[],
  ): Map<string, SyncFollowUpTaskStateRecord> {
    const index = new Map<string, SyncFollowUpTaskStateRecord>();

    for (const taskState of taskStates) {
      index.set(`${taskState.taskKind}:${taskState.chapterId}`, taskState);
    }

    return index;
  }

  private createAttentionChapterSummaries(
    bundles: WorkbenchReviewBundleSummary[],
  ): WorkbenchAttentionChapterSummary[] {
    const index = new Map<string, {
      chapterId: string;
      label: string;
      triggerBundleCount: number;
      reviewBundleCount: number;
      conflictBundleCount: number;
      sourceDocumentIds: Set<string>;
      riskNatures: Set<string>;
      strategies: Set<string>;
      reasons: Set<string>;
    }>();

    for (const bundle of bundles) {
      if (bundle.actionPlan.lane === "auto" || !bundle.impactSummary?.recommendedReviewChapters.length) {
        continue;
      }

      const isConflictLane = bundle.actionPlan.lane === "conflict";

      for (const chapter of bundle.impactSummary.recommendedReviewChapters) {
        const current = index.get(chapter.chapterId);
        if (current) {
          current.triggerBundleCount += 1;
          current.reviewBundleCount += isConflictLane ? 0 : 1;
          current.conflictBundleCount += isConflictLane ? 1 : 0;
          if (bundle.sourceDocumentId) {
            current.sourceDocumentIds.add(bundle.sourceDocumentId);
          }
          current.riskNatures.add(bundle.riskNature);
          current.strategies.add(bundle.actionPlan.strategy);
          current.reasons.add(chapter.reason);
          continue;
        }

        index.set(chapter.chapterId, {
          chapterId: chapter.chapterId,
          label: chapter.label,
          triggerBundleCount: 1,
          reviewBundleCount: isConflictLane ? 0 : 1,
          conflictBundleCount: isConflictLane ? 1 : 0,
          sourceDocumentIds: new Set(bundle.sourceDocumentId ? [bundle.sourceDocumentId] : []),
          riskNatures: new Set([bundle.riskNature]),
          strategies: new Set([bundle.actionPlan.strategy]),
          reasons: new Set([chapter.reason]),
        });
      }
    }

    return [...index.values()]
      .map((item) => {
        const followUpMode = this.resolveAttentionChapterFollowUpMode({
          triggerBundleCount: item.triggerBundleCount,
          reviewBundleCount: item.reviewBundleCount,
          conflictBundleCount: item.conflictBundleCount,
          sourceDocumentCount: item.sourceDocumentIds.size,
          riskNatures: item.riskNatures,
        });
        const priority: WorkbenchAttentionChapterSummary["priority"] =
          followUpMode === "formal-review" || item.triggerBundleCount >= 3 ? "high" : "normal";

        return {
          chapterId: item.chapterId,
          label: item.label,
          followUpMode,
          priority,
          triggerBundleCount: item.triggerBundleCount,
          reviewBundleCount: item.reviewBundleCount,
          conflictBundleCount: item.conflictBundleCount,
          sourceDocumentCount: item.sourceDocumentIds.size,
          riskNatures: [...item.riskNatures],
          strategies: [...item.strategies],
          reasonSummary: [...item.reasons].slice(0, 2).join("；"),
          recommendedAction: followUpMode === "formal-review"
            ? "加入正式复核队列，优先回看当前章和受影响章节的连续性。"
            : "先作为提醒回看，处理完当前变更包后顺手检查后续章节。",
        };
      })
      .sort((left, right) => {
        const priorityDelta = Number(right.priority === "high") - Number(left.priority === "high");
        if (priorityDelta !== 0) {
          return priorityDelta;
        }
        const triggerDelta = right.triggerBundleCount - left.triggerBundleCount;
        if (triggerDelta !== 0) {
          return triggerDelta;
        }
        return left.label.localeCompare(right.label, "zh-CN");
      })
      .slice(0, 8);
  }

  private createFollowUpQueue(
    attentionChapters: WorkbenchAttentionChapterSummary[],
    taskStateIndex: Map<string, SyncFollowUpTaskStateRecord>,
  ): WorkbenchFollowUpQueueSummary {
    const activeFormalReviewChapters: WorkbenchAttentionChapterSummary[] = [];
    const watchChapters = attentionChapters.filter((chapter) => chapter.followUpMode === "watch");
    const formalReviewTasks: WorkbenchFollowUpTaskSummary[] = [];
    const recentResolvedTasks: WorkbenchFollowUpTaskSummary[] = [];

    for (const chapter of attentionChapters) {
      if (chapter.followUpMode !== "formal-review") {
        continue;
      }

      const taskFingerprint = this.buildFormalReviewTaskFingerprint(chapter);
      const persistedTaskState = taskStateIndex.get(`formal-review:${chapter.chapterId}`);
      const isCurrentFingerprint = persistedTaskState && persistedTaskState.taskFingerprint === taskFingerprint;
      const taskStatus = isCurrentFingerprint
        ? (persistedTaskState.taskStatus as WorkbenchFollowUpTaskSummary["taskStatus"])
        : "pending";
      const taskOutcome = isCurrentFingerprint
        ? (persistedTaskState.taskOutcome as WorkbenchFollowUpTaskSummary["taskOutcome"] | undefined)
        : undefined;

      const taskSummary: WorkbenchFollowUpTaskSummary = {
        id: `follow-up:${chapter.chapterId}`,
        chapterId: chapter.chapterId,
        label: chapter.label,
        taskKind: "formal-review",
        taskFingerprint,
        taskStatus,
        taskOutcome,
        outcomeSummary: isCurrentFingerprint ? persistedTaskState?.outcomeSummary : undefined,
        priority: chapter.priority,
        summary: this.buildFormalReviewTaskSummary(chapter),
        nextAction: chapter.recommendedAction,
        decisionNote: isCurrentFingerprint ? persistedTaskState?.decisionNote : undefined,
        decidedAt: isCurrentFingerprint ? persistedTaskState?.decidedAt : undefined,
        triggerBundleCount: chapter.triggerBundleCount,
        reviewBundleCount: chapter.reviewBundleCount,
        conflictBundleCount: chapter.conflictBundleCount,
        sourceDocumentCount: chapter.sourceDocumentCount,
      };

      if (taskStatus === "completed" || taskStatus === "dismissed") {
        recentResolvedTasks.push(taskSummary);
        continue;
      }

      activeFormalReviewChapters.push(chapter);
      formalReviewTasks.push(taskSummary);
    }

    recentResolvedTasks.sort((left, right) => {
      const rightTime = right.decidedAt ?? "";
      const leftTime = left.decidedAt ?? "";
      return rightTime.localeCompare(leftTime, "zh-CN");
    });

    return {
      formalReviewChapters: activeFormalReviewChapters,
      watchChapters,
      formalReviewTasks,
      recentResolvedTasks: recentResolvedTasks.slice(0, 6),
      highestPriorityChapter: activeFormalReviewChapters[0] ?? watchChapters[0],
      highestPriorityTask: formalReviewTasks[0],
    };
  }
  private buildFormalReviewTaskFingerprint(chapter: WorkbenchAttentionChapterSummary): string {
    return createHash("sha1")
      .update(
        JSON.stringify({
          chapterId: chapter.chapterId,
          priority: chapter.priority,
          triggerBundleCount: chapter.triggerBundleCount,
          reviewBundleCount: chapter.reviewBundleCount,
          conflictBundleCount: chapter.conflictBundleCount,
          sourceDocumentCount: chapter.sourceDocumentCount,
          riskNatures: chapter.riskNatures,
          strategies: chapter.strategies,
          reasonSummary: chapter.reasonSummary,
          recommendedAction: chapter.recommendedAction,
        }),
      )
      .digest("hex");
  }

  private buildFormalReviewTaskSummary(chapter: WorkbenchAttentionChapterSummary): string {
    const summaryParts = [
      "触发变更包 " + chapter.triggerBundleCount,
      "复核包 " + chapter.reviewBundleCount,
      "冲突包 " + chapter.conflictBundleCount,
    ];

    if (chapter.sourceDocumentCount > 0) {
      summaryParts.push("来源文档 " + chapter.sourceDocumentCount);
    }

    return summaryParts.join(" / ") + " / " + chapter.reasonSummary;
  }

  private resolveAttentionChapterFollowUpMode(input: {
    triggerBundleCount: number;
    reviewBundleCount: number;
    conflictBundleCount: number;
    sourceDocumentCount: number;
    riskNatures: Set<string>;
  }): WorkbenchAttentionChapterSummary["followUpMode"] {
    if (input.conflictBundleCount > 0) {
      return "formal-review";
    }
    if (input.riskNatures.has("factual-conflict")) {
      return "formal-review";
    }
    if (input.triggerBundleCount >= 3) {
      return "formal-review";
    }
    if (input.sourceDocumentCount >= 2 && input.reviewBundleCount >= 2) {
      return "formal-review";
    }
    return "watch";
  }

  private createReviewStats(
    reviews: SyncReviewQueueRecord[],
    bundleCount: number,
    autoApprovableBundleCount: number,
    reviewBundleCount: number,
    conflictBundleCount: number,
    informationGapBundleCount: number,
    confidenceReviewBundleCount: number,
    formatBlockerBundleCount: number,
    factualConflictBundleCount: number,
    formalReviewChapterCount: number,
    watchChapterCount: number,
    attentionChapterCount: number,
  ): WorkbenchReviewStats {
    return {
      bundleCount,
      autoApprovableBundleCount,
      reviewBundleCount,
      conflictBundleCount,
      informationGapBundleCount,
      confidenceReviewBundleCount,
      formatBlockerBundleCount,
      factualConflictBundleCount,
      formalReviewChapterCount,
      watchChapterCount,
      attentionChapterCount,
      pendingCount: reviews.length,
      lowSeverityCount: reviews.filter((review) => review.severity === "low").length,
      mediumSeverityCount: reviews.filter((review) => review.severity === "medium").length,
      highSeverityCount: reviews.filter((review) => review.severity === "high").length,
    };
  }

  private buildReviewBundleId(review: WorkbenchReviewItemSummary): string {
    if (review.sourceDocumentId) {
      return `source-document:${review.sourceDocumentId}`;
    }
    if (review.syncRunId) {
      return `sync-run:${review.syncRunId}:${review.sourceType}:${review.sourceId ?? review.reviewKind}`;
    }
    return `fallback:${review.sourceType}:${review.sourceId ?? review.reviewKind}`;
  }

  private buildReviewBundleSummary(review: WorkbenchReviewItemSummary, pendingItemCount: number): string {
    const originLabel = review.documentKind ?? review.reviewKind;
    return `${pendingItemCount} 条待处理项 / ${originLabel}`;
  }

  private buildSyncRunLabel(syncRunId?: string): string {
    return syncRunId ? syncRunId.slice(0, 8) : "pending";
  }

  private readNumericSignal(detailJson: Record<string, unknown>, field: string): number {
    const value = detailJson[field];
    return typeof value === "number" ? value : 0;
  }

  private isReviewBundleAutoApprovable(bundle: WorkbenchReviewBundleSummary): boolean {
    return (
      bundle.blockingLevel === "none" &&
      bundle.mediumSeverityCount === 0 &&
      bundle.highSeverityCount === 0 &&
      bundle.reviewHintCount === 0 &&
      bundle.riskCategories.length === 0 &&
      bundle.autoApprovalReasons.length > 0
    );
  }

  private getSeverityRank(severity: string): number {
    switch (severity) {
      case "high":
        return 3;
      case "medium":
        return 2;
      case "low":
        return 1;
      default:
        return 0;
    }
  }

  private getBlockingLevelRank(level: "none" | "review" | "conflict"): number {
    switch (level) {
      case "conflict":
        return 2;
      case "review":
        return 1;
      default:
        return 0;
    }
  }

  private getRiskNatureRank(nature: string): number {
    switch (nature) {
      case "factual-conflict":
        return 4;
      case "format-blocker":
        return 3;
      case "information-gap":
        return 2;
      case "confidence-review":
        return 1;
      default:
        return 0;
    }
  }

  private mergeUniqueStrings(base: string[], additions: string[]): string[] {
    const merged = new Set(base);
    for (const item of additions) {
      if (item.trim()) {
        merged.add(item.trim());
      }
    }
    return [...merged];
  }

  private createEmptyStats(): WorkbenchProjectStats {
    return {
      volumeCount: 0,
      chapterCount: 0,
      characterCount: 0,
      foreshadowCount: 0,
      relationCount: 0,
      sourceCount: 0,
      pendingReviewCount: 0,
    };
  }
}
