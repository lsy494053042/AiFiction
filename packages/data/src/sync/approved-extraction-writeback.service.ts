import { createHash } from "node:crypto";
import path from "node:path";

import { desc, eq } from "drizzle-orm";

import type {
  ChapterCard,
  CharacterCard,
  CharacterRelation,
  ForeshadowLedgerItem,
  TimelineEvent,
  VolumeOutline,
} from "@aifiction/schemas";

import { type SqliteClient, getSqliteClient } from "../client";
import {
  SqliteMemorySnapshotRepository,
  SqliteNarrativeAssetRepository,
  SqliteSyncSourceRepository,
  SqliteSyncWorkflowRepository,
  type SyncAssetUpdateRecord,
  type SyncSourceDocumentRecord,
} from "../repositories/v2";
import { volumesV2Table } from "../v2";
import { ensureSqliteV2Bootstrap } from "../v2/bootstrap";
import type {
  ExtractedCharacterCandidate,
  ExtractedForeshadowCandidate,
  ExtractedRelationshipCandidate,
  ExtractedTimelineCandidate,
} from "./document-extraction";

export interface SyncApprovedExtractionInput {
  projectId: string;
  sourceDocumentId: string;
  decidedAt?: string;
  decision: "approved" | "rejected";
}

export interface SyncApprovedExtractionResult {
  candidateBundleCount: number;
  charactersCreated: number;
  relationshipsUpserted: number;
  foreshadowsUpserted: number;
  timelineEventsUpserted: number;
  sourceChaptersCreated: number;
}

interface CharacterCandidateBundlePayload {
  candidates?: ExtractedCharacterCandidate[];
}

interface RelationshipCandidateBundlePayload {
  candidates?: ExtractedRelationshipCandidate[];
}

interface ForeshadowCandidateBundlePayload {
  candidates?: ExtractedForeshadowCandidate[];
}

interface TimelineCandidateBundlePayload {
  candidates?: ExtractedTimelineCandidate[];
}

interface SourceChapterScope {
  sourceDocument: SyncSourceDocumentRecord;
  chapter: ChapterCard;
  created: boolean;
}

const relationHintPresetMap: Record<
  string,
  Pick<CharacterRelation, "publicLabel" | "trustLevel" | "tensionLevel"> & { notes: string[] }
> = {
  conflict: {
    publicLabel: "Conflict",
    trustLevel: -40,
    tensionLevel: 75,
    notes: ["Approved from extraction preview; indicates clear hostility or confrontation."],
  },
  support: {
    publicLabel: "Support",
    trustLevel: 45,
    tensionLevel: 18,
    notes: ["Approved from extraction preview; indicates assistance or protection."],
  },
  watching: {
    publicLabel: "Watching",
    trustLevel: 5,
    tensionLevel: 42,
    notes: ["Approved from extraction preview; indicates suspicion, observation, or probing."],
  },
  co_occurrence: {
    publicLabel: "Co-occurrence",
    trustLevel: 0,
    tensionLevel: 10,
    notes: ["Approved from extraction preview; currently only means appearing together in the same scene."],
  },
};

/**
 * Approved extraction writeback service.
 * This stage persists approved character, relationship, foreshadow, and timeline candidates.
 */
export class ApprovedExtractionWritebackService {
  private readonly narrativeAssetRepository: SqliteNarrativeAssetRepository;
  private readonly memorySnapshotRepository: SqliteMemorySnapshotRepository;
  private readonly syncSourceRepository: SqliteSyncSourceRepository;
  private readonly syncWorkflowRepository: SqliteSyncWorkflowRepository;

  constructor(private readonly client: SqliteClient = getSqliteClient()) {
    this.narrativeAssetRepository = new SqliteNarrativeAssetRepository(client);
    this.memorySnapshotRepository = new SqliteMemorySnapshotRepository(client);
    this.syncSourceRepository = new SqliteSyncSourceRepository(client);
    this.syncWorkflowRepository = new SqliteSyncWorkflowRepository(client);
  }

