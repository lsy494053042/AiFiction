import { and, desc, eq, inArray, lt } from "drizzle-orm";

import type {
  ChapterCard,
  ChapterMemoryBundle,
  CharacterCard,
  CharacterStateSnapshot,
  ForeshadowLedgerItem,
  StyleProfile,
  TimelineEvent,
  VolumeOutline,
  WorkProfile,
  WorldRule,
} from "@aifiction/schemas";

import { ensureSqliteBootstrap } from "../bootstrap";
import { getSqliteClient, type SqliteClient } from "../client";
import {
  chapterCardsTable,
  characterStatesTable,
  charactersTable,
  foreshadowLedgerTable,
  pipelineRunsTable,
  styleProfilesTable,
  timelineEventsTable,
  volumeOutlinesTable,
  worksTable,
  worldRulesTable,
} from "../schema";

function nowIsoString(): string {
  return new Date().toISOString();
}

/**
 * 小说项目仓储。
 * 这一层只负责持久化与读取，不负责 prompt 逻辑和模型调用。
 */
export class NovelProjectRepository {
  constructor(private readonly client: SqliteClient = getSqliteClient()) {}

  /**
   * 确保 SQLite 表结构已存在。
   */
  async initialize(): Promise<string> {
    return ensureSqliteBootstrap();
  }

