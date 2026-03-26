import { asc, eq } from "drizzle-orm";

import type { ChapterCard, CharacterCard, VolumeOutline, WorkProfile } from "@aifiction/schemas";

import type { RepositoryPageRequest } from "../contracts/repository-contracts";
import { type SqliteClient, getSqliteClient } from "../client";
import { SqliteNarrativeAssetRepository } from "../repositories/v2/narrative-asset.repository";
import { SqliteProjectCatalogRepository } from "../repositories/v2/project-catalog.repository";
import { readStringArray } from "../repositories/v2/repository-base";
import {
  type SyncFileSourceRecord,
  type SyncReviewQueueRecord,
  SqliteSyncSourceRepository,
  SqliteSyncWorkflowRepository,
} from "../repositories/v2";
import { ensureSqliteV2Bootstrap } from "../v2/bootstrap";
import { foreshadowsV2Table, novelProjectsV2Table, volumesV2Table } from "../v2";

/**
 * 工作台首页与详情页共用的统计信息。
 * 这里保留小说核心规模，以及自动维护链路的目录源/待审查数。
 */
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
}

export interface WorkbenchCharacterGraph {
  nodes: WorkbenchCharacterGraphNode[];
  edges: WorkbenchCharacterGraphEdge[];
}

/**
 * 目录源概要。
 * 页面主要用它来展示本地目录映射、扫描覆盖范围和待审查压力。
 */
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

/**
 * 审查队列概要。
 * 前端不会直接吃整张 review 表，而是吃已经拼好源路径与文档类型的读模型。
 */
export interface WorkbenchReviewItemSummary {
  id: string;
  reviewKind: string;
  severity: string;
  status: string;
  summary: string;
  sourceDocumentId?: string;
  sourcePath?: string;
  documentKind?: string;
  detailJson: Record<string, unknown>;
}

export interface WorkbenchReviewStats {
  pendingCount: number;
  lowSeverityCount: number;
  mediumSeverityCount: number;
  highSeverityCount: number;
}

interface WorkbenchSourceDocumentIndex {
  id: string;
  relativePath: string;
  documentKind: string;
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
  pendingReviews: WorkbenchReviewItemSummary[];
  reviewStats: WorkbenchReviewStats;
}

/**
 * 工作台读服务。
 * 这层位于 repository 之上、页面之下，专门负责把 V2 数据整理成页面友好的读模型。
 */
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

    const [characters, chapters, volumes, foreshadowCount, fileSources, reviewRows] = await Promise.all([
      this.narrativeAssetRepository.listCharacters(work.id),
      this.narrativeAssetRepository.listChapters(work.id),
      this.listVolumes(work.id),
      this.countForeshadows(work.id),
      this.syncSourceRepository.listFileSources(work.id),
      this.syncWorkflowRepository.listReviewQueue(work.id, "pending"),
    ]);

    const sourceDocumentsByFileSource = new Map<string, WorkbenchSourceDocumentIndex[]>();
    const sourceDocumentById = new Map<string, { relativePath: string; documentKind: string }>();

    for (const fileSource of fileSources) {
      const sourceDocuments = this.sortSourceDocuments(await this.syncSourceRepository.listSourceDocuments(fileSource.id));
      sourceDocumentsByFileSource.set(fileSource.id, sourceDocuments);

      for (const sourceDocument of sourceDocuments) {
        sourceDocumentById.set(sourceDocument.id, {
          relativePath: sourceDocument.relativePath,
          documentKind: sourceDocument.documentKind,
        });
      }
    }

    const graph = this.buildCharacterGraph(characters);
    const pendingReviews = reviewRows
      .slice(0, 12)
      .map((review) => this.createReviewSummary(review, sourceDocumentById));
    const reviewStats = this.createReviewStats(reviewRows);
    const fileSourceSummaries = fileSources.map((fileSource) =>
      this.createFileSourceSummary(fileSource, sourceDocumentsByFileSource.get(fileSource.id) ?? [], reviewRows),
    );

    return {
      work,
      stats: {
        volumeCount: volumes.length,
        chapterCount: chapters.length,
        characterCount: characters.length,
        foreshadowCount,
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
        entryHook: String(extraJson.entryHook ?? "待补充卷钩子"),
        climax: String(extraJson.climax ?? "待补充卷高潮"),
        payoff: String(extraJson.payoff ?? "待补充本卷兑现点"),
        mustDeliverInfo: readStringArray(extraJson.mustDeliverInfo),
        keyCharacters: readStringArray(extraJson.keyCharacters),
        plannedChapterCount: volumeRow.plannedChapterCount,
      };
    });
  }

  private async countForeshadows(projectId: string): Promise<number> {
    const foreshadowRows = await this.client.db
      .select({ id: foreshadowsV2Table.id })
      .from(foreshadowsV2Table)
      .where(eq(foreshadowsV2Table.projectId, projectId));

    return foreshadowRows.length;
  }

  private buildCharacterGraph(characters: CharacterCard[]): WorkbenchCharacterGraph {
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
        edges.push({
          sourceCharacterId: character.id,
          sourceCharacterName: character.name,
          targetCharacterId: relationship.targetCharacterId,
          targetCharacterName: characterNameById.get(relationship.targetCharacterId) ?? relationship.targetCharacterId,
          publicLabel: relationship.publicLabel,
          privateLabel: relationship.privateLabel,
          trustLevel: relationship.trustLevel,
          tensionLevel: relationship.tensionLevel,
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
    }>,
  ): WorkbenchSourceDocumentIndex[] {
    return [...documents].sort((left, right) => right.lastModifiedAt.localeCompare(left.lastModifiedAt, "zh-CN"));
  }

  private createFileSourceSummary(
    fileSource: SyncFileSourceRecord,
    sourceDocuments: Array<{
      id: string;
      relativePath: string;
      syncStatus: string;
      lastModifiedAt: string;
    }>,
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
    sourceDocumentById: Map<string, { relativePath: string; documentKind: string }>,
  ): WorkbenchReviewItemSummary {
    const sourceDocument = review.sourceDocumentId ? sourceDocumentById.get(review.sourceDocumentId) : undefined;

    return {
      id: review.id,
      reviewKind: review.reviewKind,
      severity: review.severity,
      status: review.status,
      summary: review.summary,
      sourceDocumentId: review.sourceDocumentId,
      sourcePath: sourceDocument?.relativePath,
      documentKind: sourceDocument?.documentKind,
      detailJson: review.detailJson,
    };
  }

  private createReviewStats(reviews: SyncReviewQueueRecord[]): WorkbenchReviewStats {
    return {
      pendingCount: reviews.length,
      lowSeverityCount: reviews.filter((review) => review.severity === "low").length,
      mediumSeverityCount: reviews.filter((review) => review.severity === "medium").length,
      highSeverityCount: reviews.filter((review) => review.severity === "high").length,
    };
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
