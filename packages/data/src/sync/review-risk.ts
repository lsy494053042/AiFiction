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
    reasons.push("Summary preview confidence is below the low-risk threshold.");
    recommendedActions.add("review-summary-preview");
  }

  if (input.reviewKind === "extraction-preview-validation" && input.severity !== "low") {
    categories.add("extraction-low-confidence");
    reasons.push("Extraction preview confidence is below the low-risk threshold.");
    recommendedActions.add("review-extraction-preview");
  }

  if (input.reviewKind === "unsupported-source-format") {
    categories.add("unsupported-source-format");
    reasons.push(readUnsupportedReason(input.detailJson));
    recommendedActions.add("import-supported-format");
  }

  if (input.severity === "high") {
    categories.add("high-severity-review");
    reasons.push("The review item is marked as high severity.");
    recommendedActions.add("inspect-source-text");
  }

  for (const hint of reviewHints) {
    reasons.push(hint);
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
    return value;
  }

  return "Source format is unsupported and needs manual handling.";
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
      return "Low-severity summary preview with no review hints.";
    case "extraction-preview-validation":
      return "Low-severity extraction preview with no review hints.";
    default:
      return "Low-severity review item with no risk signals.";
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