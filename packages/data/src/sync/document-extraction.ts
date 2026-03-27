import type { SourceDocumentAnalysis } from "./document-analysis";

type ConfidenceLevel = "low" | "medium";

export interface ExtractedCharacterCandidate {
  name: string;
  mentionCount: number;
  confidenceLevel: ConfidenceLevel;
  evidence: string[];
}

export interface ExtractedRelationshipCandidate {
  sourceName: string;
  targetName: string;
  relationHint: string;
  confidenceLevel: ConfidenceLevel;
  evidence: string;
}

export interface ExtractedForeshadowCandidate {
  label: string;
  description: string;
  confidenceLevel: ConfidenceLevel;
  evidence: string;
}

export interface ExtractedTimelineCandidate {
  label: string;
  timeMarker: string;
  confidenceLevel: ConfidenceLevel;
  evidence: string;
}

export interface SourceDocumentExtractionPreview {
  characters: ExtractedCharacterCandidate[];
  relationships: ExtractedRelationshipCandidate[];
  foreshadows: ExtractedForeshadowCandidate[];
  timelineEvents: ExtractedTimelineCandidate[];
  reviewHints: string[];
}

const relationKeywordGroups: Array<{
  hint: string;
  confidenceLevel: ConfidenceLevel;
  keywords: string[];
}> = [
  {
    hint: "conflict",
    confidenceLevel: "medium",
    keywords: ["\u8ffd", "\u6740", "\u5a01\u80c1", "\u4e89\u5435", "\u654c\u89c6", "\u62d4\u5200", "\u5bf9\u5cd9"],
  },
  {
    hint: "support",
    confidenceLevel: "medium",
    keywords: ["\u5e2e", "\u6551", "\u62a4", "\u6276", "\u966a", "\u63d0\u9192", "\u63a9\u62a4"],
  },
  {
    hint: "watching",
    confidenceLevel: "low",
    keywords: ["\u770b\u7740", "\u76ef\u7740", "\u76ef", "\u8bd5\u63a2", "\u6000\u7591", "\u63d0\u9632"],
  },
];

const foreshadowKeywords = [
  "\u5370\u8bb0",
  "\u79d8\u5bc6",
  "\u7ebf\u7d22",
  "\u5f02\u5e38",
  "\u5f02\u6837",
  "\u9884\u611f",
  "\u4e0d\u8be5",
  "\u4f3c\u4e4e",
  "\u4eff\u4f5b",
  "\u9ed1\u5f71",
  "\u9057\u7269",
];

const timeMarkers = [
  "\u6e05\u6668",
  "\u65e9\u6668",
  "\u4e0a\u5348",
  "\u4e2d\u5348",
  "\u5348\u540e",
  "\u508d\u665a",
  "\u9ec4\u660f",
  "\u591c\u91cc",
  "\u591c\u665a",
  "\u534a\u591c",
  "\u51cc\u6668",
  "\u6b21\u65e5",
  "\u7b2c\u4e8c\u5929",
  "\u5f53\u665a",
  "\u9ece\u660e",
];

/**
 * 结构化抽取预览。
 * 当前先用启发式规则把角色、关系、伏笔、时间线候选提取出来，后续可替换成模型抽取。
 */
export function extractSourceDocumentPreview(input: {
  textContent: string;
  analysis: SourceDocumentAnalysis;
}): SourceDocumentExtractionPreview {
  const compactText = input.textContent.replace(/\r\n/g, "\n");
  const sentences = compactText
    .split(/[\u3002\uff01\uff1f!?\n]/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 6)
    .slice(0, 80);

  const characters = extractCharacters(compactText, input.analysis.candidateNames);
  const relationships = extractRelationships(sentences, characters.map((item) => item.name));
  const foreshadows = extractForeshadows(sentences);
  const timelineEvents = extractTimelineEvents(sentences);
  const reviewHints: string[] = [];

  if (!characters.length) {
    reviewHints.push("No stable character candidate bundle was extracted.");
  }
  if (!relationships.length) {
    reviewHints.push("No clear relationship signal was extracted from the current text.");
  }
  if (!foreshadows.length) {
    reviewHints.push("No obvious foreshadow candidate was extracted.");
  }
  if (!timelineEvents.length) {
    reviewHints.push("No explicit timeline marker was extracted.");
  }

  return {
    characters,
    relationships,
    foreshadows,
    timelineEvents,
    reviewHints,
  };
}

/**
 * 鐏忓棛绮ㄩ弸鍕閹惰棄褰囨０鍕潔閺嶇厧绱￠崠鏍ㄥ灇 Markdown閿涘本鏌熸笟澶告眽瀹搞儱鎻╅柅鐔奉吀閺屻儯鈧? */
