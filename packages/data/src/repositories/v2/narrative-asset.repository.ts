import { and, asc, eq, inArray } from "drizzle-orm";

import type { ChapterCard, CharacterCard, ForeshadowLedgerItem, TimelineEvent, VolumeOutline } from "@aifiction/schemas";

import type { NarrativeAssetRepository, RepositoryWriteContext } from "../../contracts/repository-contracts";
import { type SqliteClient, getSqliteClient } from "../../client";
import { ensureSqliteV2Bootstrap } from "../../v2/bootstrap";
import {
  chapterScenesV2Table,
  chaptersV2Table,
  entitiesV2Table,
  entityEdgesV2Table,
  foreshadowsV2Table,
  timelineEventsV2Table,
  volumesV2Table,
} from "../../v2";
import { buildLifecycleValues, nowIsoString, readStringArray } from "./repository-base";

function buildCharacterRelationshipId(characterId: string, targetCharacterId: string, index: number): string {
  return `${characterId}:relationship:${targetCharacterId}:${index + 1}`;
}

function buildSceneId(chapterId: string, index: number): string {
  return `${chapterId}:scene:${index + 1}`;
}

/**
 * SQLite V2 叙事资产仓储。
 * 负责角色、分卷、章节、伏笔和时间线等结构化资产的持久化与读取。
 */
export class SqliteNarrativeAssetRepository implements NarrativeAssetRepository {
  constructor(private readonly client: SqliteClient = getSqliteClient()) {}

  async saveCharacter(character: CharacterCard, context?: RepositoryWriteContext): Promise<void> {
    await ensureSqliteV2Bootstrap(this.client);

    const timestamp = nowIsoString();
    const [existingCharacter] = await this.client.db
      .select({ createdAt: entitiesV2Table.createdAt, version: entitiesV2Table.version })
      .from(entitiesV2Table)
      .where(eq(entitiesV2Table.id, character.id))
      .limit(1);

    await this.client.db.transaction(async (tx) => {
      await tx
        .insert(entitiesV2Table)
        .values({
          id: character.id,
          projectId: character.workId,
          entityType: "character",
          canonicalName: character.name,
          displayName: character.name,
          summary: character.publicIdentity,
          ...buildLifecycleValues({
            existing: existingCharacter,
            status: "active",
            timestamp,
            metaJson: {
              source: context?.source ?? "narrative-asset",
              actorId: context?.actorId ?? null,
            },
            extraJson: {
              role: character.role,
              archetype: character.archetype,
              publicIdentity: character.publicIdentity,
              hiddenIdentity: character.hiddenIdentity ?? null,
              coreDesire: character.coreDesire,
              coreFear: character.coreFear,
              growthArc: character.growthArc,
              speechStyle: character.speechStyle,
              strengths: character.strengths,
              flaws: character.flaws,
              secrets: character.secrets,
            },
          }),
        })
        .onConflictDoUpdate({
          target: entitiesV2Table.id,
          set: {
            projectId: character.workId,
            entityType: "character",
            canonicalName: character.name,
            displayName: character.name,
            summary: character.publicIdentity,
            ...buildLifecycleValues({
              existing: existingCharacter,
              status: "active",
              timestamp,
              metaJson: {
                source: context?.source ?? "narrative-asset",
                actorId: context?.actorId ?? null,
              },
              extraJson: {
                role: character.role,
                archetype: character.archetype,
                publicIdentity: character.publicIdentity,
                hiddenIdentity: character.hiddenIdentity ?? null,
                coreDesire: character.coreDesire,
                coreFear: character.coreFear,
                growthArc: character.growthArc,
                speechStyle: character.speechStyle,
                strengths: character.strengths,
                flaws: character.flaws,
                secrets: character.secrets,
              },
            }),
          },
        });

      await tx.delete(entityEdgesV2Table).where(eq(entityEdgesV2Table.sourceEntityId, character.id));

      if (character.relationships.length) {
        await tx.insert(entityEdgesV2Table).values(
          character.relationships.map((relationship, index) => ({
            id: buildCharacterRelationshipId(character.id, relationship.targetCharacterId, index),
            projectId: character.workId,
            sourceEntityId: character.id,
            targetEntityId: relationship.targetCharacterId,
            edgeType: "character_relationship",
            publicLabel: relationship.publicLabel,
            privateLabel: relationship.privateLabel ?? null,
            directionality: "directed",
            weight: relationship.trustLevel,
            ...buildLifecycleValues({
              status: "active",
              timestamp,
              metaJson: {
                source: context?.source ?? "narrative-asset",
              },
              extraJson: {
                tensionLevel: relationship.tensionLevel,
                notes: relationship.notes,
              },
            }),
          })),
        );
      }
    });
  }

