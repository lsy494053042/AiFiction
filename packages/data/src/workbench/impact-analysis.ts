import path from "node:path";

import type {
  ChapterCard,
  CharacterCard,
  ForeshadowLedgerItem,
  VolumeOutline,
} from "@aifiction/schemas";

import type { SyncAssetUpdateRecord } from "../repositories/v2";

export interface WorkbenchSourceDocumentContext {
  id: string;
  relativePath: string;
  documentKind: string;
  mappedScopeType?: string;
  mappedScopeId?: string;
}

export interface WorkbenchImpactEntry {
  id?: string;
  type: "character" | "relationship" | "foreshadow" | "chapter" | "timeline";
  label: string;
  reason: string;
}

export interface WorkbenchImpactSummary {
  summary: string;
  mappedChapterId?: string;
  mappedChapterTitle?: string;
  affectedCharacterCount: number;
  newCharacterCount: number;
  affectedRelationshipCount: number;
  affectedForeshadowCount: number;
  downstreamChapterCount: number;
  timelineSignalCount: number;
  topEntries: WorkbenchImpactEntry[];
}

export interface ReviewBundleImpactInput {
  sourceDocument?: WorkbenchSourceDocumentContext;
  assetUpdates: SyncAssetUpdateRecord[];
  characters: CharacterCard[];
  chapters: ChapterCard[];
  volumes: VolumeOutline[];
  foreshadows: ForeshadowLedgerItem[];
}

interface RelationshipCandidate {
  sourceName: string;
  targetName: string;
  relationHint?: string;
}

interface ForeshadowCandidate {
  label: string;
  description?: string;
}

interface TimelineCandidate {
  label: string;
  timeMarker?: string;
}