  /**
   * 把一个章节上下文包写入数据库。
   * 首版主要用于快速落地 Demo 数据，以及后续人工维护后的回写。
   */
  async upsertChapterMemoryBundle(bundle: ChapterMemoryBundle): Promise<void> {
    await this.initialize();

    const timestamp = nowIsoString();
    const existingWorkRows = await this.client.db
      .select({ id: worksTable.id, createdAt: worksTable.createdAt })
      .from(worksTable)
      .where(eq(worksTable.id, bundle.work.id))
      .limit(1);

    const workCreatedAt = existingWorkRows[0]?.createdAt ?? timestamp;

    await this.client.db.transaction(async (tx) => {
      await tx
        .insert(worksTable)
        .values({
          id: bundle.work.id,
          slug: bundle.work.slug,
          title: bundle.work.title,
          tagline: bundle.work.tagline,
          genre: bundle.work.genre,
          subgenre: bundle.work.subgenre ?? null,
          targetPlatform: bundle.work.targetPlatform,
          targetAudience: bundle.work.targetAudience,
          targetWordCount: bundle.work.targetWordCount,
          dailyWordTarget: bundle.work.dailyWordTarget,
          updateCadence: bundle.work.updateCadence,
          commercialHooks: bundle.work.commercialHooks,
          hardConstraints: bundle.work.hardConstraints,
          contentWarnings: bundle.work.contentWarnings,
          status: bundle.work.status,
          createdAt: workCreatedAt,
          updatedAt: timestamp,
        })
        .onConflictDoUpdate({
          target: worksTable.id,
          set: {
            slug: bundle.work.slug,
            title: bundle.work.title,
            tagline: bundle.work.tagline,
            genre: bundle.work.genre,
            subgenre: bundle.work.subgenre ?? null,
            targetPlatform: bundle.work.targetPlatform,
            targetAudience: bundle.work.targetAudience,
            targetWordCount: bundle.work.targetWordCount,
            dailyWordTarget: bundle.work.dailyWordTarget,
            updateCadence: bundle.work.updateCadence,
            commercialHooks: bundle.work.commercialHooks,
            hardConstraints: bundle.work.hardConstraints,
            contentWarnings: bundle.work.contentWarnings,
            status: bundle.work.status,
            updatedAt: timestamp,
          },
        });

      await tx
        .insert(styleProfilesTable)
        .values({
          id: bundle.style.id,
          workId: bundle.style.workId,
          perspective: bundle.style.perspective,
          languageDensity: bundle.style.languageDensity,
          pacing: bundle.style.pacing,
          emotionLevel: bundle.style.emotionLevel,
          dialogueRatio: bundle.style.dialogueRatio,
          sensoryDetailLevel: bundle.style.sensoryDetailLevel,
          humorRatio: bundle.style.humorRatio,
          bannedPatterns: bundle.style.bannedPatterns,
          styleAnchors: bundle.style.styleAnchors,
          notes: bundle.style.notes,
          createdAt: timestamp,
          updatedAt: timestamp,
        })
        .onConflictDoUpdate({
          target: styleProfilesTable.id,
          set: {
            workId: bundle.style.workId,
            perspective: bundle.style.perspective,
            languageDensity: bundle.style.languageDensity,
            pacing: bundle.style.pacing,
            emotionLevel: bundle.style.emotionLevel,
            dialogueRatio: bundle.style.dialogueRatio,
            sensoryDetailLevel: bundle.style.sensoryDetailLevel,
            humorRatio: bundle.style.humorRatio,
            bannedPatterns: bundle.style.bannedPatterns,
            styleAnchors: bundle.style.styleAnchors,
            notes: bundle.style.notes,
            updatedAt: timestamp,
          },
        });

      await tx
        .insert(volumeOutlinesTable)
        .values({
          id: bundle.volume.id,
          workId: bundle.volume.workId,
          order: bundle.volume.order,
          title: bundle.volume.title,
          goal: bundle.volume.goal,
          mainConflict: bundle.volume.mainConflict,
          entryHook: bundle.volume.entryHook,
          climax: bundle.volume.climax,
          payoff: bundle.volume.payoff,
          mustDeliverInfo: bundle.volume.mustDeliverInfo,
          keyCharacters: bundle.volume.keyCharacters,
          plannedChapterCount: bundle.volume.plannedChapterCount,
          createdAt: timestamp,
          updatedAt: timestamp,
        })
        .onConflictDoUpdate({
          target: volumeOutlinesTable.id,
          set: {
            workId: bundle.volume.workId,
            order: bundle.volume.order,
            title: bundle.volume.title,
            goal: bundle.volume.goal,
            mainConflict: bundle.volume.mainConflict,
            entryHook: bundle.volume.entryHook,
            climax: bundle.volume.climax,
            payoff: bundle.volume.payoff,
            mustDeliverInfo: bundle.volume.mustDeliverInfo,
            keyCharacters: bundle.volume.keyCharacters,
            plannedChapterCount: bundle.volume.plannedChapterCount,
            updatedAt: timestamp,
          },
        });

      await tx
        .insert(chapterCardsTable)
        .values({
          id: bundle.chapter.id,
          workId: bundle.chapter.workId,
          volumeId: bundle.chapter.volumeId,
          order: bundle.chapter.order,
          title: bundle.chapter.title,
          summary: bundle.chapter.summary,
          chapterGoal: bundle.chapter.chapterGoal,
          conflict: bundle.chapter.conflict,
          entryState: bundle.chapter.entryState,
          exitState: bundle.chapter.exitState,
          newInfo: bundle.chapter.newInfo,
          foreshadowSeeds: bundle.chapter.foreshadowSeeds,
          requiredCallbacks: bundle.chapter.requiredCallbacks,
          endingHook: bundle.chapter.endingHook,
          keyCharacters: bundle.chapter.keyCharacters,
          sceneCards: bundle.chapter.sceneCards,
          createdAt: timestamp,
          updatedAt: timestamp,
        })
        .onConflictDoUpdate({
          target: chapterCardsTable.id,
          set: {
            workId: bundle.chapter.workId,
            volumeId: bundle.chapter.volumeId,
            order: bundle.chapter.order,
            title: bundle.chapter.title,
            summary: bundle.chapter.summary,
            chapterGoal: bundle.chapter.chapterGoal,
            conflict: bundle.chapter.conflict,
            entryState: bundle.chapter.entryState,
            exitState: bundle.chapter.exitState,
            newInfo: bundle.chapter.newInfo,
            foreshadowSeeds: bundle.chapter.foreshadowSeeds,
            requiredCallbacks: bundle.chapter.requiredCallbacks,
            endingHook: bundle.chapter.endingHook,
            keyCharacters: bundle.chapter.keyCharacters,
            sceneCards: bundle.chapter.sceneCards,
            updatedAt: timestamp,
          },
        });

      for (const worldRule of bundle.worldRules) {
        await tx
          .insert(worldRulesTable)
          .values({
            id: worldRule.id,
            workId: worldRule.workId,
            category: worldRule.category,
            title: worldRule.title,
            description: worldRule.description,
            hardConstraint: worldRule.hardConstraint,
            examples: worldRule.examples,
            createdAt: timestamp,
            updatedAt: timestamp,
          })
          .onConflictDoUpdate({
            target: worldRulesTable.id,
            set: {
              workId: worldRule.workId,
              category: worldRule.category,
              title: worldRule.title,
              description: worldRule.description,
              hardConstraint: worldRule.hardConstraint,
              examples: worldRule.examples,
              updatedAt: timestamp,
            },
          });
      }

      for (const character of bundle.characters) {
        await tx
          .insert(charactersTable)
          .values({
            id: character.id,
            workId: character.workId,
            name: character.name,
            role: character.role,
            archetype: character.archetype,
            publicIdentity: character.publicIdentity,
            hiddenIdentity: character.hiddenIdentity ?? null,
            coreDesire: character.coreDesire,
            coreFear: character.coreFear,
            strengths: character.strengths,
            flaws: character.flaws,
            secrets: character.secrets,
            speechStyle: character.speechStyle,
            growthArc: character.growthArc,
            relationships: character.relationships,
            createdAt: timestamp,
            updatedAt: timestamp,
          })
          .onConflictDoUpdate({
            target: charactersTable.id,
            set: {
              workId: character.workId,
              name: character.name,
              role: character.role,
              archetype: character.archetype,
              publicIdentity: character.publicIdentity,
              hiddenIdentity: character.hiddenIdentity ?? null,
              coreDesire: character.coreDesire,
              coreFear: character.coreFear,
              strengths: character.strengths,
              flaws: character.flaws,
              secrets: character.secrets,
              speechStyle: character.speechStyle,
              growthArc: character.growthArc,
              relationships: character.relationships,
              updatedAt: timestamp,
            },
          });
      }

      for (const state of bundle.characterStates) {
        await tx
          .insert(characterStatesTable)
          .values({
            snapshotId: state.snapshotId,
            workId: state.workId,
            chapterId: state.chapterId,
            characterId: state.characterId,
            knows: state.knows,
            resources: state.resources,
            wounds: state.wounds,
            emotionalState: state.emotionalState,
            stanceSummary: state.stanceSummary,
            relationshipDeltas: state.relationshipDeltas,
            unresolvedThreads: state.unresolvedThreads,
            createdAt: timestamp,
            updatedAt: timestamp,
          })
          .onConflictDoUpdate({
            target: characterStatesTable.snapshotId,
            set: {
              workId: state.workId,
              chapterId: state.chapterId,
              characterId: state.characterId,
              knows: state.knows,
              resources: state.resources,
              wounds: state.wounds,
              emotionalState: state.emotionalState,
              stanceSummary: state.stanceSummary,
              relationshipDeltas: state.relationshipDeltas,
              unresolvedThreads: state.unresolvedThreads,
              updatedAt: timestamp,
            },
          });
      }

      for (const foreshadow of bundle.foreshadows) {
        await tx
          .insert(foreshadowLedgerTable)
          .values({
            id: foreshadow.id,
            workId: foreshadow.workId,
            seedChapterId: foreshadow.seedChapterId,
            description: foreshadow.description,
            narrativePurpose: foreshadow.narrativePurpose,
            expectedPayoffVolumeId: foreshadow.expectedPayoffVolumeId ?? null,
            expectedPayoffChapterId: foreshadow.expectedPayoffChapterId ?? null,
            actualPayoffChapterId: foreshadow.actualPayoffChapterId ?? null,
            status: foreshadow.status,
            createdAt: timestamp,
            updatedAt: timestamp,
          })
          .onConflictDoUpdate({
            target: foreshadowLedgerTable.id,
            set: {
              workId: foreshadow.workId,
              seedChapterId: foreshadow.seedChapterId,
              description: foreshadow.description,
              narrativePurpose: foreshadow.narrativePurpose,
              expectedPayoffVolumeId: foreshadow.expectedPayoffVolumeId ?? null,
              expectedPayoffChapterId: foreshadow.expectedPayoffChapterId ?? null,
              actualPayoffChapterId: foreshadow.actualPayoffChapterId ?? null,
              status: foreshadow.status,
              updatedAt: timestamp,
            },
          });
      }

      for (const event of bundle.timelineEvents) {
        await tx
          .insert(timelineEventsTable)
          .values({
            id: event.id,
            workId: event.workId,
            inWorldDay: event.inWorldDay,
            title: event.title,
            description: event.description,
            relatedChapterId: event.relatedChapterId,
            involvedCharacterIds: event.involvedCharacterIds,
            consequences: event.consequences,
            createdAt: timestamp,
            updatedAt: timestamp,
          })
          .onConflictDoUpdate({
            target: timelineEventsTable.id,
            set: {
              workId: event.workId,
              inWorldDay: event.inWorldDay,
              title: event.title,
              description: event.description,
              relatedChapterId: event.relatedChapterId,
              involvedCharacterIds: event.involvedCharacterIds,
              consequences: event.consequences,
              updatedAt: timestamp,
            },
          });
      }
    });
  }