  async syncApprovedExtraction(input: SyncApprovedExtractionInput): Promise<SyncApprovedExtractionResult> {
    await ensureSqliteV2Bootstrap(this.client);

    const decidedAt = input.decidedAt ?? new Date().toISOString();
    const sourceDocument = await this.syncSourceRepository.getSourceDocumentById(input.sourceDocumentId);
    if (!sourceDocument) {
      throw new Error("Source document was not found for approved extraction writeback.");
    }

    const assetUpdates = await this.syncWorkflowRepository.listAssetUpdates({
      projectId: input.projectId,
      sourceDocumentId: input.sourceDocumentId,
    });

    const bundleUpdates = assetUpdates.filter((assetUpdate) =>
      [
        "character-candidate-bundle",
        "relationship-candidate-bundle",
        "foreshadow-candidate-bundle",
        "timeline-candidate-bundle",
      ].includes(assetUpdate.assetType),
    );

    if (input.decision === "rejected") {
      for (const bundleUpdate of bundleUpdates) {
        await this.syncWorkflowRepository.saveAssetUpdate({
          id: bundleUpdate.id,
          projectId: bundleUpdate.projectId,
          syncRunId: bundleUpdate.syncRunId,
          sourceDocumentId: bundleUpdate.sourceDocumentId,
          assetType: bundleUpdate.assetType,
          assetId: bundleUpdate.assetId,
          updateKind: bundleUpdate.updateKind,
          confidenceLevel: bundleUpdate.confidenceLevel,
          proposedPayloadJson: bundleUpdate.proposedPayloadJson,
          appliedStatus: "rejected",
          appliedAt: undefined,
        });
      }

      return {
        candidateBundleCount: bundleUpdates.length,
        charactersCreated: 0,
        relationshipsUpserted: 0,
        foreshadowsUpserted: 0,
        timelineEventsUpserted: 0,
        sourceChaptersCreated: 0,
      };
    }

    const characters = await this.narrativeAssetRepository.listCharacters(input.projectId);
    const charactersByName = new Map(characters.map((character) => [this.normalizeName(character.name), character]));

    let sourceScope: SourceChapterScope | undefined;
    const ensureSourceScope = async () => {
      if (!sourceScope) {
        sourceScope = await this.ensureSourceChapterScope({
          projectId: input.projectId,
          sourceDocument,
        });
      }
      return sourceScope;
    };

    let charactersCreated = 0;
    let relationshipsUpserted = 0;
    let foreshadowsUpserted = 0;
    let timelineEventsUpserted = 0;

    const characterBundles = bundleUpdates.filter((assetUpdate) => assetUpdate.assetType === "character-candidate-bundle");
    for (const bundleUpdate of characterBundles) {
      const payload = bundleUpdate.proposedPayloadJson as CharacterCandidateBundlePayload;
      for (const candidate of payload.candidates ?? []) {
        const result = await this.ensureCharacterFromCandidate({
          projectId: input.projectId,
          sourceDocument,
          candidate,
          decidedAt,
          charactersByName,
        });
        charactersCreated += result.created ? 1 : 0;
      }

      await this.markAssetUpdateApplied(bundleUpdate, decidedAt);
    }

    const relationshipBundles = bundleUpdates.filter((assetUpdate) => assetUpdate.assetType === "relationship-candidate-bundle");
    for (const bundleUpdate of relationshipBundles) {
      const payload = bundleUpdate.proposedPayloadJson as RelationshipCandidateBundlePayload;
      for (const candidate of payload.candidates ?? []) {
        const sourceCharacter = await this.ensureCharacterFromName({
          projectId: input.projectId,
          sourceDocument,
          name: candidate.sourceName,
          evidence: [candidate.evidence],
          charactersByName,
          decidedAt,
        });
        const targetCharacter = await this.ensureCharacterFromName({
          projectId: input.projectId,
          sourceDocument,
          name: candidate.targetName,
          evidence: [candidate.evidence],
          charactersByName,
          decidedAt,
        });

        if (sourceCharacter.created) {
          charactersCreated += 1;
        }
        if (targetCharacter.created) {
          charactersCreated += 1;
        }

        const updated = await this.upsertRelationship({
          sourceDocument,
          sourceCharacter: sourceCharacter.character,
          targetCharacter: targetCharacter.character,
          candidate,
          decidedAt,
        });

        charactersByName.set(this.normalizeName(updated.name), updated);
        relationshipsUpserted += 1;
      }

      await this.markAssetUpdateApplied(bundleUpdate, decidedAt);
    }

    const foreshadowBundles = bundleUpdates.filter((assetUpdate) => assetUpdate.assetType === "foreshadow-candidate-bundle");
    for (const bundleUpdate of foreshadowBundles) {
      const payload = bundleUpdate.proposedPayloadJson as ForeshadowCandidateBundlePayload;
      const scope = await ensureSourceScope();

      for (const [index, candidate] of (payload.candidates ?? []).entries()) {
        const foreshadow = this.buildForeshadowLedgerItem({
          projectId: input.projectId,
          sourceDocument,
          sourceChapterId: scope.chapter.id,
          candidate,
          index,
        });

        await this.narrativeAssetRepository.saveForeshadow(foreshadow, {
          source: "approved-extraction-writeback",
          actorId: "review-queue-service",
        });
        await this.memorySnapshotRepository.saveEntitySnapshot(
          {
            projectId: input.projectId,
            entityType: "foreshadow",
            entityId: foreshadow.id,
            chapterId: scope.chapter.id,
            snapshotLabel: this.buildSnapshotLabel(sourceDocument.id),
            stateJson: {
              label: candidate.label,
              description: candidate.description,
              evidence: candidate.evidence,
              confidenceLevel: candidate.confidenceLevel,
              sourceDocumentId: sourceDocument.id,
              seedChapterId: scope.chapter.id,
              decidedAt,
            },
          },
          {
            source: "approved-extraction-writeback",
            actorId: "review-queue-service",
          },
        );
        await this.syncWorkflowRepository.saveSourceRef({
          projectId: input.projectId,
          assetType: "foreshadow",
          assetId: foreshadow.id,
          sourceDocumentId: sourceDocument.id,
          referenceKind: "approved-writeback",
          locator: `${sourceDocument.relativePath}#foreshadow:${index + 1}`,
          evidenceQuote: candidate.evidence,
        });
        foreshadowsUpserted += 1;
      }

      await this.markAssetUpdateApplied(bundleUpdate, decidedAt);
    }

    const timelineBundles = bundleUpdates.filter((assetUpdate) => assetUpdate.assetType === "timeline-candidate-bundle");
    for (const bundleUpdate of timelineBundles) {
      const payload = bundleUpdate.proposedPayloadJson as TimelineCandidateBundlePayload;
      const scope = await ensureSourceScope();

      for (const [index, candidate] of (payload.candidates ?? []).entries()) {
        const timelineEvent = this.buildTimelineEvent({
          projectId: input.projectId,
          sourceDocument,
          chapter: scope.chapter,
          candidate,
          index,
        });

        await this.narrativeAssetRepository.saveTimelineEvent(timelineEvent, {
          source: "approved-extraction-writeback",
          actorId: "review-queue-service",
        });
        await this.memorySnapshotRepository.saveEntitySnapshot(
          {
            projectId: input.projectId,
            entityType: "timeline-event",
            entityId: timelineEvent.id,
            chapterId: scope.chapter.id,
            snapshotLabel: this.buildSnapshotLabel(sourceDocument.id),
            stateJson: {
              title: timelineEvent.title,
              timeMarker: candidate.timeMarker,
              description: timelineEvent.description,
              sourceDocumentId: sourceDocument.id,
              relatedChapterId: scope.chapter.id,
              decidedAt,
            },
          },
          {
            source: "approved-extraction-writeback",
            actorId: "review-queue-service",
          },
        );
        await this.syncWorkflowRepository.saveSourceRef({
          projectId: input.projectId,
          assetType: "timeline-event",
          assetId: timelineEvent.id,
          sourceDocumentId: sourceDocument.id,
          referenceKind: "approved-writeback",
          locator: `${sourceDocument.relativePath}#timeline:${index + 1}`,
          evidenceQuote: candidate.evidence,
        });
        timelineEventsUpserted += 1;
      }

      await this.markAssetUpdateApplied(bundleUpdate, decidedAt);
    }

    return {
      candidateBundleCount: bundleUpdates.length,
      charactersCreated,
      relationshipsUpserted,
      foreshadowsUpserted,
      timelineEventsUpserted,
      sourceChaptersCreated: sourceScope?.created ? 1 : 0,
    };
  }

