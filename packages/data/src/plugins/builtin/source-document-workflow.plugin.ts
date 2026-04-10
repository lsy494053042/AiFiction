import type { BookProtocol, WorkProtocolSummary, WritingPackGateStatusRecord } from "../../protocol/workspace-protocol.service";
import type {
  WorkbenchProjectSnapshot,
  WorkbenchReviewBundleSummary,
  WorkbenchSemanticProjectionCandidate,
  WorkbenchSourceDocumentSemanticSummary,
  WorkbenchSourceRefSummary,
} from "../../workbench";
import type {
  AifictionPlugin,
  SourceDocumentSemanticContextResult,
  SourceDocumentSemanticHighlightRenderItem,
  WritingPackGateAssessmentResult,
} from "../types";

function semanticConfidenceRank(confidenceLevel?: string): number {
  switch (confidenceLevel) {
    case "medium":
      return 2;
    case "low":
      return 1;
    default:
      return 0;
  }
}

function semanticDocumentRank(summary: WorkbenchSourceDocumentSemanticSummary): number {
  const templateKey = (summary.templateKey ?? "").trim();
  switch (templateKey) {
    case "project-brief":
      return 1;
    case "world-setting":
      return 2;
    case "organization-ecology":
      return 3;
    case "character-setting":
      return 4;
    default:
      return 10;
  }
}

function compareSemanticCandidates(
  left: WorkbenchSemanticProjectionCandidate,
  right: WorkbenchSemanticProjectionCandidate,
): number {
  if (left.semanticKey === "root" && right.semanticKey !== "root") {
    return -1;
  }

  if (left.semanticKey !== "root" && right.semanticKey === "root") {
    return 1;
  }

  const confidenceDelta = semanticConfidenceRank(right.confidenceLevel) - semanticConfidenceRank(left.confidenceLevel);
  if (confidenceDelta !== 0) {
    return confidenceDelta;
  }

  const edgeDelta = right.edgeCount - left.edgeCount;
  if (edgeDelta !== 0) {
    return edgeDelta;
  }

  const keywordDelta = right.keywords.length - left.keywords.length;
  if (keywordDelta !== 0) {
    return keywordDelta;
  }

  return left.displayName.localeCompare(right.displayName, "zh-CN");
}

function compareSemanticDocuments(
  left: WorkbenchSourceDocumentSemanticSummary,
  right: WorkbenchSourceDocumentSemanticSummary,
): number {
  const rankDelta = semanticDocumentRank(left) - semanticDocumentRank(right);
  if (rankDelta !== 0) {
    return rankDelta;
  }

  return (left.relativePath ?? left.title).localeCompare(right.relativePath ?? right.title, "zh-CN");
}

function toSourceDocumentSemanticEntitySummary(candidate: WorkbenchSemanticProjectionCandidate) {
  return {
    entityId: candidate.entityId,
    entityType: candidate.entityType,
    displayName: candidate.displayName,
    summary: candidate.summary,
    semanticKey: candidate.semanticKey,
    semanticGroup: candidate.semanticGroup,
    confidenceLevel: candidate.confidenceLevel,
    extractionMode: candidate.extractionMode,
    sectionTitle: candidate.sectionTitle,
    evidenceExcerpt: candidate.evidenceExcerpt,
    edgeCount: candidate.edgeCount,
    listItems: candidate.listItems,
    keywords: candidate.keywords,
  };
}

function buildSemanticSummaries(
  candidates: WorkbenchSemanticProjectionCandidate[],
): WorkbenchSourceDocumentSemanticSummary[] {
  const groups = new Map<string, WorkbenchSemanticProjectionCandidate[]>();
  for (const candidate of candidates) {
    const groupKey = candidate.sourceDocumentId ?? candidate.relativePath ?? candidate.entityId;
    const existing = groups.get(groupKey);
    if (existing) {
      existing.push(candidate);
      continue;
    }

    groups.set(groupKey, [candidate]);
  }

  return Array.from(groups.values())
    .map((group) => {
      const sortedGroup = [...group].sort((left, right) => compareSemanticCandidates(left, right));
      const root = sortedGroup.find((candidate) => candidate.semanticKey === "root") ?? sortedGroup[0];
      const semanticGroups = Array.from(new Set(sortedGroup.map((candidate) => candidate.semanticGroup))).sort((left, right) =>
        left.localeCompare(right, "zh-CN"),
      );
      const highlights = sortedGroup
        .filter((candidate) => candidate.semanticKey !== "root")
        .slice(0, 6)
        .map((candidate) => toSourceDocumentSemanticEntitySummary(candidate));

      return {
        sourceDocumentId: root.sourceDocumentId,
        relativePath: root.relativePath,
        docKind: root.docKind,
        templateKey: root.templateKey,
        scope: root.scope,
        title: root.displayName,
        summary: root.summary,
        semanticEntityCount: sortedGroup.length,
        semanticGroups,
        reviewHints: root.reviewHints,
        highlights,
      } satisfies WorkbenchSourceDocumentSemanticSummary;
    })
    .sort((left, right) => compareSemanticDocuments(left, right));
}

