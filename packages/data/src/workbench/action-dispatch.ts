import type { WorkbenchImpactSummary } from "./impact-analysis";

export type WorkbenchActionLane = "auto" | "review" | "conflict";

export type WorkbenchActionStrategy =
  | "auto-apply"
  | "review-source-evidence"
  | "wait-for-more-context"
  | "convert-source-format"
  | "resolve-factual-conflict";

export interface WorkbenchActionPlan {
  lane: WorkbenchActionLane;
  strategy: WorkbenchActionStrategy;
  title: string;
  primaryAction: string;
  steps: string[];
  systemActions: string[];
}

export interface WorkbenchActionPlanInput {
  blockingLevel: "none" | "review" | "conflict";
  riskNature: string;
  reviewKinds: string[];
  recommendedActions: string[];
  isAutoApprovable: boolean;
  impactSummary?: WorkbenchImpactSummary;
}

const recommendedActionCopyMap: Record<string, string> = {
  "auto-approve": "可以直接批量通过当前变更包。",
  "review-summary-preview": "先看摘要预览，确认系统概括的方向没有跑偏。",
  "review-extraction-preview": "先看抽取预览，确认角色、关系、伏笔和时间线命中是否合理。",
  "inspect-source-text": "回看原文关键段落，确认这次判断不是误读剧情。",
  "import-supported-format": "先把源文件转成受支持格式，再重新同步。",
  "retry-after-more-content": "等章节内容更完整后，再重新同步一次。",
};

export function buildWorkbenchActionPlan(input: WorkbenchActionPlanInput): WorkbenchActionPlan {
  const steps = new Set<string>();
  const systemActions = new Set<string>();

  const lane = resolveLane(input);
  const strategy = resolveStrategy(input);
  const title = resolveTitle(strategy);
  const primaryAction = resolvePrimaryAction(strategy, input.reviewKinds);

  for (const recommendedAction of input.recommendedActions) {
    const copy = recommendedActionCopyMap[recommendedAction];
    if (copy) {
      steps.add(copy);
    }
  }

  appendStrategySteps(steps, strategy);
  appendImpactDrivenSteps(steps, input.impactSummary);
  appendStrategySystemActions(systemActions, strategy);
  appendImpactDrivenSystemActions(systemActions, input.impactSummary);

  if (!steps.size) {
    steps.add("先核对原文证据，再决定是否通过当前变更包。");
  }

  if (!systemActions.size) {
    systemActions.add("通过后会把结果回写到结构化资产层。");
  }

  return {
    lane,
    strategy,
    title,
    primaryAction,
    steps: [...steps].slice(0, 6),
    systemActions: [...systemActions].slice(0, 6),
  };
}

function resolveLane(input: WorkbenchActionPlanInput): WorkbenchActionLane {
  if (input.isAutoApprovable) {
    return "auto";
  }
  if (input.blockingLevel === "conflict") {
    return "conflict";
  }
  return "review";
}

function resolveStrategy(input: WorkbenchActionPlanInput): WorkbenchActionStrategy {
  if (input.isAutoApprovable) {
    return "auto-apply";
  }

  switch (input.riskNature) {
    case "factual-conflict":
      return "resolve-factual-conflict";
    case "format-blocker":
      return "convert-source-format";
    case "information-gap":
      return "wait-for-more-context";
    default:
      return "review-source-evidence";
  }
}

function resolveTitle(strategy: WorkbenchActionStrategy): string {
  switch (strategy) {
    case "auto-apply":
      return "系统可自动接收";
    case "wait-for-more-context":
      return "信息还不够完整，先保留候选";
    case "convert-source-format":
      return "先处理文件格式，再重新同步";
    case "resolve-factual-conflict":
      return "先解决事实冲突，再决定是否写回";
    default:
      return "先复核证据，再决定是否写回";
  }
}

function resolvePrimaryAction(strategy: WorkbenchActionStrategy, reviewKinds: string[]): string {
  switch (strategy) {
    case "auto-apply":
      return "直接自动处理低风险变更包即可。";
    case "wait-for-more-context":
      return "先判断这次是信息不足，还是需要补充正文后再重试。";
    case "convert-source-format":
      return "先把文件转成受支持格式，再重新跑同步和抽取。";
    case "resolve-factual-conflict":
      return "先核对原文与既有事实，确认这到底是真变化还是误判。";
    default:
      if (reviewKinds.includes("summary-validation")) {
        return "先看摘要预览是否准确概括了这次改动。";
      }
      return "先看抽取预览是否命中了真正重要的剧情事实。";
  }
}

