import { randomUUID } from "node:crypto";

import { desc, eq } from "drizzle-orm";

import {
  chapterCardSchema,
  characterCardSchema,
  type ChapterCard,
  type CharacterCard,
  type WorkProfile,
  type VolumeOutline,
  volumeOutlineSchema,
  workProfileSchema,
} from "@aifiction/schemas";

import { type SqliteClient, getSqliteClient } from "../client";
import { SqliteNarrativeAssetRepository } from "../repositories/v2/narrative-asset.repository";
import { SqliteProjectCatalogRepository } from "../repositories/v2/project-catalog.repository";
import { ensureSqliteV2Bootstrap } from "../v2/bootstrap";
import { chaptersV2Table, novelProjectsV2Table, volumesV2Table } from "../v2";

export interface CreateWorkbenchWorkInput {
  title: string;
  slug?: string;
  tagline: string;
  genre: string;
  subgenre?: string;
  targetPlatform: string;
  targetAudience?: string[];
  targetWordCount?: number;
  dailyWordTarget?: number;
  updateCadence?: string;
  commercialHooks?: string[];
  hardConstraints?: string[];
  contentWarnings?: string[];
}

export interface UpdateWorkbenchWorkInput extends CreateWorkbenchWorkInput {
  workId: string;
}

export interface CreateWorkbenchVolumeInput {
  workId: string;
  title: string;
  goal: string;
  mainConflict: string;
  entryHook?: string;
  climax?: string;
  payoff?: string;
  mustDeliverInfo?: string[];
  keyCharacters?: string[];
  plannedChapterCount?: number;
}

export interface UpdateWorkbenchVolumeInput extends CreateWorkbenchVolumeInput {
  volumeId: string;
  order?: number;
}

export interface CreateWorkbenchCharacterInput {
  workId: string;
  name: string;
  role: string;
  archetype: string;
  publicIdentity: string;
  hiddenIdentity?: string;
  coreDesire: string;
  coreFear: string;
  strengths?: string[];
  flaws?: string[];
  secrets?: string[];
  speechStyle?: string[];
  growthArc: string;
}

export interface UpdateWorkbenchCharacterInput extends CreateWorkbenchCharacterInput {
  characterId: string;
}

export interface CreateWorkbenchChapterInput {
  workId: string;
  volumeId: string;
  title: string;
  summary: string;
  chapterGoal: string;
  conflict: string;
  entryState: string;
  exitState: string;
  endingHook: string;
  newInfo?: string[];
  foreshadowSeeds?: string[];
  requiredCallbacks?: string[];
  keyCharacters?: string[];
}

export interface UpdateWorkbenchChapterInput extends CreateWorkbenchChapterInput {
  chapterId: string;
  order?: number;
}

/**
 * 工作台写服务。
 * 这一层负责把页面表单和领域对象对齐，再交给 V2 repository 落库。
 */
export class NovelWorkbenchMutationService {
  private readonly projectCatalogRepository: SqliteProjectCatalogRepository;
  private readonly narrativeAssetRepository: SqliteNarrativeAssetRepository;

  constructor(private readonly client: SqliteClient = getSqliteClient()) {
    this.projectCatalogRepository = new SqliteProjectCatalogRepository(client);
    this.narrativeAssetRepository = new SqliteNarrativeAssetRepository(client);
  }

  /**
   * 创建作品。
   * 首版会自动补齐 slug 和一组默认运营参数，避免页面表单承担过多规则。
   */
  async createWork(input: CreateWorkbenchWorkInput): Promise<WorkProfile> {
    await ensureSqliteV2Bootstrap(this.client);

    const title = input.title.trim();
    const slug = await this.resolveUniqueSlug(input.slug || title);

    const work = this.buildWorkProfile({
      ...input,
      workId: randomUUID(),
      slug,
      status: "planning",
      title,
    });

    await this.projectCatalogRepository.saveProject(work, {
      source: "workbench-mutation",
      reason: "创建作品",
    });

    return work;
  }

