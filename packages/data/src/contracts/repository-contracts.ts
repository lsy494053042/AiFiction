import type {
  ChapterCard,
  CharacterCard,
  ContinuityReport,
  DraftArtifact,
  ForeshadowLedgerItem,
  TimelineEvent,
  VolumeOutline,
  WorkProfile,
} from "@aifiction/schemas";

/**
 * 分页请求。
 * 提前约定基础查询协议，避免后续每个仓储都自己发明一套分页参数。
 */
export interface RepositoryPageRequest {
  limit: number;
  cursor?: string;
}

/**
 * 写入上下文。
 * 未来做审计、多人协作或批量导入时，这层会非常有价值。
 */
export interface RepositoryWriteContext {
  actorId?: string;
  reason?: string;
  source?: string;
  idempotencyKey?: string;
}

/**
 * 项目目录仓储。
 * 负责作品级入口和概览信息。
 */
export interface ProjectCatalogRepository {
  listProjects(page?: RepositoryPageRequest): Promise<WorkProfile[]>;
  getProjectBySlug(slug: string): Promise<WorkProfile | null>;
  saveProject(project: WorkProfile, context?: RepositoryWriteContext): Promise<void>;
}

/**
 * 叙事资产仓储。
 * 负责角色、卷纲、章卡、伏笔、时间线等“作品内容资产”。
 */
export interface NarrativeAssetRepository {
  saveCharacter(character: CharacterCard, context?: RepositoryWriteContext): Promise<void>;
  saveVolume(volume: VolumeOutline, context?: RepositoryWriteContext): Promise<void>;
  saveChapter(chapter: ChapterCard, context?: RepositoryWriteContext): Promise<void>;
  saveForeshadow(foreshadow: ForeshadowLedgerItem, context?: RepositoryWriteContext): Promise<void>;
  saveTimelineEvent(event: TimelineEvent, context?: RepositoryWriteContext): Promise<void>;
  listCharacters(projectId: string): Promise<CharacterCard[]>;
  listChapters(projectId: string, volumeId?: string): Promise<ChapterCard[]>;
}

/**
 * 记忆快照仓储。
 * 把角色、地点、势力等动态状态与正文解耦，便于连续性检查和状态回写。
 */
export interface MemorySnapshotRepository {
  saveEntitySnapshot(input: {
    projectId: string;
    entityType: string;
    entityId: string;
    chapterId?: string;
    snapshotLabel: string;
    stateJson: Record<string, unknown>;
  }, context?: RepositoryWriteContext): Promise<void>;
  listEntitySnapshots(input: {
    projectId: string;
    entityType: string;
    entityId: string;
  }): Promise<Array<{
    id: string;
    chapterId?: string;
    snapshotLabel: string;
    stateJson: Record<string, unknown>;
  }>>;
}

/**
 * Artifact 仓储。
 * 正文、章卡版本、审校报告等长文本与版本化内容统一走这里。
 */
export interface ArtifactRepository {
  saveArtifactVersion(artifact: DraftArtifact, context?: RepositoryWriteContext): Promise<void>;
  listArtifactVersions(scopeId: string, artifactKind?: string): Promise<DraftArtifact[]>;
}

/**
 * 连续性审校仓储。
 * 当前先定义接口，后续再把报告正式纳入 artifact/version 体系。
 */
export interface ContinuityRepository {
  saveContinuityReport(report: ContinuityReport, context?: RepositoryWriteContext): Promise<void>;
}

/**
 * 运行日志仓储。
 * 后续无论走普通 workflow 还是 agent 图，都应该能复用这层协议。
 */
export interface PipelineRunRepository {
  startRun(input: {
    projectId: string;
    scopeType: string;
    scopeId: string;
    workflowName: string;
    workflowVersion: string;
  }): Promise<string>;
  appendRunStep(input: {
    runId: string;
    stepKey: string;
    stepType: string;
    status: string;
    inputArtifactId?: string;
    outputArtifactId?: string;
  }): Promise<string>;
  finishRun(runId: string, status: string): Promise<void>;
}

/**
 * Prompt 注册仓储。
 * 提示词模板和版本独立沉淀，后续才能做 prompt 追溯、回滚和对比。
 */
export interface PromptRegistryRepository {
  saveTemplate(input: {
    projectId?: string;
    templateKey: string;
    stage: string;
    ownerScope: string;
  }, context?: RepositoryWriteContext): Promise<string>;
  saveTemplateVersion(input: {
    templateId: string;
    versionName: string;
    systemPrompt: string;
    userPrompt: string;
    outputContract?: string;
    changeSummary?: string;
  }, context?: RepositoryWriteContext): Promise<string>;
}