  /**
   * 记录一次流水线运行结果。
   */
  async recordPipelineRun(run: {
    id: string;
    workId: string;
    chapterId?: string;
    stage: string;
    promptVersion: string;
    model: string;
    success: boolean;
    inputSummary: string;
    outputSummary: string;
    estimatedTokenCost: number;
    startedAt: string;
    finishedAt?: string;
    errorMessage?: string;
  }): Promise<void> {
    await this.initialize();

    await this.client.db
      .insert(pipelineRunsTable)
      .values({
        id: run.id,
        workId: run.workId,
        chapterId: run.chapterId ?? null,
        stage: run.stage,
        promptVersion: run.promptVersion,
        model: run.model,
        success: run.success,
        inputSummary: run.inputSummary,
        outputSummary: run.outputSummary,
        estimatedTokenCost: run.estimatedTokenCost,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt ?? null,
        errorMessage: run.errorMessage ?? null,
      })
      .onConflictDoUpdate({
        target: pipelineRunsTable.id,
        set: {
          workId: run.workId,
          chapterId: run.chapterId ?? null,
          stage: run.stage,
          promptVersion: run.promptVersion,
          model: run.model,
          success: run.success,
          inputSummary: run.inputSummary,
          outputSummary: run.outputSummary,
          estimatedTokenCost: run.estimatedTokenCost,
          startedAt: run.startedAt,
          finishedAt: run.finishedAt ?? null,
          errorMessage: run.errorMessage ?? null,
        },
      });
  }