  private async ensureCharacterFromCandidate(input: {
    projectId: string;
    sourceDocument: SyncSourceDocumentRecord;
    candidate: ExtractedCharacterCandidate;
    decidedAt: string;
    charactersByName: Map<string, CharacterCard>;
  }): Promise<{ character: CharacterCard; created: boolean }> {
    const existingCharacter = input.charactersByName.get(this.normalizeName(input.candidate.name));
    if (existingCharacter) {
      await this.saveCharacterSnapshot(existingCharacter, input.sourceDocument, input.decidedAt, {
        mentionCount: input.candidate.mentionCount,
        evidence: input.candidate.evidence,
        confidenceLevel: input.candidate.confidenceLevel,
      });
      await this.syncWorkflowRepository.saveSourceRef({
        projectId: input.projectId,
        assetType: "character",
        assetId: existingCharacter.id,
        sourceDocumentId: input.sourceDocument.id,
        referenceKind: "approved-writeback",
        locator: `${input.sourceDocument.relativePath}#character:${this.slugToken(input.candidate.name)}`,
        evidenceQuote: input.candidate.evidence[0],
      });
      return { character: existingCharacter, created: false };
    }

    const character = this.buildPlaceholderCharacter(input.projectId, input.candidate.name, input.sourceDocument.id);
    await this.narrativeAssetRepository.saveCharacter(character, {
      source: "approved-extraction-writeback",
      actorId: "review-queue-service",
    });
    await this.saveCharacterSnapshot(character, input.sourceDocument, input.decidedAt, {
      mentionCount: input.candidate.mentionCount,
      evidence: input.candidate.evidence,
      confidenceLevel: input.candidate.confidenceLevel,
    });
    await this.syncWorkflowRepository.saveSourceRef({
      projectId: input.projectId,
      assetType: "character",
      assetId: character.id,
      sourceDocumentId: input.sourceDocument.id,
      referenceKind: "approved-writeback",
      locator: `${input.sourceDocument.relativePath}#character:${this.slugToken(input.candidate.name)}`,
      evidenceQuote: input.candidate.evidence[0],
    });

    input.charactersByName.set(this.normalizeName(character.name), character);
    return { character, created: true };
  }

