import fs from "node:fs";
import path from "node:path";

import YAML from "yaml";

import type { WorkProfile } from "@aifiction/schemas";

import { type SqliteClient, getSqliteClient, resolveWorkspaceRoot } from "../client";
import { SqliteProjectCatalogRepository, SqliteSyncSourceRepository, type SyncFileSourceRecord } from "../repositories/v2";
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

export interface WorkspaceProtocol {
  workspace_id: string;
  workspace_name: string;
  root_dir: string;
  books_dir?: string;
  active_book_id?: string;
  default_book_id?: string;
  book_index: WorkspaceBookIndexEntry[];
  defaults?: WorkspaceDefaults;
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
  contextPackDirectoryPath: string;
  latestContextPacks: ProtocolContextPackSummary[];
}

export interface GeneratedProtocolPack {
  kind: "writing-pack" | "risk-investigation-pack";
  absolutePath: string;
  displayPath: string;
  updatedAt: string;
}

export class WorkspaceProtocolService {
  private readonly workspaceRoot: string;
  private readonly projectCatalogRepository: SqliteProjectCatalogRepository;
  private readonly syncSourceRepository: SqliteSyncSourceRepository;
  private readonly workbenchService: NovelWorkbenchService;

  constructor(private readonly client: SqliteClient = getSqliteClient()) {
    this.workspaceRoot = resolveWorkspaceRoot();
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
    const content = this.buildWritingPackMarkdown(summary, snapshot, book);
    return this.writeContextPack(summary, "writing-pack", content);
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

    return {
      book_id: snapshot.work.slug,
      title: snapshot.work.title,
      genre: snapshot.work.genre,
      platform: snapshot.work.targetPlatform,
      stage: existing?.stage ?? (snapshot.work.status === "planning" ? "planning" : "drafting"),
      status: snapshot.work.status,
      active_volume: existing?.active_volume ?? resolvedActiveVolume ?? 1,
      active_chapter: existing?.active_chapter ?? latestChapter?.order ?? 1,
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
      last_outputs: {
        latest_chapter_file: existing?.last_outputs?.latest_chapter_file ?? latestDocumentPath,
        latest_summary_file: existing?.last_outputs?.latest_summary_file ?? "03-中间产物/latest-summary.md",
        latest_review_file: existing?.last_outputs?.latest_review_file ?? "03-中间产物/latest-review.md",
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
  ): string {
    const recentChapters = [...snapshot.chapters].slice(-3).reverse();
    const recentCharacters = snapshot.characters.slice(0, 5);
    const sourceOfTruth = book.source_of_truth ?? {};
    const hardConstraints = book.hard_constraints ?? [];

    return [
      `# 写作包：${snapshot.work.title}`,
      "",
      `- 生成时间：${new Date().toISOString()}`,
      `- 当前阶段：${book.stage ?? snapshot.work.status}`,
      `- 当前焦点：${book.current_focus?.task_label ?? "待补当前任务"}`,
      `- 目标：${book.current_focus?.goal ?? snapshot.work.tagline}`,
      "",
      "## 关键信息锚点",
      `- 协议文件：${this.toDisplayPath(summary.bookFilePath)}`,
      `- 作品目录：${this.toDisplayPath(summary.bookRootPath)}`,
      `- 设定文件：${sourceOfTruth.project_brief ?? "待补"}`,
      `- 世界设定：${sourceOfTruth.world_settings ?? "待补"}`,
      `- 角色设定：${sourceOfTruth.character_settings ?? "待补"}`,
      `- 全书大纲：${sourceOfTruth.master_outline ?? "待补"}`,
      `- 当前卷纲：${sourceOfTruth.active_volume_outline ?? "待补"}`,
      "",
      "## 必须遵守的硬约束",
      ...(hardConstraints.length ? hardConstraints.map((item) => `- ${item}`) : ["- 当前还没有写入硬约束，请先确认作品定位。"]),
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
      "## 系统建议的下一步",
      `- 优先完成：${book.current_focus?.summary ?? "继续按照当前焦点任务推进。"}`,
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
}