export function buildReviewBundleImpactSummary(
  input: ReviewBundleImpactInput,
): WorkbenchImpactSummary | undefined {
  if (!input.sourceDocument) {
    return undefined;
  }

  const characterCandidates = readCharacterCandidates(input.assetUpdates);
  const relationshipCandidates = readRelationshipCandidates(input.assetUpdates);
  const foreshadowCandidates = readForeshadowCandidates(input.assetUpdates);
  const timelineCandidates = readTimelineCandidates(input.assetUpdates);

  const characterByName = new Map(
    input.characters.map((character) => [normalizeText(character.name), character]),
  );

  const mentionedNames = new Set<string>();
  for (const candidate of characterCandidates) {
    if (candidate.name.trim()) {
      mentionedNames.add(candidate.name.trim());
    }
  }
  for (const candidate of relationshipCandidates) {
    if (candidate.sourceName.trim()) {
      mentionedNames.add(candidate.sourceName.trim());
    }
    if (candidate.targetName.trim()) {
      mentionedNames.add(candidate.targetName.trim());
    }
  }

  const characterEntries: WorkbenchImpactEntry[] = [];
  let affectedCharacterCount = 0;
  let newCharacterCount = 0;

  for (const name of mentionedNames) {
    const matchedCharacter = characterByName.get(normalizeText(name));
    if (matchedCharacter) {
      affectedCharacterCount += 1;
      characterEntries.push({
        id: matchedCharacter.id,
        type: "character",
        label: matchedCharacter.name,
        reason: "Existing character facts may need to absorb the new chapter evidence.",
      });
      continue;
    }

    newCharacterCount += 1;
  }

  const relationshipEntries: WorkbenchImpactEntry[] = [];
  for (const candidate of relationshipCandidates) {
    const sourceCharacter = characterByName.get(normalizeText(candidate.sourceName));
    const targetCharacter = characterByName.get(normalizeText(candidate.targetName));
    if (!sourceCharacter || !targetCharacter) {
      continue;
    }

    const existingRelationship = sourceCharacter.relationships.find(
      (relationship) => relationship.targetCharacterId === targetCharacter.id,
    );

    relationshipEntries.push({
      id: `${sourceCharacter.id}:${targetCharacter.id}`,
      type: "relationship",
      label: `${sourceCharacter.name} -> ${targetCharacter.name}`,
      reason: existingRelationship
        ? `May change the existing ${existingRelationship.publicLabel} relationship fact.`
        : `May create a new ${candidate.relationHint ?? "relationship"} fact between these characters.`,
    });
  }

  const mappedChapter = resolveMappedChapter(input.sourceDocument, input.chapters, input.volumes);
  const chapterSequence = orderChapters(input.chapters, input.volumes);
  const mappedChapterIndex = mappedChapter
    ? chapterSequence.findIndex((chapter) => chapter.id === mappedChapter.id)
    : -1;
  const downstreamChapters = mappedChapterIndex >= 0
    ? chapterSequence.slice(mappedChapterIndex + 1)
    : [];

  const foreshadowEntries: WorkbenchImpactEntry[] = [];
  const relatedForeshadows = mappedChapter
    ? input.foreshadows.filter((foreshadow) => (
        foreshadow.seedChapterId === mappedChapter.id
        || foreshadow.expectedPayoffChapterId === mappedChapter.id
        || foreshadow.actualPayoffChapterId === mappedChapter.id
      ))
    : [];

  for (const foreshadow of relatedForeshadows) {
    let reason = "This tracked foreshadow is anchored to the same chapter.";
    if (foreshadow.actualPayoffChapterId === mappedChapter?.id) {
      reason = "This tracked foreshadow is already marked as paid off in the same chapter.";
    } else if (foreshadow.expectedPayoffChapterId === mappedChapter?.id) {
      reason = "This tracked foreshadow is expected to pay off in the same chapter.";
    }

    foreshadowEntries.push({
      id: foreshadow.id,
      type: "foreshadow",
      label: foreshadow.description,
      reason,
    });
  }

  if (!foreshadowEntries.length && foreshadowCandidates.length) {
    foreshadowEntries.push({
      type: "foreshadow",
      label: foreshadowCandidates[0].label,
      reason: `${foreshadowCandidates.length} new foreshadow signals were extracted from this source.`,
    });
  }

  const downstreamEntries: WorkbenchImpactEntry[] = downstreamChapters.slice(0, 3).map((chapter) => ({
    id: chapter.id,
    type: "chapter",
    label: `Chapter ${chapter.order} / ${chapter.title}`,
    reason: timelineCandidates.length > 0
      ? "Timeline markers in this source may require a continuity check for later chapters."
      : "New structured facts in this source may require a quick downstream check.",
  }));

  const topEntries = dedupeImpactEntries([
    ...characterEntries,
    ...relationshipEntries,
    ...foreshadowEntries,
    ...downstreamEntries,
  ]).slice(0, 6);

  const summaryParts: string[] = [];
  if (mappedChapter) {
    summaryParts.push(`Mapped to ${mappedChapter.title}.`);
  } else if (input.sourceDocument.documentKind === "chapter") {
    summaryParts.push("Chapter mapping is still provisional, so downstream impact is approximate.");
  }
  if (affectedCharacterCount > 0) {
    summaryParts.push(`${affectedCharacterCount} existing characters may need a refresh.`);
  }
  if (newCharacterCount > 0) {
    summaryParts.push(`${newCharacterCount} new character candidates were detected.`);
  }
  if (relationshipEntries.length > 0) {
    summaryParts.push(`${relationshipEntries.length} relationship facts may change.`);
  }
  if (relatedForeshadows.length > 0) {
    summaryParts.push(`${relatedForeshadows.length} tracked foreshadows are tied to this chapter.`);
  } else if (foreshadowCandidates.length > 0) {
    summaryParts.push(`${foreshadowCandidates.length} new foreshadow signals were extracted.`);
  }
  if (timelineCandidates.length > 0) {
    summaryParts.push(`${timelineCandidates.length} timeline markers were detected.`);
  }
  if (downstreamChapters.length > 0) {
    summaryParts.push(`${downstreamChapters.length} later chapters may need a follow-up check.`);
  }

  if (!summaryParts.length) {
    return undefined;
  }

  return {
    summary: summaryParts.join(" "),
    mappedChapterId: mappedChapter?.id,
    mappedChapterTitle: mappedChapter?.title,
    affectedCharacterCount,
    newCharacterCount,
    affectedRelationshipCount: relationshipEntries.length,
    affectedForeshadowCount: relatedForeshadows.length,
    downstreamChapterCount: downstreamChapters.length,
    timelineSignalCount: timelineCandidates.length,
    topEntries,
  };
}

function readCharacterCandidates(assetUpdates: SyncAssetUpdateRecord[]): Array<{ name: string }> {
  return readCandidates(assetUpdates, "character-candidate-bundle").flatMap((item) => {
    if (typeof item.name !== "string") {
      return [];
    }

    return [{ name: item.name }];
  });
}

function readRelationshipCandidates(assetUpdates: SyncAssetUpdateRecord[]): RelationshipCandidate[] {
  return readCandidates(assetUpdates, "relationship-candidate-bundle").flatMap((item) => {
    if (typeof item.sourceName !== "string" || typeof item.targetName !== "string") {
      return [];
    }

    return [{
      sourceName: item.sourceName,
      targetName: item.targetName,
      relationHint: typeof item.relationHint === "string" ? item.relationHint : undefined,
    }];
  });
}