  private async ensureCharacterFromName(input: {
    projectId: string;
    sourceDocument: SyncSourceDocumentRecord;
    name: string;
    evidence: string[];
    charactersByName: Map<string, CharacterCard>;
    decidedAt: string;
  }): Promise<{ character: CharacterCard; created: boolean }> {
    return this.ensureCharacterFromCandidate({
      projectId: input.projectId,
      sourceDocument: input.sourceDocument,
      candidate: {
        name: input.name,
        mentionCount: 1,
        confidenceLevel: "low",
        evidence: input.evidence,
      },
      decidedAt: input.decidedAt,
      charactersByName: input.charactersByName,
    });
  }

  private async upsertRelationship(input: {
    sourceDocument: SyncSourceDocumentRecord;
    sourceCharacter: CharacterCard;
    targetCharacter: CharacterCard;
    candidate: ExtractedRelationshipCandidate;
    decidedAt: string;
  }): Promise<CharacterCard> {
    const preset = relationHintPresetMap[input.candidate.relationHint] ?? relationHintPresetMap.co_occurrence;
    const existingRelationshipIndex = input.sourceCharacter.relationships.findIndex(
      (relationship) =>
        relationship.targetCharacterId === input.targetCharacter.id && relationship.publicLabel === preset.publicLabel,
    );

    const noteBundle = [
      ...preset.notes,
      `Source document: ${input.sourceDocument.id}`,
      `Evidence: ${input.candidate.evidence}`,
      `Decided at: ${input.decidedAt}`,
    ];

    const nextRelationships = [...input.sourceCharacter.relationships];
    if (existingRelationshipIndex >= 0) {
      const currentRelationship = nextRelationships[existingRelationshipIndex];
      nextRelationships[existingRelationshipIndex] = {
        ...currentRelationship,
        trustLevel: Math.max(currentRelationship.trustLevel, preset.trustLevel),
        tensionLevel: Math.max(currentRelationship.tensionLevel, preset.tensionLevel),
        notes: this.mergeNotes(currentRelationship.notes, noteBundle),
      };
    } else {
      nextRelationships.push({
        targetCharacterId: input.targetCharacter.id,
        publicLabel: preset.publicLabel,
        privateLabel: undefined,
        trustLevel: preset.trustLevel,
        tensionLevel: preset.tensionLevel,
        notes: noteBundle,
      });
    }

    const updatedCharacter: CharacterCard = {
      ...input.sourceCharacter,
      relationships: nextRelationships,
    };

    await this.narrativeAssetRepository.saveCharacter(updatedCharacter, {
      source: "approved-extraction-writeback",
      actorId: "review-queue-service",
    });
    await this.memorySnapshotRepository.saveEntitySnapshot(
      {
        projectId: updatedCharacter.workId,
        entityType: "character-relationship",
        entityId: `${updatedCharacter.id}:${input.targetCharacter.id}:${preset.publicLabel}`,
        snapshotLabel: this.buildSnapshotLabel(input.sourceDocument.id),
        stateJson: {
          sourceCharacterId: updatedCharacter.id,
          targetCharacterId: input.targetCharacter.id,
          publicLabel: preset.publicLabel,
          trustLevel: preset.trustLevel,
          tensionLevel: preset.tensionLevel,
          relationHint: input.candidate.relationHint,
          evidence: input.candidate.evidence,
          decidedAt: input.decidedAt,
        },
      },
      {
        source: "approved-extraction-writeback",
        actorId: "review-queue-service",
      },
    );
    await this.syncWorkflowRepository.saveSourceRef({
      projectId: updatedCharacter.workId,
      assetType: "character-relationship",
      assetId: `${updatedCharacter.id}:${input.targetCharacter.id}:${preset.publicLabel}`,
      sourceDocumentId: input.sourceDocument.id,
      referenceKind: "approved-writeback",
      locator: `${input.sourceDocument.relativePath}#relationship:${this.slugToken(input.sourceCharacter.name)}-${this.slugToken(input.targetCharacter.name)}`,
      evidenceQuote: input.candidate.evidence,
    });

    return updatedCharacter;
  }