  async saveVolume(volume: VolumeOutline, context?: RepositoryWriteContext): Promise<void> {
    await ensureSqliteV2Bootstrap(this.client);

    const timestamp = nowIsoString();
    const [existingVolume] = await this.client.db
      .select({ createdAt: volumesV2Table.createdAt, version: volumesV2Table.version })
      .from(volumesV2Table)
      .where(eq(volumesV2Table.id, volume.id))
      .limit(1);

    await this.client.db
      .insert(volumesV2Table)
      .values({
        id: volume.id,
        projectId: volume.workId,
        title: volume.title,
        phaseGoal: volume.goal,
        mainConflict: volume.mainConflict,
        plannedChapterCount: volume.plannedChapterCount,
        sortOrder: volume.order,
        ...buildLifecycleValues({
          existing: existingVolume,
          status: "active",
          timestamp,
          metaJson: {
            source: context?.source ?? "narrative-asset",
          },
          extraJson: {
            entryHook: volume.entryHook,
            climax: volume.climax,
            payoff: volume.payoff,
            mustDeliverInfo: volume.mustDeliverInfo,
            keyCharacters: volume.keyCharacters,
          },
        }),
      })
      .onConflictDoUpdate({
        target: volumesV2Table.id,
        set: {
          projectId: volume.workId,
          title: volume.title,
          phaseGoal: volume.goal,
          mainConflict: volume.mainConflict,
          plannedChapterCount: volume.plannedChapterCount,
          sortOrder: volume.order,
          ...buildLifecycleValues({
            existing: existingVolume,
            status: "active",
            timestamp,
            metaJson: {
              source: context?.source ?? "narrative-asset",
            },
            extraJson: {
              entryHook: volume.entryHook,
              climax: volume.climax,
              payoff: volume.payoff,
              mustDeliverInfo: volume.mustDeliverInfo,
              keyCharacters: volume.keyCharacters,
            },
          }),
        },
      });
  }

  async saveChapter(chapter: ChapterCard, context?: RepositoryWriteContext): Promise<void> {
    await ensureSqliteV2Bootstrap(this.client);

    const timestamp = nowIsoString();
    const [existingChapter] = await this.client.db
      .select({ createdAt: chaptersV2Table.createdAt, version: chaptersV2Table.version })
      .from(chaptersV2Table)
      .where(eq(chaptersV2Table.id, chapter.id))
      .limit(1);

    await this.client.db.transaction(async (tx) => {
      await tx
        .insert(chaptersV2Table)
        .values({
          id: chapter.id,
          projectId: chapter.workId,
          volumeId: chapter.volumeId,
          title: chapter.title,
          summary: chapter.summary,
          chapterGoal: chapter.chapterGoal,
          conflict: chapter.conflict,
          entryState: chapter.entryState,
          exitState: chapter.exitState,
          endingHook: chapter.endingHook,
          currentArtifactId: null,
          sortOrder: chapter.order,
          ...buildLifecycleValues({
            existing: existingChapter,
            status: "active",
            timestamp,
            metaJson: {
              source: context?.source ?? "narrative-asset",
            },
            extraJson: {
              newInfo: chapter.newInfo,
              foreshadowSeeds: chapter.foreshadowSeeds,
              requiredCallbacks: chapter.requiredCallbacks,
              keyCharacters: chapter.keyCharacters,
            },
          }),
        })
        .onConflictDoUpdate({
          target: chaptersV2Table.id,
          set: {
            projectId: chapter.workId,
            volumeId: chapter.volumeId,
            title: chapter.title,
            summary: chapter.summary,
            chapterGoal: chapter.chapterGoal,
            conflict: chapter.conflict,
            entryState: chapter.entryState,
            exitState: chapter.exitState,
            endingHook: chapter.endingHook,
            currentArtifactId: null,
            sortOrder: chapter.order,
            ...buildLifecycleValues({
              existing: existingChapter,
              status: "active",
              timestamp,
              metaJson: {
                source: context?.source ?? "narrative-asset",
              },
              extraJson: {
                newInfo: chapter.newInfo,
                foreshadowSeeds: chapter.foreshadowSeeds,
                requiredCallbacks: chapter.requiredCallbacks,
                keyCharacters: chapter.keyCharacters,
              },
            }),
          },
        });

      await tx.delete(chapterScenesV2Table).where(eq(chapterScenesV2Table.chapterId, chapter.id));

      if (chapter.sceneCards.length) {
        await tx.insert(chapterScenesV2Table).values(
          chapter.sceneCards.map((scene, index) => ({
            id: scene.id || buildSceneId(chapter.id, index),
            chapterId: chapter.id,
            title: scene.title,
            purpose: scene.purpose,
            conflict: scene.conflict,
            emotionalShift: scene.emotionalShift,
            sortOrder: index + 1,
            ...buildLifecycleValues({
              status: "active",
              timestamp,
              metaJson: {
                source: context?.source ?? "narrative-asset",
              },
              extraJson: {},
            }),
          })),
        );
      }
    });
  }

