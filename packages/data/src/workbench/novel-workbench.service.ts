import { asc, eq } from "drizzle-orm";

import type { ChapterCard, CharacterCard, VolumeOutline, WorkProfile } from "@aifiction/schemas";

import type { RepositoryPageRequest } from "../contracts/repository-contracts";
import { type SqliteClient, getSqliteClient } from "../client";
import { SqliteNarrativeAssetRepository } from "../repositories/v2/narrative-asset.repository";
import { SqliteProjectCatalogRepository } from "../repositories/v2/project-catalog.repository";
import { readStringArray } from "../repositories/v2/repository-base";
import { ensureSqliteV2Bootstrap } from "../v2/bootstrap";
import { foreshadowsV2Table, novelProjectsV2Table, volumesV2Table } from "../v2";

/**
 * 工作台首页需要的统计信息。
 * 这层是应用层读模型，目的是把页面真正关心的数字提前整理好。
 */
export interface WorkbenchProjectStats {
  volumeCount: number;
  chapterCount: number;
  characterCount: number;
  foreshadowCount: number;
  relationCount: number;
}

/**
 * 工作台作品列表项。
 * 这里保留作品主信息、统计信息和最近一章标题，方便列表页和首页卡片复用。
 */
export interface WorkbenchProjectSummary {
  work: WorkProfile;
  stats: WorkbenchProjectStats;
  latestChapterTitle?: string;
  updatedAt: string;
}

/**
 * 角色图谱节点。
 * 后续做图谱页面时，这个结构可以直接复用到前端可视化层。
 */
export interface WorkbenchCharacterGraphNode {
  characterId: string;
  name: string;
  role: string;
  archetype: string;
}

/**
 * 角色图谱边。
 * 边上直接保留关系标签与强度，避免前端还要回头拼接说明文本。
 */
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
 * 单本作品在工作台中的快照。
 * 这层为后续作品详情页、角色页、关系图谱页提供统一读取入口。
 */
export interface WorkbenchProjectSnapshot {
  work: WorkProfile;
  stats: WorkbenchProjectStats;
  volumes: VolumeOutline[];
  characters: CharacterCard[];
  chapters: ChapterCard[];
  graph: WorkbenchCharacterGraph;
  latestChapter?: ChapterCard;
}

/**
 * 工作台查询服务。
 * 这层位于 repository 之上、页面之下，专门负责把 V2 数据整理成页面友好的读模型。
 */
export class NovelWorkbenchService {
  private readonly projectCatalogRepository: SqliteProjectCatalogRepository;
  private readonly narrativeAssetRepository: SqliteNarrativeAssetRepository;

  constructor(private readonly client: SqliteClient = getSqliteClient()) {
    this.projectCatalogRepository = new SqliteProjectCatalogRepository(client);
    this.narrativeAssetRepository = new SqliteNarrativeAssetRepository(client);
  }

  /**
   * 列出工作台首页需要的作品摘要。
   * 先用项目仓储拿到作品列表，再补齐角色数、章节数、伏笔数等概览信息。
   */
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

  /**
   * 获取单本作品的工作台快照。
   * 这会把作品、卷纲、角色、章节和关系图谱一次性整理出来，供页面直接消费。
   */
  async getProjectSnapshotBySlug(slug: string): Promise<WorkbenchProjectSnapshot | null> {
    await ensureSqliteV2Bootstrap(this.client);

    const work = await this.projectCatalogRepository.getProjectBySlug(slug);
    if (!work) {
      return null;
    }

    const [characters, chapters, volumes, foreshadowCount] = await Promise.all([
      this.narrativeAssetRepository.listCharacters(work.id),
      this.narrativeAssetRepository.listChapters(work.id),
      this.listVolumes(work.id),
      this.countForeshadows(work.id),
    ]);

    const graph = this.buildCharacterGraph(characters);

    return {
      work,
      stats: {
        volumeCount: volumes.length,
        chapterCount: chapters.length,
        characterCount: characters.length,
        foreshadowCount,
        relationCount: graph.edges.length,
      },
      volumes,
      characters,
      chapters,
      graph,
      latestChapter: chapters.at(-1),
    };
  }

  /**
   * 列出作品下的所有分卷。
   * 当前 NarrativeAssetRepository 还没有公开卷列表，这里先由工作台查询层补齐读模型能力。
   */
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
        entryHook: String(extraJson.entryHook ?? "待补入卷钩子"),
        climax: String(extraJson.climax ?? "待补卷高潮"),
        payoff: String(extraJson.payoff ?? "待补本卷兑现点"),
        mustDeliverInfo: readStringArray(extraJson.mustDeliverInfo),
        keyCharacters: readStringArray(extraJson.keyCharacters),
        plannedChapterCount: volumeRow.plannedChapterCount,
      };
    });
  }

  /**
   * 统计作品的伏笔数。
   * 先返回总量，后续如果需要再拆成未回收、已回收等更细维度。
   */
  private async countForeshadows(projectId: string): Promise<number> {
    const foreshadowRows = await this.client.db
      .select({ id: foreshadowsV2Table.id })
      .from(foreshadowsV2Table)
      .where(eq(foreshadowsV2Table.projectId, projectId));

    return foreshadowRows.length;
  }

  /**
   * 把角色列表转换成前端可消费的关系图谱。
   * 这层明确依赖结构化关系数据，而不是让前端或模型临时从正文里猜关系。
   */
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

  private createEmptyStats(): WorkbenchProjectStats {
    return {
      volumeCount: 0,
      chapterCount: 0,
      characterCount: 0,
      foreshadowCount: 0,
      relationCount: 0,
    };
  }
}