export function formatExtractionPreviewArtifact(input: SourceDocumentExtractionPreview): string {
  const characterLines = input.characters.length
    ? input.characters.map((item) => `- ${item.name} | mentions=${item.mentionCount} | confidence=${item.confidenceLevel}`).join("\n")
    : "- None";
  const relationshipLines = input.relationships.length
    ? input.relationships.map((item) => `- ${item.sourceName} <-> ${item.targetName} | ${item.relationHint} | ${item.confidenceLevel}`).join("\n")
    : "- None";
  const foreshadowLines = input.foreshadows.length
    ? input.foreshadows.map((item) => `- ${item.label} | ${item.confidenceLevel}`).join("\n")
    : "- None";
  const timelineLines = input.timelineEvents.length
    ? input.timelineEvents.map((item) => `- ${item.timeMarker} | ${item.label} | ${item.confidenceLevel}`).join("\n")
    : "- None";
  const hintLines = input.reviewHints.length ? input.reviewHints.map((item) => `- ${item}`).join("\n") : "- None";

  return [
    "# Structured Extraction Preview",
    "",
    "## Character Candidates",
    characterLines,
    "",
    "## Relationship Candidates",
    relationshipLines,
    "",
    "## Foreshadow Candidates",
    foreshadowLines,
    "",
    "## Timeline Candidates",
    timelineLines,
    "",
    "## Review Hints",
    hintLines,
  ].join("\n");
}

function extractCharacters(text: string, candidateNames: string[]): ExtractedCharacterCandidate[] {
  return candidateNames
    .map((name): ExtractedCharacterCandidate => {
      const mentionCount = countLiteralMentions(text, name);
      return {
        name,
        mentionCount,
        confidenceLevel: mentionCount >= 3 ? "medium" : "low",
        evidence: buildEvidenceSnippets(text, name),
      };
    })
    .filter((item) => item.mentionCount >= 1)
    .sort((left, right) => right.mentionCount - left.mentionCount || left.name.localeCompare(right.name, "zh-CN"))
    .slice(0, 8);
}

function extractRelationships(sentences: string[], candidateNames: string[]): ExtractedRelationshipCandidate[] {
  const results = new Map<string, ExtractedRelationshipCandidate>();

  for (const sentence of sentences) {
    const presentNames = candidateNames.filter((name) => sentence.includes(name));
    if (presentNames.length < 2) {
      continue;
    }

    for (let index = 0; index < presentNames.length; index += 1) {
      for (let targetIndex = index + 1; targetIndex < presentNames.length; targetIndex += 1) {
        const sourceName = presentNames[index];
        const targetName = presentNames[targetIndex];
        const relation = inferRelation(sentence);
        const key = `${sourceName}:${targetName}:${relation.hint}`;

        if (!results.has(key)) {
          results.set(key, {
            sourceName,
            targetName,
            relationHint: relation.hint,
            confidenceLevel: relation.confidenceLevel,
            evidence: sentence,
          });
        }
      }
    }
  }

  return [...results.values()].slice(0, 8);
}

function extractForeshadows(sentences: string[]): ExtractedForeshadowCandidate[] {
  const results: ExtractedForeshadowCandidate[] = [];

  for (const sentence of sentences) {
    const matchedKeyword = foreshadowKeywords.find((keyword) => sentence.includes(keyword));
    if (!matchedKeyword) {
      continue;
    }

    results.push({
      label: matchedKeyword,
      description: sentence,
      confidenceLevel: sentence.length >= 18 ? "medium" : "low",
      evidence: sentence,
    });
  }

  return dedupeByEvidence(results).slice(0, 6);
}

function extractTimelineEvents(sentences: string[]): ExtractedTimelineCandidate[] {
  const results: ExtractedTimelineCandidate[] = [];

  for (const sentence of sentences) {
    const matchedMarker = timeMarkers.find((marker) => sentence.includes(marker));
    if (!matchedMarker) {
      continue;
    }

    results.push({
      label: sentence.length <= 28 ? sentence : `${sentence.slice(0, 25)}...`,
      timeMarker: matchedMarker,
      confidenceLevel: "medium",
      evidence: sentence,
    });
  }

  return dedupeByEvidence(results).slice(0, 6);
}

function inferRelation(sentence: string): { hint: string; confidenceLevel: ConfidenceLevel } {
  for (const group of relationKeywordGroups) {
    if (group.keywords.some((keyword) => sentence.includes(keyword))) {
      return {
        hint: group.hint,
        confidenceLevel: group.confidenceLevel,
      };
    }
  }

  return {
    hint: "co_occurrence",
    confidenceLevel: "low",
  };
}

function buildEvidenceSnippets(text: string, name: string): string[] {
  const sentences = text
    .split(/[\u3002\uff01\uff1f!?\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => item.includes(name));

  return sentences.slice(0, 3);
}

function countLiteralMentions(text: string, token: string): number {
  if (!token) {
    return 0;
  }

  return text.split(token).length - 1;
}

function dedupeByEvidence<T extends { evidence: string }>(items: T[]): T[] {
  const results = new Map<string, T>();
  for (const item of items) {
    if (!results.has(item.evidence)) {
      results.set(item.evidence, item);
    }
  }
  return [...results.values()];
}