  async saveForeshadow(foreshadow: ForeshadowLedgerItem, context?: RepositoryWriteContext): Promise<void> {
    await ensureSqliteV2Bootstrap(this.client);

    const timestamp = nowIsoString();
    const [existingForeshadow] = await this.client.db
      .select({ createdAt: foreshadowsV2Table.createdAt, version: foreshadowsV2Table.version })
      .from(foreshadowsV2Table)
      .where(eq(foreshadowsV2Table.id, foreshadow.id))
      .limit(1);

    await this.client.db
      .insert(foreshadowsV2Table)
      .values({
        id: foreshadow.id,
        projectId: foreshadow.workId,
        seedChapterId: foreshadow.seedChapterId,
        description: foreshadow.description,
        narrativePurpose: foreshadow.narrativePurpose,
        payoffStatus: foreshadow.status,
        expectedPayoffChapterId: foreshadow.expectedPayoffChapterId ?? null,
        actualPayoffChapterId: foreshadow.actualPayoffChapterId ?? null,
        ...buildLifecycleValues({
          existing: existingForeshadow,
          status: "active",
          timestamp,
          metaJson: {
            source: context?.source ?? "narrative-asset",
          },
          extraJson: {
            expectedPayoffVolumeId: foreshadow.expectedPayoffVolumeId ?? null,
          },
        }),
      })
      .onConflictDoUpdate({
        target: foreshadowsV2Table.id,
        set: {
          projectId: foreshadow.workId,
          seedChapterId: foreshadow.seedChapterId,
          description: foreshadow.description,
          narrativePurpose: foreshadow.narrativePurpose,
          payoffStatus: foreshadow.status,
          expectedPayoffChapterId: foreshadow.expectedPayoffChapterId ?? null,
          actualPayoffChapterId: foreshadow.actualPayoffChapterId ?? null,
          ...buildLifecycleValues({
            existing: existingForeshadow,
            status: "active",
            timestamp,
            metaJson: {
              source: context?.source ?? "narrative-asset",
            },
            extraJson: {
              expectedPayoffVolumeId: foreshadow.expectedPayoffVolumeId ?? null,
            },
          }),
        },
      });
  }

  async saveTimelineEvent(event: TimelineEvent, context?: RepositoryWriteContext): Promise<void> {
    await ensureSqliteV2Bootstrap(this.client);

    const timestamp = nowIsoString();
    const [existingTimelineEvent] = await this.client.db
      .select({ createdAt: timelineEventsV2Table.createdAt, version: timelineEventsV2Table.version })
      .from(timelineEventsV2Table)
      .where(eq(timelineEventsV2Table.id, event.id))
      .limit(1);

    await this.client.db
      .insert(timelineEventsV2Table)
      .values({
        id: event.id,
        projectId: event.workId,
        chapterId: event.relatedChapterId,
        inWorldDay: event.inWorldDay,
        title: event.title,
        description: event.description,
        impactSummary: event.consequences[0] ?? null,
        ...buildLifecycleValues({
          existing: existingTimelineEvent,
          status: "active",
          timestamp,
          metaJson: {
            source: context?.source ?? "narrative-asset",
          },
          extraJson: {
            involvedCharacterIds: event.involvedCharacterIds,
            consequences: event.consequences,
          },
        }),
      })
      .onConflictDoUpdate({
        target: timelineEventsV2Table.id,
        set: {
          projectId: event.workId,
          chapterId: event.relatedChapterId,
          inWorldDay: event.inWorldDay,
          title: event.title,
          description: event.description,
          impactSummary: event.consequences[0] ?? null,
          ...buildLifecycleValues({
            existing: existingTimelineEvent,
            status: "active",
            timestamp,
            metaJson: {
              source: context?.source ?? "narrative-asset",
            },
            extraJson: {
              involvedCharacterIds: event.involvedCharacterIds,
              consequences: event.consequences,
            },
          }),
        },
      });
  }