function buildSemanticHighlights(documents: WorkbenchSourceDocumentSemanticSummary[], maxCount: number) {
  return documents
    .flatMap((document) =>
      document.highlights.slice(0, 2).map((highlight) => ({
        document,
        highlight,
      })),
    )
    .slice(0, maxCount);
}

function buildWritingPackSemanticContext(snapshot: WorkbenchProjectSnapshot): SourceDocumentSemanticContextResult {
  const documents = snapshot.sourceDocumentSemantics.slice(0, 6);
  return {
    documents,
    highlights: buildSemanticHighlights(documents, 10),
  };
}

function buildRiskInvestigationSemanticContext(
  snapshot: WorkbenchProjectSnapshot,
  bundle: WorkbenchReviewBundleSummary,
  relatedSourceRefs: WorkbenchSourceRefSummary[],
): SourceDocumentSemanticContextResult {
  const directDocumentIds = new Set<string>();
  if (bundle.sourceDocumentId) {
    directDocumentIds.add(bundle.sourceDocumentId);
  }

  for (const sourceRef of relatedSourceRefs) {
    if (sourceRef.sourceDocumentId) {
      directDocumentIds.add(sourceRef.sourceDocumentId);
    }
  }

  const directMatches = snapshot.sourceDocumentSemantics.filter(
    (document) => document.sourceDocumentId && directDocumentIds.has(document.sourceDocumentId),
  );
  const documents = (directMatches.length ? directMatches : snapshot.sourceDocumentSemantics).slice(0, 4);
  return {
    documents,
    highlights: buildSemanticHighlights(documents, 8),
  };
}

function formatSourceSemanticDocumentLine(document: WorkbenchSourceDocumentSemanticSummary): string {
  const docLabel = document.relativePath ?? document.title;
  const groupLabel = document.semanticGroups.length ? document.semanticGroups.join(" / ") : "未分组";
  const hintLabel = document.reviewHints.length ? ` / 提示：${document.reviewHints.slice(0, 2).join("；")}` : "";
  return `- ${document.title}（${document.docKind ?? "unknown"} / ${document.templateKey ?? "未设模板"}）：${docLabel} / 语义实体 ${document.semanticEntityCount} 个 / 组别 ${groupLabel}${document.summary ? ` / ${document.summary}` : ""}${hintLabel}`;
}

function formatSourceSemanticHighlightLine(item: SourceDocumentSemanticHighlightRenderItem): string {
  const { document, highlight } = item;
  const keywordLabel = highlight.keywords.length ? ` / 关键词：${highlight.keywords.slice(0, 4).join("、")}` : "";
  const listItemLabel = highlight.listItems.length ? ` / 条目：${highlight.listItems.slice(0, 2).join("；")}` : "";
  const evidenceLabel =
    !highlight.summary && highlight.evidenceExcerpt ? ` / 证据：${highlight.evidenceExcerpt}` : "";
  return `- [${document.title}] ${highlight.displayName}（${highlight.entityType} / ${highlight.semanticGroup}）：${highlight.summary ?? "待补摘要"}${keywordLabel}${listItemLabel}${evidenceLabel}`;
}

function collectPrewriteProtocolBlockers(book: BookProtocol, taskType?: string): string[] {
  const blockers: string[] = [];
  const prewriteGate = book.prewrite_gate;
  const planningBudget = book.planning_budget;
  const volumeTarget = planningBudget?.volume_target;
  const volumeTargetLocked =
    [volumeTarget?.chapters_min, volumeTarget?.chapters_max, volumeTarget?.chars_min, volumeTarget?.chars_max].every(
      (value) => typeof value === "number" && value > 0,
    );

  const pushBlocker = (message: string) => {
    if (!blockers.includes(message)) {
      blockers.push(message);
    }
  };

  if (["planning", "replanning"].includes(taskType ?? "")) {
    pushBlocker("当前焦点仍处于规划态。");
  }
  if (prewriteGate?.current_platform_locked !== true) {
    pushBlocker("目标平台尚未最终锁定。");
  }
  if (prewriteGate?.current_stop_loss_locked !== true) {
    pushBlocker("止损线尚未锁定。");
  }
  if (prewriteGate?.current_total_target_locked !== true) {
    pushBlocker("全书目标字数尚未锁定。");
  }
  if (prewriteGate?.current_chapter_target_locked !== true) {
    pushBlocker("单章目标字数尚未锁定。");
  }
  if (prewriteGate?.current_volume_plan_complete !== true) {
    pushBlocker("整卷功能与卷末兑现点尚未确认完成。");
  }
  if (prewriteGate?.current_stage_map_complete !== true) {
    pushBlocker("当前卷阶段地图尚未完成。");
  }
  if (prewriteGate?.current_chapter_function_mix_defined !== true) {
    pushBlocker("当前卷章节功能配比尚未完成。");
  }
  if (prewriteGate?.current_transition_daily_slots_defined !== true) {
    pushBlocker("过渡章、关系章、日常章位置尚未确认。");
  }
  if (prewriteGate?.current_full_chapter_positioning_complete !== true) {
    pushBlocker("当前卷全章定位尚未完成。");
  }
  if (prewriteGate?.current_batch_outline_complete !== true) {
    pushBlocker("当前批次章纲尚未完成。");
  }
  if (prewriteGate?.current_volume_sized_by_content_first !== true) {
    pushBlocker("当前卷还没有按内容优先法完成体量测算。");
  }
  if (!volumeTargetLocked || prewriteGate?.current_volume_budget_locked !== true) {
    pushBlocker("当前卷章节数与卷字数预算尚未锁定。");
  }
  if (prewriteGate?.current_budget_alignment_verified !== true) {
    pushBlocker("当前卷章数与字数预算尚未完成对齐校验。");
  }
  if (prewriteGate?.current_batch_ready_to_write !== true) {
    pushBlocker("当前批次还未达到可开写状态。");
  }

  return blockers;
}