function appendStrategySteps(steps: Set<string>, strategy: WorkbenchActionStrategy) {
  switch (strategy) {
    case "wait-for-more-context":
      steps.add("如果正文本身就没写明，不要强行入库，先保留候选。");
      steps.add("只有在后续章节补全后，再重新同步一次。");
      break;
    case "convert-source-format":
      steps.add("把源文件转成 .md 或 .txt 后，再重新扫描。");
      break;
    case "resolve-factual-conflict":
      steps.add("优先核对原文和既有事实层，确认谁是对的。");
      steps.add("只有确认冲突已经澄清，再决定是否覆盖旧事实。");
      break;
    case "review-source-evidence":
      steps.add("优先看证据引用和原文片段，再决定是否通过。");
      break;
    default:
      break;
  }
}

function appendImpactDrivenSteps(steps: Set<string>, impactSummary?: WorkbenchImpactSummary) {
  if (!impactSummary) {
    return;
  }

  if (impactSummary.newCharacterCount > 0) {
    steps.add(`确认 ${impactSummary.newCharacterCount} 个新角色候选是否应该正式入库。`);
  }
  if (impactSummary.affectedCharacterCount > 0) {
    steps.add(`确认 ${impactSummary.affectedCharacterCount} 个既有角色事实是否需要刷新。`);
  }
  if (impactSummary.affectedRelationshipCount > 0) {
    steps.add(`重点检查 ${impactSummary.affectedRelationshipCount} 条关系事实是否需要改写。`);
  }
  if (impactSummary.affectedForeshadowCount > 0) {
    steps.add(`重点检查 ${impactSummary.affectedForeshadowCount} 条伏笔是否要推进、回收或改期。`);
  }
  if (impactSummary.timelineSignalCount > 0) {
    steps.add(`重点检查 ${impactSummary.timelineSignalCount} 个时间线标记是否会影响连续性。`);
  }
  if (impactSummary.downstreamChapterCount > 0) {
    steps.add(`必要时复核后续 ${impactSummary.downstreamChapterCount} 章，避免连锁偏移。`);
  }
}

function appendStrategySystemActions(systemActions: Set<string>, strategy: WorkbenchActionStrategy) {
  switch (strategy) {
    case "auto-apply":
      systemActions.add("自动通过后会直接回写结构化事实层。");
      break;
    case "wait-for-more-context":
      systemActions.add("系统会暂时保留候选，不会直接覆盖现有事实。");
      systemActions.add("后续章节补全后，可以再次重跑同步和抽取。");
      break;
    case "convert-source-format":
      systemActions.add("在文件格式修正前，系统不会继续抽取或写回事实层。");
      break;
    case "resolve-factual-conflict":
      systemActions.add("冲突未解决前，系统不会自动覆盖既有事实。");
      systemActions.add("只有人工确认后，冲突相关事实才会继续回写。");
      break;
    default:
      systemActions.add("通过后会把结果回写到结构化资产层。");
      systemActions.add("如仍有疑点，可再次重跑抽取或回看原文。");
      break;
  }
}

function appendImpactDrivenSystemActions(systemActions: Set<string>, impactSummary?: WorkbenchImpactSummary) {
  if (!impactSummary) {
    return;
  }

  if (impactSummary.affectedRelationshipCount > 0) {
    systemActions.add("通过后会刷新关系事实层。");
  }
  if (impactSummary.affectedForeshadowCount > 0) {
    systemActions.add("通过后会刷新伏笔账本。");
  }
  if (impactSummary.timelineSignalCount > 0) {
    systemActions.add("通过后会刷新时间线事件。");
  }
  if (impactSummary.downstreamChapterCount > 0) {
    systemActions.add("系统会把受影响的后续章节标记为建议复核。");
  }
  if (impactSummary.newCharacterCount > 0) {
    systemActions.add("通过后会尝试补全新角色事实。");
  }
}