  async listCharacters(projectId: string): Promise<CharacterCard[]> {
    await ensureSqliteV2Bootstrap(this.client);

    const characterRows = await this.client.db
      .select()
      .from(entitiesV2Table)
      .where(and(eq(entitiesV2Table.projectId, projectId), eq(entitiesV2Table.entityType, "character")))
      .orderBy(asc(entitiesV2Table.displayName));

    if (!characterRows.length) {
      return [];
    }

    const characterIds = characterRows.map((characterRow) => characterRow.id);
    const relationshipRows = await this.client.db
      .select()
      .from(entityEdgesV2Table)
      .where(and(inArray(entityEdgesV2Table.sourceEntityId, characterIds), eq(entityEdgesV2Table.edgeType, "character_relationship")))
      .orderBy(asc(entityEdgesV2Table.sourceEntityId));

    const relationshipsByCharacterId = new Map<string, CharacterCard["relationships"]>();
    for (const relationshipRow of relationshipRows) {
      const relationshipExtraJson = relationshipRow.extraJson as Record<string, unknown>;
      const existingRelationships = relationshipsByCharacterId.get(relationshipRow.sourceEntityId) ?? [];
      existingRelationships.push({
        targetCharacterId: relationshipRow.targetEntityId,
        publicLabel: relationshipRow.publicLabel,
        privateLabel: relationshipRow.privateLabel ?? undefined,
        trustLevel: relationshipRow.weight,
        tensionLevel:
          typeof relationshipExtraJson.tensionLevel === "number" ? relationshipExtraJson.tensionLevel : 0,
        notes: readStringArray(relationshipExtraJson.notes),
      });
      relationshipsByCharacterId.set(relationshipRow.sourceEntityId, existingRelationships);
    }

    return characterRows.map((characterRow) => {
      const extraJson = characterRow.extraJson as Record<string, unknown>;
      return {
        id: characterRow.id,
        workId: characterRow.projectId,
        name: characterRow.displayName,
        role: typeof extraJson.role === "string" ? extraJson.role : "角色",
        archetype: typeof extraJson.archetype === "string" ? extraJson.archetype : "未定义",
        publicIdentity: typeof extraJson.publicIdentity === "string" ? extraJson.publicIdentity : characterRow.summary ?? "",
        hiddenIdentity: typeof extraJson.hiddenIdentity === "string" ? extraJson.hiddenIdentity : undefined,
        coreDesire: typeof extraJson.coreDesire === "string" ? extraJson.coreDesire : "",
        coreFear: typeof extraJson.coreFear === "string" ? extraJson.coreFear : "",
        strengths: readStringArray(extraJson.strengths),
        flaws: readStringArray(extraJson.flaws),
        secrets: readStringArray(extraJson.secrets),
        speechStyle: readStringArray(extraJson.speechStyle),
        growthArc: typeof extraJson.growthArc === "string" ? extraJson.growthArc : "",
        relationships: relationshipsByCharacterId.get(characterRow.id) ?? [],
      };
    });
  }

  async listChapters(projectId: string, volumeId?: string): Promise<ChapterCard[]> {
    await ensureSqliteV2Bootstrap(this.client);

    const whereClause = volumeId
      ? and(eq(chaptersV2Table.projectId, projectId), eq(chaptersV2Table.volumeId, volumeId))
      : eq(chaptersV2Table.projectId, projectId);

    const chapterRows = await this.client.db
      .select()
      .from(chaptersV2Table)
      .where(whereClause)
      .orderBy(asc(chaptersV2Table.sortOrder));

    if (!chapterRows.length) {
      return [];
    }

    const chapterIds = chapterRows.map((chapterRow) => chapterRow.id);
    const sceneRows = await this.client.db
      .select()
      .from(chapterScenesV2Table)
      .where(inArray(chapterScenesV2Table.chapterId, chapterIds))
      .orderBy(asc(chapterScenesV2Table.chapterId), asc(chapterScenesV2Table.sortOrder));

    const scenesByChapterId = new Map<string, ChapterCard["sceneCards"]>();
    for (const sceneRow of sceneRows) {
      const scenes = scenesByChapterId.get(sceneRow.chapterId) ?? [];
      scenes.push({
        id: sceneRow.id,
        title: sceneRow.title,
        purpose: sceneRow.purpose,
        conflict: sceneRow.conflict,
        emotionalShift: sceneRow.emotionalShift,
      });
      scenesByChapterId.set(sceneRow.chapterId, scenes);
    }

    return chapterRows.map((chapterRow) => {
      const extraJson = chapterRow.extraJson as Record<string, unknown>;
      return {
        id: chapterRow.id,
        workId: chapterRow.projectId,
        volumeId: chapterRow.volumeId,
        order: chapterRow.sortOrder,
        title: chapterRow.title,
        summary: chapterRow.summary,
        chapterGoal: chapterRow.chapterGoal,
        conflict: chapterRow.conflict,
        entryState: chapterRow.entryState,
        exitState: chapterRow.exitState,
        newInfo: readStringArray(extraJson.newInfo),
        foreshadowSeeds: readStringArray(extraJson.foreshadowSeeds),
        requiredCallbacks: readStringArray(extraJson.requiredCallbacks),
        endingHook: chapterRow.endingHook,
        keyCharacters: readStringArray(extraJson.keyCharacters),
        sceneCards: scenesByChapterId.get(chapterRow.id) ?? [],
      };
    });
  }
}