  /**
   * 返回仓库中的作品列表。
   */
  async listWorks(): Promise<WorkProfile[]> {
    await this.initialize();

    const rows = await this.client.db.select().from(worksTable).orderBy(worksTable.updatedAt);
    return rows.map((row) => this.mapWork(row));
  }

  /**
   * 按作品 slug 和章节 ID 组装章节记忆包。
   * 这一层是“数据库世界”到“工作流世界”的桥梁。
   */
  async getChapterMemoryBundleBySlug(
    workSlug: string,
    chapterId: string,
  ): Promise<ChapterMemoryBundle | null> {
    await this.initialize();

    const workRows = await this.client.db
      .select()
      .from(worksTable)
      .where(eq(worksTable.slug, workSlug))
      .limit(1);
    const workRow = workRows[0];

    if (!workRow) {
      return null;
    }

    const styleRows = await this.client.db
      .select()
      .from(styleProfilesTable)
      .where(eq(styleProfilesTable.workId, workRow.id))
      .limit(1);
    const chapterRows = await this.client.db
      .select()
      .from(chapterCardsTable)
      .where(and(eq(chapterCardsTable.id, chapterId), eq(chapterCardsTable.workId, workRow.id)))
      .limit(1);

    const styleRow = styleRows[0];
    const chapterRow = chapterRows[0];

    if (!styleRow || !chapterRow) {
      return null;
    }

    const volumeRows = await this.client.db
      .select()
      .from(volumeOutlinesTable)
      .where(eq(volumeOutlinesTable.id, chapterRow.volumeId))
      .limit(1);
    const volumeRow = volumeRows[0];

    if (!volumeRow) {
      return null;
    }

    const keyCharacterIds = chapterRow.keyCharacters;
    const chapterCharacters = keyCharacterIds.length
      ? await this.client.db
          .select()
          .from(charactersTable)
          .where(inArray(charactersTable.id, keyCharacterIds))
      : [];

    const latestStates = keyCharacterIds.length
      ? await this.selectLatestCharacterStates(workRow.id, keyCharacterIds)
      : [];

    const worldRules = await this.client.db
      .select()
      .from(worldRulesTable)
      .where(eq(worldRulesTable.workId, workRow.id));

    const foreshadows = await this.client.db
      .select()
      .from(foreshadowLedgerTable)
      .where(eq(foreshadowLedgerTable.workId, workRow.id));

    const timelineEvents = await this.client.db
      .select()
      .from(timelineEventsTable)
      .where(eq(timelineEventsTable.workId, workRow.id))
      .orderBy(timelineEventsTable.inWorldDay);

    const recentChapterSummaries = await this.client.db
      .select({ summary: chapterCardsTable.summary })
      .from(chapterCardsTable)
      .where(and(eq(chapterCardsTable.workId, workRow.id), lt(chapterCardsTable.order, chapterRow.order)))
      .orderBy(desc(chapterCardsTable.order))
      .limit(3);

    return {
      work: this.mapWork(workRow),
      style: this.mapStyle(styleRow),
      volume: this.mapVolume(volumeRow),
      chapter: this.mapChapter(chapterRow),
      worldRules: worldRules.map((row) => this.mapWorldRule(row)),
      characters: chapterCharacters.map((row) => this.mapCharacter(row)),
      characterStates: latestStates,
      foreshadows: foreshadows.map((row) => this.mapForeshadow(row)),
      timelineEvents: timelineEvents.map((row) => this.mapTimelineEvent(row)),
      recentChapterSummaries: recentChapterSummaries.map((row) => row.summary).reverse(),
    };
  }