function assessWritingPackState(input: {
  summary: WorkProtocolSummary;
  book: BookProtocol;
  gateStatuses: WritingPackGateStatusRecord[];
}): WritingPackGateAssessmentResult {
  const { summary, book, gateStatuses } = input;
  const taskType = book.current_focus?.task_type;
  const reviewStatus = book.knowledge_state?.current_batch_review_status;
  const planningPolicy = summary.workspace?.execution_policy?.planning_first;
  const verificationPolicy = summary.workspace?.execution_policy?.verification_before_completion;
  const prewriteBlockers = collectPrewriteProtocolBlockers(book, taskType);

  const blockers: string[] = [];
  const nextActions: string[] = [];
  let mode: "drafting" | "review" | "planning" = "drafting";
  const pushBlocker = (message: string) => {
    if (!blockers.includes(message)) {
      blockers.push(message);
    }
  };
  const pushAction = (message: string) => {
    if (!nextActions.includes(message)) {
      nextActions.push(message);
    }
  };

  if (
    (planningPolicy?.require_full_volume_plan_before_drafting ?? book.prewrite_gate?.require_full_volume_plan_before_drafting) &&
    prewriteBlockers.length
  ) {
    mode = "planning";
    for (const blocker of prewriteBlockers) {
      pushBlocker(blocker);
    }
    pushAction("先补齐开写前协议门禁，再重新生成写作包。");
  }

  if (
    verificationPolicy?.require_evidence_before_mark_done &&
    book.knowledge_state?.current_batch_review_required === true &&
    reviewStatus !== "resolved"
  ) {
    if (mode !== "planning") {
      mode = "review";
    }
    pushBlocker("当前 batch 仍要求先完成复盘，复盘状态未 resolved。");
    pushAction("先完成当前批次复盘，再继续下一批正文。");
  }

  for (const gate of gateStatuses) {
    if (["pending", "blocked"].includes(gate.gateStatus)) {
      pushBlocker(`${gate.gateCode} 未通过`);
    }
  }

  if (!nextActions.length) {
    if (mode === "planning") {
      nextActions.push("先完成规划门禁，再重新生成写作包。");
    } else if (mode === "review") {
      nextActions.push("先处理当前批次复盘和 gate，再重新生成写作包。");
    } else {
      nextActions.push("继续按当前批次章纲推进正文。");
    }
  }

  return {
    mode,
    canDraft: blockers.length === 0,
    blockers,
    nextActions,
  };
}

export const builtinSourceDocumentWorkflowPlugin: AifictionPlugin = {
  manifest: {
    pluginId: "builtin.source-document-workflow",
    version: "1.0.0",
    apiVersion: "1",
    displayName: "Builtin Source Document Workflow",
    description: "Provides the default source-document semantic projection, context rendering, and writing gate policy.",
    builtin: true,
    requiresPlugins: ["builtin.source-document-definitions", "builtin.source-document-semantics"],
    capabilityKinds: [
      "source-document-semantic-projection",
      "source-document-semantic-context",
      "writing-pack-gate-policy",
    ],
  },
  sourceDocumentSemanticProjections: [
    {
      projectionKey: "default-source-document-semantics",
      priority: 100,
      buildSummaries: buildSemanticSummaries,
    },
  ],
  sourceDocumentSemanticContexts: [
    {
      contextKey: "default-source-document-semantics",
      priority: 100,
      buildWritingPackContext: buildWritingPackSemanticContext,
      buildRiskInvestigationPackContext: buildRiskInvestigationSemanticContext,
      formatDocumentLine: formatSourceSemanticDocumentLine,
      formatHighlightLine: formatSourceSemanticHighlightLine,
    },
  ],
  writingPackGatePolicies: [
    {
      policyKey: "default-writing-pack-gate-policy",
      priority: 100,
      collectPrewriteProtocolBlockers,
      assessWritingPackState,
    },
  ],
};