  private async ensureSourceChapterScope(input: {
    projectId: string;
    sourceDocument: SyncSourceDocumentRecord;
  }): Promise<SourceChapterScope> {
    if (input.sourceDocument.mappedScopeType === "chapter" && input.sourceDocument.mappedScopeId) {
      const chapters = await this.narrativeAssetRepository.listChapters(input.projectId);
      const matchedChapter = chapters.find((chapter) => chapter.id === input.sourceDocument.mappedScopeId);
      if (matchedChapter) {
        return {
          sourceDocument: input.sourceDocument,
          chapter: matchedChapter,
          created: false,
        };
      }
    }

    const volume = await this.ensureAutoSyncVolume(input.projectId);
    const chapterId = `${input.projectId}:chapter:auto:${this.hashToken(input.sourceDocument.id)}`;
    const chapters = await this.narrativeAssetRepository.listChapters(input.projectId, volume.id);
    const existingChapter = chapters.find((chapter) => chapter.id === chapterId);

    let chapter = existingChapter;
    let created = false;
    if (!chapter) {
      chapter = {
        id: chapterId,
        workId: input.projectId,
        volumeId: volume.id,
        order: this.deriveChapterOrder(input.sourceDocument.relativePath, chapters),
        title: this.deriveSourceTitle(input.sourceDocument.relativePath),
        summary: `Auto-mapped from source document ${input.sourceDocument.relativePath}.`,
        chapterGoal: "Provide a stable chapter anchor for sync extraction and fact writeback.",
        conflict: "Pending later refinement from source text and review results.",
        entryState: "Auto-created by sync writeback.",
        exitState: "Pending later refinement from source text.",
        newInfo: [`source_document:${input.sourceDocument.relativePath}`],
        foreshadowSeeds: [],
        requiredCallbacks: [],
        endingHook: "Pending later refinement from source text and review results.",
        keyCharacters: [],
        sceneCards: [],
      };

      await this.narrativeAssetRepository.saveChapter(chapter, {
        source: "approved-extraction-writeback",
        actorId: "review-queue-service",
      });
      created = true;
    }

    const nextSourceDocument: SyncSourceDocumentRecord = {
      ...input.sourceDocument,
      mappedScopeType: "chapter",
      mappedScopeId: chapter.id,
    };
    await this.syncSourceRepository.saveSourceDocument(nextSourceDocument);

    return {
      sourceDocument: nextSourceDocument,
      chapter,
      created,
    };
  }