  /**
   * 更新作品。
   * 允许调整 slug，但会自动避开同名冲突，保证多作品工作台里的路由稳定。
   */
  async updateWork(input: UpdateWorkbenchWorkInput): Promise<WorkProfile> {
    await ensureSqliteV2Bootstrap(this.client);

    const existingWork = await this.getWorkById(input.workId);
    if (!existingWork) {
      throw new Error("未找到要更新的作品。");
    }

    const title = input.title.trim();
    const slug = await this.resolveUniqueSlug(input.slug || title, input.workId);

    const work = this.buildWorkProfile({
      ...input,
      workId: input.workId,
      slug,
      status: existingWork.status,
      title,
    });

    await this.projectCatalogRepository.saveProject(work, {
      source: "workbench-mutation",
      reason: "更新作品",
    });

    return work;
  }

  /**
   * 创建分卷。
   * 分卷顺序由系统自动递增，避免页面维护排序号。
   */
  async createVolume(input: CreateWorkbenchVolumeInput): Promise<VolumeOutline> {
    await ensureSqliteV2Bootstrap(this.client);

    const order = await this.nextVolumeOrder(input.workId);
    const volume = this.buildVolumeOutline({
      ...input,
      volumeId: randomUUID(),
      order,
    });

    await this.narrativeAssetRepository.saveVolume(volume, {
      source: "workbench-mutation",
      reason: "创建分卷",
    });

    return volume;
  }

  /**
   * 更新分卷。
   * 先保留既有排序号，避免编辑标题或目标时打乱卷级顺序。
   */
  async updateVolume(input: UpdateWorkbenchVolumeInput): Promise<VolumeOutline> {
    await ensureSqliteV2Bootstrap(this.client);

    const existingVolume = await this.getVolumeById(input.volumeId);
    if (!existingVolume) {
      throw new Error("未找到要更新的分卷。");
    }

    const volume = this.buildVolumeOutline({
      ...input,
      volumeId: input.volumeId,
      order: input.order ?? existingVolume.order,
    });

    await this.narrativeAssetRepository.saveVolume(volume, {
      source: "workbench-mutation",
      reason: "更新分卷",
    });

    return volume;
  }

  /**
   * 创建角色。
   * 首版先把关系留空，后续单独做关系编辑入口。
   */
  async createCharacter(input: CreateWorkbenchCharacterInput): Promise<CharacterCard> {
    await ensureSqliteV2Bootstrap(this.client);

    const character = this.buildCharacterCard({
      ...input,
      characterId: randomUUID(),
      relationships: [],
    });

    await this.narrativeAssetRepository.saveCharacter(character, {
      source: "workbench-mutation",
      reason: "创建角色",
    });

    return character;
  }

  /**
   * 更新角色。
   * 当前先保留既有关系列表，避免基础信息编辑时把关系网误清空。
   */
  async updateCharacter(input: UpdateWorkbenchCharacterInput): Promise<CharacterCard> {
    await ensureSqliteV2Bootstrap(this.client);

    const existingCharacter = await this.getCharacterById(input.workId, input.characterId);
    if (!existingCharacter) {
      throw new Error("未找到要更新的角色。");
    }

    const character = this.buildCharacterCard({
      ...input,
      characterId: input.characterId,
      relationships: existingCharacter.relationships,
    });

    await this.narrativeAssetRepository.saveCharacter(character, {
      source: "workbench-mutation",
      reason: "更新角色",
    });

    return character;
  }

  /**
   * 创建章节卡。
   * 章节顺序在卷内自动递增，首版先允许场景卡为空。
   */
  async createChapter(input: CreateWorkbenchChapterInput): Promise<ChapterCard> {
    await ensureSqliteV2Bootstrap(this.client);

    const order = await this.nextChapterOrder(input.volumeId);
    const chapter = this.buildChapterCard({
      ...input,
      chapterId: randomUUID(),
      order,
      sceneCards: [],
    });

    await this.narrativeAssetRepository.saveChapter(chapter, {
      source: "workbench-mutation",
      reason: "创建章节",
    });

    return chapter;
  }

  /**
   * 更新章节卡。
   * 当前先沿用既有场景卡，后续再补独立的场景级编辑器。
   */
  async updateChapter(input: UpdateWorkbenchChapterInput): Promise<ChapterCard> {
    await ensureSqliteV2Bootstrap(this.client);

    const existingChapter = await this.getChapterById(input.workId, input.chapterId);
    if (!existingChapter) {
      throw new Error("未找到要更新的章节。");
    }

    const chapter = this.buildChapterCard({
      ...input,
      chapterId: input.chapterId,
      order: input.order ?? existingChapter.order,
      sceneCards: existingChapter.sceneCards,
    });

    await this.narrativeAssetRepository.saveChapter(chapter, {
      source: "workbench-mutation",
      reason: "更新章节",
    });

    return chapter;
  }

