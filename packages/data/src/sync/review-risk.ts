export type ReviewBlockingLevel = "none" | "review" | "conflict";

export type ReviewRiskCategory =
  | "summary-low-confidence"
  | "extraction-low-confidence"
  | "missing-character-candidates"
  | "missing-relationship-signal"
  | "missing-foreshadow-signal"
  | "missing-timeline-signal"
  | "unsupported-source-format"
  | "high-severity-review";

export type ReviewRiskNature =
  | "none"
  | "information-gap"
  | "confidence-review"
  | "format-blocker"
  | "factual-conflict";

export type ReviewRecommendedAction =
  | "auto-approve"
  | "review-summary-preview"
  | "review-extraction-preview"
  | "inspect-source-text"
  | "import-supported-format"
  | "retry-after-more-content";

export interface ReviewRiskAssessment {
  blockingLevel: ReviewBlockingLevel;
  categories: ReviewRiskCategory[];
  nature: ReviewRiskNature;
  reasons: string[];
  recommendedActions: ReviewRecommendedAction[];
  autoApprovalReasons: string[];
  isAutoApprovable: boolean;
}

export interface ReviewRiskInput {
  reviewKind: string;
  severity: string;
  detailJson: Record<string, unknown>;
}

const hintCategoryMatchers: Array<{ match: string; category: ReviewRiskCategory }> = [
  { match: "No stable character candidates were detected yet.", category: "missing-character-candidates" },
  { match: "No stable character candidate bundle was extracted.", category: "missing-character-candidates" },
  { match: "No clear relationship signal was extracted from the current text.", category: "missing-relationship-signal" },
  { match: "No obvious foreshadow candidate was extracted.", category: "missing-foreshadow-signal" },
  { match: "No explicit timeline marker was extracted.", category: "missing-timeline-signal" },
];

const informationGapCategories = new Set<ReviewRiskCategory>([
  "missing-character-candidates",
  "missing-relationship-signal",
  "missing-foreshadow-signal",
  "missing-timeline-signal",
]);

const confidenceCategories = new Set<ReviewRiskCategory>([
  "summary-low-confidence",
  "extraction-low-confidence",
]);

export function assessReviewRisk(input: ReviewRiskInput): ReviewRiskAssessment {
  const categories = new Set<ReviewRiskCategory>();
  const reasons: string[] = [];
  const autoApprovalReasons: string[] = [];
  const recommendedActions = new Set<ReviewRecommendedAction>();
  const reviewHints = readReviewHints(input.detailJson);

  if (input.reviewKind === "summary-validation" && input.severity !== "low") {
    categories.add("summary-low-confidence");
    reasons.push("摘要预览的置信度低于低风险阈值。");
    recommendedActions.add("review-summary-preview");
  }

  if (input.reviewKind === "extraction-preview-validation" && input.severity !== "low") {
    categories.add("extraction-low-confidence");
    reasons.push("抽取预览的置信度低于低风险阈值。");
    recommendedActions.add("review-extraction-preview");
  }

  if (input.reviewKind === "unsupported-source-format") {
    categories.add("unsupported-source-format");
    reasons.push(readUnsupportedReason(input.detailJson));
    recommendedActions.add("import-supported-format");
  }

  if (input.severity === "high") {
    categories.add("high-severity-review");
    reasons.push("当前审查项被标记为高风险。");
    recommendedActions.add("inspect-source-text");
  }

  for (const hint of reviewHints) {
    reasons.push(translateReviewHint(hint));
    for (const matcher of hintCategoryMatchers) {
      if (hint.includes(matcher.match)) {
        categories.add(matcher.category);
      }
    }
  }

  for (const category of categories) {
    if (informationGapCategories.has(category)) {
      recommendedActions.add("inspect-source-text");
      recommendedActions.add("retry-after-more-content");
    }
  }

  const blockingLevel = resolveBlockingLevel(input.severity, categories, reviewHints.length);
  const nature = resolveRiskNature(categories);
  const isAutoApprovable =
    input.severity === "low" &&
    reviewHints.length === 0 &&
    categories.size === 0 &&
    input.reviewKind !== "unsupported-source-format";

  if (isAutoApprovable) {
    autoApprovalReasons.push(createAutoApprovalReason(input.reviewKind));
    recommendedActions.add("auto-approve");
  }

  return {
    blockingLevel,
    categories: [...categories],
    nature,
    reasons: dedupeStrings(reasons).slice(0, 6),
    recommendedActions: [...recommendedActions],
    autoApprovalReasons,
    isAutoApprovable,
  };
}

function readReviewHints(detailJson: Record<string, unknown>): string[] {
  const value = detailJson.reviewHints;
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function readUnsupportedReason(detailJson: Record<string, unknown>): string {
  const value = detailJson.unsupportedReason;
  if (typeof value === "string" && value.trim().length > 0) {
    return translateReviewHint(value);
  }

  return "当前源文件格式不受支持，需要先人工转换或补录。";
}

function translateReviewHint(hint: string): string {
  switch (hint) {
    case "No stable character candidates were detected yet.":
      return "当前还没有检测到稳定的角色候选。";
    case "No stable character candidate bundle was extracted.":
      return "当前没有抽取到稳定的角色候选包。";
    case "No clear relationship signal was extracted from the current text.":
      return "当前文本里还没有提取到清晰的关系信号。";
    case "No obvious foreshadow candidate was extracted.":
      return "当前文本里还没有提取到明显的伏笔候选。";
    case "No explicit timeline marker was extracted.":
      return "当前文本里还没有提取到明确的时间线标记。";
    default:
      return hint;
  }
}

function resolveBlockingLevel(
  severity: string,
  categories: Set<ReviewRiskCategory>,
  reviewHintCount: number,
): ReviewBlockingLevel {
  if (severity === "high") {
    return "conflict";
  }

  if (severity === "medium" || reviewHintCount > 0 || categories.size > 0) {
    return "review";
  }

  return "none";
}

function resolveRiskNature(categories: Set<ReviewRiskCategory>): ReviewRiskNature {
  if (categories.has("high-severity-review")) {
    return "factual-conflict";
  }

  if (categories.has("unsupported-source-format")) {
    return "format-blocker";
  }

  for (const category of categories) {
    if (informationGapCategories.has(category)) {
      return "information-gap";
    }
  }

  for (const category of categories) {
    if (confidenceCategories.has(category)) {
      return "confidence-review";
    }
  }

  return "none";
}

function createAutoApprovalReason(reviewKind: string): string {
  switch (reviewKind) {
    case "summary-validation":
      return "低风险的摘要预览，且没有额外审查提示。";
    case "extraction-preview-validation":
      return "低风险的抽取预览，且没有额外审查提示。";
    default:
      return "低风险审查项，没有额外风险信号。";
  }
}

function dedupeStrings(values: string[]): string[] {
  const result = new Set<string>();
  for (const value of values) {
    const normalized = value.trim();
    if (normalized) {
      result.add(normalized);
    }
  }
  return [...result];
}