  private async selectLatestCharacterStates(
    workId: string,
    characterIds: string[],
  ): Promise<CharacterStateSnapshot[]> {
    const rows = await this.client.db
      .select()
      .from(characterStatesTable)
      .where(
        and(
          eq(characterStatesTable.workId, workId),
          inArray(characterStatesTable.characterId, characterIds),
        ),
      )
      .orderBy(desc(characterStatesTable.createdAt));

    const latestByCharacterId = new Map<string, CharacterStateSnapshot>();

    for (const row of rows) {
      if (!latestByCharacterId.has(row.characterId)) {
        latestByCharacterId.set(row.characterId, this.mapCharacterState(row));
      }
    }

    return characterIds
      .map((characterId) => latestByCharacterId.get(characterId))
      .filter((state): state is CharacterStateSnapshot => Boolean(state));
  }

  private mapWork(row: typeof worksTable.$inferSelect): WorkProfile {
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      tagline: row.tagline,
      genre: row.genre,
      subgenre: row.subgenre ?? undefined,
      targetPlatform: row.targetPlatform,
      targetAudience: row.targetAudience,
      targetWordCount: row.targetWordCount,
      dailyWordTarget: row.dailyWordTarget,
      updateCadence: row.updateCadence,
      commercialHooks: row.commercialHooks,
      hardConstraints: row.hardConstraints,
      contentWarnings: row.contentWarnings,
      status: row.status as WorkProfile["status"],
    };
  }

  private mapStyle(row: typeof styleProfilesTable.$inferSelect): StyleProfile {
    return {
      id: row.id,
      workId: row.workId,
      perspective: row.perspective as StyleProfile["perspective"],
      languageDensity: row.languageDensity as StyleProfile["languageDensity"],
      pacing: row.pacing as StyleProfile["pacing"],
      emotionLevel: row.emotionLevel as StyleProfile["emotionLevel"],
      dialogueRatio: row.dialogueRatio,
      sensoryDetailLevel: row.sensoryDetailLevel,
      humorRatio: row.humorRatio,
      bannedPatterns: row.bannedPatterns,
      styleAnchors: row.styleAnchors,
      notes: row.notes,
    };
  }

  private mapWorldRule(row: typeof worldRulesTable.$inferSelect): WorldRule {
    return {
      id: row.id,
      workId: row.workId,
      category: row.category,
      title: row.title,
      description: row.description,
      hardConstraint: row.hardConstraint,
      examples: row.examples,
    };
  }

  private mapCharacter(row: typeof charactersTable.$inferSelect): CharacterCard {
    return {
      id: row.id,
      workId: row.workId,
      name: row.name,
      role: row.role,
      archetype: row.archetype,
      publicIdentity: row.publicIdentity,
      hiddenIdentity: row.hiddenIdentity ?? undefined,
      coreDesire: row.coreDesire,
      coreFear: row.coreFear,
      strengths: row.strengths,
      flaws: row.flaws,
      secrets: row.secrets,
      speechStyle: row.speechStyle,
      growthArc: row.growthArc,
      relationships: row.relationships as CharacterCard["relationships"],
    };
  }

  private mapCharacterState(row: typeof characterStatesTable.$inferSelect): CharacterStateSnapshot {
    return {
      snapshotId: row.snapshotId,
      workId: row.workId,
      chapterId: row.chapterId,
      characterId: row.characterId,
      knows: row.knows,
      resources: row.resources,
      wounds: row.wounds,
      emotionalState: row.emotionalState,
      stanceSummary: row.stanceSummary,
      relationshipDeltas: row.relationshipDeltas as CharacterStateSnapshot["relationshipDeltas"],
      unresolvedThreads: row.unresolvedThreads,
    };
  }

  private mapVolume(row: typeof volumeOutlinesTable.$inferSelect): VolumeOutline {
    return {
      id: row.id,
      workId: row.workId,
      order: row.order,
      title: row.title,
      goal: row.goal,
      mainConflict: row.mainConflict,
      entryHook: row.entryHook,
      climax: row.climax,
      payoff: row.payoff,
      mustDeliverInfo: row.mustDeliverInfo,
      keyCharacters: row.keyCharacters,
      plannedChapterCount: row.plannedChapterCount,
    };
  }

  private mapChapter(row: typeof chapterCardsTable.$inferSelect): ChapterCard {
    return {
      id: row.id,
      workId: row.workId,
      volumeId: row.volumeId,
      order: row.order,
      title: row.title,
      summary: row.summary,
      chapterGoal: row.chapterGoal,
      conflict: row.conflict,
      entryState: row.entryState,
      exitState: row.exitState,
      newInfo: row.newInfo,
      foreshadowSeeds: row.foreshadowSeeds,
      requiredCallbacks: row.requiredCallbacks,
      endingHook: row.endingHook,
      keyCharacters: row.keyCharacters,
      sceneCards: row.sceneCards as ChapterCard["sceneCards"],
    };
  }

  private mapForeshadow(row: typeof foreshadowLedgerTable.$inferSelect): ForeshadowLedgerItem {
    return {
      id: row.id,
      workId: row.workId,
      seedChapterId: row.seedChapterId,
      description: row.description,
      narrativePurpose: row.narrativePurpose,
      expectedPayoffVolumeId: row.expectedPayoffVolumeId ?? undefined,
      expectedPayoffChapterId: row.expectedPayoffChapterId ?? undefined,
      actualPayoffChapterId: row.actualPayoffChapterId ?? undefined,
      status: row.status as ForeshadowLedgerItem["status"],
    };
  }

  private mapTimelineEvent(row: typeof timelineEventsTable.$inferSelect): TimelineEvent {
    return {
      id: row.id,
      workId: row.workId,
      inWorldDay: row.inWorldDay,
      title: row.title,
      description: row.description,
      relatedChapterId: row.relatedChapterId,
      involvedCharacterIds: row.involvedCharacterIds,
      consequences: row.consequences,
    };
  }
}