  private buildWorkProfile(input: UpdateWorkbenchWorkInput & { slug: string; status: WorkProfile["status"] }): WorkProfile {
    return workProfileSchema.parse({
      id: input.workId,
      slug: input.slug,
      title: input.title.trim(),
      tagline: input.tagline.trim(),
      genre: input.genre.trim(),
      subgenre: this.normalizeOptionalText(input.subgenre),
      targetPlatform: input.targetPlatform.trim(),
      targetAudience: this.normalizeStringList(input.targetAudience),
      targetWordCount: input.targetWordCount ?? 1200000,
      dailyWordTarget: input.dailyWordTarget ?? 4000,
      updateCadence: input.updateCadence?.trim() || "日更",
      commercialHooks: this.normalizeStringList(input.commercialHooks),
      hardConstraints: this.normalizeStringList(input.hardConstraints),
      contentWarnings: this.normalizeStringList(input.contentWarnings),
      status: input.status,
    });
  }

  private buildVolumeOutline(
    input: (CreateWorkbenchVolumeInput | UpdateWorkbenchVolumeInput) & { volumeId: string; order: number },
  ): VolumeOutline {
    return volumeOutlineSchema.parse({
      id: input.volumeId,
      workId: input.workId,
      order: input.order,
      title: input.title.trim(),
      goal: input.goal.trim(),
      mainConflict: input.mainConflict.trim(),
      entryHook: this.normalizeOptionalText(input.entryHook) ?? "待补入卷钩子",
      climax: this.normalizeOptionalText(input.climax) ?? "待补卷高潮",
      payoff: this.normalizeOptionalText(input.payoff) ?? "待补本卷兑现点",
      mustDeliverInfo: this.normalizeStringList(input.mustDeliverInfo),
      keyCharacters: this.normalizeStringList(input.keyCharacters),
      plannedChapterCount: input.plannedChapterCount ?? 24,
    });
  }

  private buildCharacterCard(
    input: (CreateWorkbenchCharacterInput | UpdateWorkbenchCharacterInput) & {
      characterId: string;
      relationships: CharacterCard["relationships"];
    },
  ): CharacterCard {
    return characterCardSchema.parse({
      id: input.characterId,
      workId: input.workId,
      name: input.name.trim(),
      role: input.role.trim(),
      archetype: input.archetype.trim(),
      publicIdentity: input.publicIdentity.trim(),
      hiddenIdentity: this.normalizeOptionalText(input.hiddenIdentity),
      coreDesire: input.coreDesire.trim(),
      coreFear: input.coreFear.trim(),
      strengths: this.normalizeStringList(input.strengths),
      flaws: this.normalizeStringList(input.flaws),
      secrets: this.normalizeStringList(input.secrets),
      speechStyle: this.normalizeStringList(input.speechStyle),
      growthArc: input.growthArc.trim(),
      relationships: input.relationships,
    });
  }

  private buildChapterCard(
    input: (CreateWorkbenchChapterInput | UpdateWorkbenchChapterInput) & {
      chapterId: string;
      order: number;
      sceneCards: ChapterCard["sceneCards"];
    },
  ): ChapterCard {
    return chapterCardSchema.parse({
      id: input.chapterId,
      workId: input.workId,
      volumeId: input.volumeId,
      order: input.order,
      title: input.title.trim(),
      summary: input.summary.trim(),
      chapterGoal: input.chapterGoal.trim(),
      conflict: input.conflict.trim(),
      entryState: input.entryState.trim(),
      exitState: input.exitState.trim(),
      newInfo: this.normalizeStringList(input.newInfo),
      foreshadowSeeds: this.normalizeStringList(input.foreshadowSeeds),
      requiredCallbacks: this.normalizeStringList(input.requiredCallbacks),
      endingHook: input.endingHook.trim(),
      keyCharacters: this.normalizeStringList(input.keyCharacters),
      sceneCards: input.sceneCards,
    });
  }