  private async ensureAutoSyncVolume(projectId: string): Promise<VolumeOutline> {
    const volumeId = `${projectId}:volume:auto-sync`;
    const rows = await this.client.db
      .select()
      .from(volumesV2Table)
      .where(eq(volumesV2Table.id, volumeId))
      .limit(1);
    const row = rows[0];

    if (row) {
      const extraJson = (row.extraJson ?? {}) as Record<string, unknown>;
      return {
        id: row.id,
        workId: row.projectId,
        order: row.sortOrder,
        title: row.title,
        goal: row.phaseGoal,
        mainConflict: row.mainConflict,
        entryHook: String(extraJson.entryHook ?? "Auto sync entry"),
        climax: String(extraJson.climax ?? "Pending later refinement"),
        payoff: String(extraJson.payoff ?? "Pending later refinement"),
        mustDeliverInfo: Array.isArray(extraJson.mustDeliverInfo)
          ? extraJson.mustDeliverInfo.filter((item): item is string => typeof item === "string")
          : [],
        keyCharacters: Array.isArray(extraJson.keyCharacters)
          ? extraJson.keyCharacters.filter((item): item is string => typeof item === "string")
          : [],
        plannedChapterCount: row.plannedChapterCount,
      };
    }

    const lastVolume = await this.client.db
      .select({ sortOrder: volumesV2Table.sortOrder })
      .from(volumesV2Table)
      .where(eq(volumesV2Table.projectId, projectId))
      .orderBy(desc(volumesV2Table.sortOrder))
      .limit(1);

    const autoVolume: VolumeOutline = {
      id: volumeId,
      workId: projectId,
      order: (lastVolume[0]?.sortOrder ?? 0) + 1,
      title: "Auto Sync Mapping",
      goal: "Provide a stable volume scope for source documents that have not yet been structured manually.",
      mainConflict: "Pending later refinement from source text and review results.",
      entryHook: "Created automatically when writeback needs a structural anchor.",
      climax: "Pending later refinement.",
      payoff: "Pending later refinement.",
      mustDeliverInfo: ["Keep a stable mapping between local source files and structured assets."],
      keyCharacters: [],
      plannedChapterCount: 999,
    };

    await this.narrativeAssetRepository.saveVolume(autoVolume, {
      source: "approved-extraction-writeback",
      actorId: "review-queue-service",
    });

    return autoVolume;
  }

  private buildForeshadowLedgerItem(input: {
    projectId: string;
    sourceDocument: SyncSourceDocumentRecord;
    sourceChapterId: string;
    candidate: ExtractedForeshadowCandidate;
    index: number;
  }): ForeshadowLedgerItem {
    return {
      id: `${input.projectId}:foreshadow:auto:${this.hashToken(`${input.sourceDocument.id}:${input.index}:${input.candidate.label}:${input.candidate.evidence}`)}`,
      workId: input.projectId,
      seedChapterId: input.sourceChapterId,
      description: input.candidate.description,
      narrativePurpose: `Auto extracted clue: ${input.candidate.label}`,
      expectedPayoffVolumeId: undefined,
      expectedPayoffChapterId: undefined,
      actualPayoffChapterId: undefined,
      status: "seeded",
    };
  }

  private buildTimelineEvent(input: {
    projectId: string;
    sourceDocument: SyncSourceDocumentRecord;
    chapter: ChapterCard;
    candidate: ExtractedTimelineCandidate;
    index: number;
  }): TimelineEvent {
    return {
      id: `${input.projectId}:timeline:auto:${this.hashToken(`${input.sourceDocument.id}:${input.index}:${input.candidate.timeMarker}:${input.candidate.evidence}`)}`,
      workId: input.projectId,
      inWorldDay: this.deriveTimelineDay(input.chapter.order, input.candidate.timeMarker),
      title: `${input.candidate.timeMarker} - ${input.candidate.label}`,
      description: input.candidate.evidence,
      relatedChapterId: input.chapter.id,
      involvedCharacterIds: [],
      consequences: ["Approved from extraction preview and persisted as a first-pass timeline fact."],
    };
  }