function readForeshadowCandidates(assetUpdates: SyncAssetUpdateRecord[]): ForeshadowCandidate[] {
  return readCandidates(assetUpdates, "foreshadow-candidate-bundle").flatMap((item) => {
    if (typeof item.label !== "string") {
      return [];
    }

    return [{
      label: item.label,
      description: typeof item.description === "string" ? item.description : undefined,
    }];
  });
}

function readTimelineCandidates(assetUpdates: SyncAssetUpdateRecord[]): TimelineCandidate[] {
  return readCandidates(assetUpdates, "timeline-candidate-bundle").flatMap((item) => {
    if (typeof item.label !== "string") {
      return [];
    }

    return [{
      label: item.label,
      timeMarker: typeof item.timeMarker === "string" ? item.timeMarker : undefined,
    }];
  });
}

function readCandidates(assetUpdates: SyncAssetUpdateRecord[], assetType: string): Array<Record<string, unknown>> {
  return assetUpdates
    .filter((assetUpdate) => assetUpdate.assetType === assetType)
    .flatMap((assetUpdate) => {
      const candidates = assetUpdate.proposedPayloadJson.candidates;
      return Array.isArray(candidates)
        ? candidates.filter((candidate): candidate is Record<string, unknown> => !!candidate && typeof candidate === "object")
        : [];
    });
}

function resolveMappedChapter(
  sourceDocument: WorkbenchSourceDocumentContext,
  chapters: ChapterCard[],
  volumes: VolumeOutline[],
): ChapterCard | undefined {
  const chapterById = new Map(chapters.map((chapter) => [chapter.id, chapter]));
  if (sourceDocument.mappedScopeType === "chapter" && sourceDocument.mappedScopeId) {
    const mappedChapter = chapterById.get(sourceDocument.mappedScopeId);
    if (mappedChapter) {
      return mappedChapter;
    }
  }

  if (sourceDocument.documentKind !== "chapter") {
    return undefined;
  }

  const orderedChapters = orderChapters(chapters, volumes);
  const baseName = path.basename(sourceDocument.relativePath, path.extname(sourceDocument.relativePath));
  const numericMatch = baseName.match(/^(\d{1,6})/);
  if (numericMatch) {
    const chapterOrder = Number.parseInt(numericMatch[1], 10);
    const orderMatches = orderedChapters.filter((chapter) => chapter.order === chapterOrder);
    if (orderMatches.length === 1) {
      return orderMatches[0];
    }
  }

  const normalizedBaseTitle = normalizeTitleToken(baseName.replace(/^[\d\s._-]+/, ""));
  if (!normalizedBaseTitle) {
    return undefined;
  }

  const titleMatches = orderedChapters.filter((chapter) => {
    const normalizedChapterTitle = normalizeTitleToken(chapter.title);
    return normalizedChapterTitle.includes(normalizedBaseTitle)
      || normalizedBaseTitle.includes(normalizedChapterTitle);
  });

  return titleMatches.length === 1 ? titleMatches[0] : undefined;
}

function orderChapters(chapters: ChapterCard[], volumes: VolumeOutline[]): ChapterCard[] {
  const volumeOrderById = new Map(volumes.map((volume) => [volume.id, volume.order]));

  return [...chapters].sort((left, right) => {
    const volumeDelta = (volumeOrderById.get(left.volumeId) ?? Number.MAX_SAFE_INTEGER)
      - (volumeOrderById.get(right.volumeId) ?? Number.MAX_SAFE_INTEGER);
    if (volumeDelta !== 0) {
      return volumeDelta;
    }

    const chapterDelta = left.order - right.order;
    if (chapterDelta !== 0) {
      return chapterDelta;
    }

    return left.title.localeCompare(right.title, "zh-CN");
  });
}

function normalizeText(value: string): string {
  return value.trim().normalize("NFKC").toLowerCase();
}

function normalizeTitleToken(value: string): string {
  return normalizeText(value).replace(/[^\p{Letter}\p{Number}]+/gu, " ").trim();
}

function dedupeImpactEntries(entries: WorkbenchImpactEntry[]): WorkbenchImpactEntry[] {
  const seen = new Set<string>();
  const results: WorkbenchImpactEntry[] = [];

  for (const entry of entries) {
    const key = `${entry.type}:${entry.id ?? entry.label}:${entry.reason}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    results.push(entry);
  }

  return results;
}