  private async resolveUniqueSlug(rawSlug: string, currentWorkId?: string): Promise<string> {
    const baseSlug = this.slugify(rawSlug) || `work-${randomUUID().slice(0, 8)}`;
    let candidate = baseSlug;
    let counter = 2;

    while (true) {
      const existingWork = await this.projectCatalogRepository.getProjectBySlug(candidate);
      if (!existingWork || existingWork.id === currentWorkId) {
        return candidate;
      }

      candidate = `${baseSlug}-${counter}`;
      counter += 1;
    }
  }

  private slugify(value: string): string {
    return value
      .normalize("NFKC")
      .trim()
      .toLowerCase()
      .replace(/[^\p{Letter}\p{Number}\s-]/gu, "")
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  private async nextVolumeOrder(workId: string): Promise<number> {
    const rows = await this.client.db
      .select({ sortOrder: volumesV2Table.sortOrder })
      .from(volumesV2Table)
      .where(eq(volumesV2Table.projectId, workId))
      .orderBy(desc(volumesV2Table.sortOrder))
      .limit(1);

    return (rows[0]?.sortOrder ?? 0) + 1;
  }

  private async nextChapterOrder(volumeId: string): Promise<number> {
    const rows = await this.client.db
      .select({ sortOrder: chaptersV2Table.sortOrder })
      .from(chaptersV2Table)
      .where(eq(chaptersV2Table.volumeId, volumeId))
      .orderBy(desc(chaptersV2Table.sortOrder))
      .limit(1);

    return (rows[0]?.sortOrder ?? 0) + 1;
  }

  /**
   * 通过作品 ID 读取当前作品。
   * 更新作品时需要先拿到旧状态，确保只替换本次真正修改的字段。
   */
  private async getWorkById(workId: string): Promise<WorkProfile | null> {
    const workRows = await this.client.db
      .select({ slug: novelProjectsV2Table.slug })
      .from(novelProjectsV2Table)
      .where(eq(novelProjectsV2Table.id, workId))
      .limit(1);

    const workSlug = workRows[0]?.slug;
    if (!workSlug) {
      return null;
    }

    return this.projectCatalogRepository.getProjectBySlug(workSlug);
  }

  /**
   * 通过分卷 ID 读取分卷。
   * 当前先在写服务内部做轻量映射，避免页面层直接接触底表结构。
   */
  private async getVolumeById(volumeId: string): Promise<VolumeOutline | null> {
    const volumeRows = await this.client.db
      .select()
      .from(volumesV2Table)
      .where(eq(volumesV2Table.id, volumeId))
      .limit(1);

    const volumeRow = volumeRows[0];
    if (!volumeRow) {
      return null;
    }

    const extraJson = (volumeRow.extraJson ?? {}) as Record<string, unknown>;
    return volumeOutlineSchema.parse({
      id: volumeRow.id,
      workId: volumeRow.projectId,
      order: volumeRow.sortOrder,
      title: volumeRow.title,
      goal: volumeRow.phaseGoal,
      mainConflict: volumeRow.mainConflict,
      entryHook: String(extraJson.entryHook ?? "待补入卷钩子"),
      climax: String(extraJson.climax ?? "待补卷高潮"),
      payoff: String(extraJson.payoff ?? "待补本卷兑现点"),
      mustDeliverInfo: this.normalizeStringList(extraJson.mustDeliverInfo as string[] | undefined),
      keyCharacters: this.normalizeStringList(extraJson.keyCharacters as string[] | undefined),
      plannedChapterCount: volumeRow.plannedChapterCount,
    });
  }

  /**
   * 通过作品 ID 和角色 ID 读取角色。
   * 更新基础资料时保留既有关系图谱，后续再拆关系编辑器。
   */
  private async getCharacterById(workId: string, characterId: string): Promise<CharacterCard | null> {
    const characters = await this.narrativeAssetRepository.listCharacters(workId);
    return characters.find((character) => character.id === characterId) ?? null;
  }

  /**
   * 通过作品 ID 和章节 ID 读取章节。
   * 当前先复用章节列表查询，后续如果数量继续增大再补按 ID 精确读取接口。
   */
  private async getChapterById(workId: string, chapterId: string): Promise<ChapterCard | null> {
    const chapters = await this.narrativeAssetRepository.listChapters(workId);
    return chapters.find((chapter) => chapter.id === chapterId) ?? null;
  }

  private normalizeStringList(values?: string[]): string[] {
    return (values ?? []).map((value) => value.trim()).filter(Boolean);
  }

  private normalizeOptionalText(value?: string): string | undefined {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
  }
}