  private deriveTimelineDay(chapterOrder: number, timeMarker: string): number {
    const baseDay = Math.max(chapterOrder, 0);
    if (["次日", "第二天"].some((marker) => timeMarker.includes(marker))) {
      return baseDay + 1;
    }
    return baseDay;
  }

  private deriveChapterOrder(relativePath: string, existingChapters: ChapterCard[]): number {
    const baseName = path.basename(relativePath, path.extname(relativePath));
    const matchedNumber = baseName.match(/^(\d{1,6})/);
    if (matchedNumber) {
      return Number.parseInt(matchedNumber[1], 10);
    }

    const maxOrder = existingChapters.reduce((currentMax, chapter) => Math.max(currentMax, chapter.order), 0);
    return maxOrder + 1;
  }

  private deriveSourceTitle(relativePath: string): string {
    const baseName = path.basename(relativePath, path.extname(relativePath));
    const normalized = baseName.replace(/^[\d\s._-]+/, "").replace(/[_-]+/g, " ").trim();
    return normalized || baseName;
  }

  private async saveCharacterSnapshot(
    character: CharacterCard,
    sourceDocument: SyncSourceDocumentRecord,
    decidedAt: string,
    stateJson: Record<string, unknown>,
  ) {
    await this.memorySnapshotRepository.saveEntitySnapshot(
      {
        projectId: character.workId,
        entityType: "character",
        entityId: character.id,
        snapshotLabel: this.buildSnapshotLabel(sourceDocument.id),
        stateJson: {
          name: character.name,
          sourceDocumentId: sourceDocument.id,
          decidedAt,
          ...stateJson,
        },
      },
      {
        source: "approved-extraction-writeback",
        actorId: "review-queue-service",
      },
    );
  }

  private async markAssetUpdateApplied(assetUpdate: SyncAssetUpdateRecord, decidedAt: string) {
    await this.syncWorkflowRepository.saveAssetUpdate({
      id: assetUpdate.id,
      projectId: assetUpdate.projectId,
      syncRunId: assetUpdate.syncRunId,
      sourceDocumentId: assetUpdate.sourceDocumentId,
      assetType: assetUpdate.assetType,
      assetId: assetUpdate.assetId,
      updateKind: assetUpdate.updateKind,
      confidenceLevel: assetUpdate.confidenceLevel,
      proposedPayloadJson: assetUpdate.proposedPayloadJson,
      appliedStatus: "applied",
      appliedAt: decidedAt,
    });
  }

  private buildPlaceholderCharacter(projectId: string, name: string, sourceDocumentId: string): CharacterCard {
    return {
      id: `${projectId}:character:auto:${this.hashToken(name)}`,
      workId: projectId,
      name,
      role: "Pending Role Confirmation",
      archetype: "Pending Archetype Confirmation",
      publicIdentity: name,
      hiddenIdentity: undefined,
      coreDesire: `Pending completion from source document ${sourceDocumentId}.`,
      coreFear: `Pending completion from source document ${sourceDocumentId}.`,
      strengths: [],
      flaws: [],
      secrets: [],
      speechStyle: [],
      growthArc: `Pending completion from source document ${sourceDocumentId}.`,
      relationships: [],
    };
  }

  private buildSnapshotLabel(sourceDocumentId: string): string {
    return `approved-extraction:${this.hashToken(sourceDocumentId)}`;
  }

  private normalizeName(value: string): string {
    return value.trim().normalize("NFKC").toLowerCase();
  }

  private slugToken(value: string): string {
    return value
      .normalize("NFKC")
      .trim()
      .toLowerCase()
      .replace(/[^\p{Letter}\p{Number}\s-]/gu, "")
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  private hashToken(value: string): string {
    return createHash("sha1").update(value.normalize("NFKC")).digest("hex").slice(0, 12);
  }

  private mergeNotes(existingNotes: string[], incomingNotes: string[]): string[] {
    return [...new Set([...existingNotes, ...incomingNotes])];
  }
}