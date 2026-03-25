import type {
  ChapterMemoryBundle,
  CharacterStateSnapshot,
  ContinuityReport,
  ForeshadowLedgerItem,
  WorldRule,
} from "@aifiction/schemas";

/**
 * 当前 prompt 模板版本。
 * 后续只要有提示词调整，就应该同步升级这个版本号。
 */
export const PROMPT_VERSION = "v0.1.0";

function formatBulletList(items: string[]): string {
  if (items.length === 0) {
    return "- 无";
  }

  return items.map((item) => `- ${item}`).join("\n");
}

function formatWorldRules(rules: WorldRule[]): string {
  if (rules.length === 0) {
    return "- 当前任务没有额外规则输入";
  }

  return rules
    .map((rule) => {
      const hardTag = rule.hardConstraint ? "[硬规则]" : "[软规则]";
      return `- ${hardTag} ${rule.title}: ${rule.description}`;
    })
    .join("\n");
}

function formatCharacterStates(states: CharacterStateSnapshot[]): string {
  if (states.length === 0) {
    return "- 当前没有角色状态快照";
  }

  return states
    .map((state) => {
      const facts = state.knows.slice(0, 4).join("；") || "暂无已知事实";
      const wounds = state.wounds.join("；") || "暂无明显伤势或限制";
      return `- 角色 ${state.characterId}：情绪=${state.emotionalState}；立场=${state.stanceSummary}；已知=${facts}；限制=${wounds}`;
    })
    .join("\n");
}

function formatForeshadows(items: ForeshadowLedgerItem[]): string {
  if (items.length === 0) {
    return "- 当前没有需要特别关注的伏笔";
  }

  return items
    .map((item) => `- [${item.status}] ${item.description}；目的=${item.narrativePurpose}`)
    .join("\n");
}

/**
 * 章节初稿阶段的系统提示词。
 * 这里强调的是边界、风格和一致性，而不是让模型自由发挥。
 */
export function buildDraftSystemPrompt(bundle: ChapterMemoryBundle): string {
  return [
    "你是网络长篇小说的协作写作助手。",
    "你的任务是根据结构化输入生成章节初稿，而不是擅自改写作品定位。",
    "必须严格遵守以下原则：",
    "1. 不得违反作品定位卡、世界规则和角色底层设定。",
    "2. 必须围绕章节卡完成本章目标，不能只写氛围不推进。",
    "3. 对话、情绪、节奏要服从风格卡。",
    "4. 如果输入没有提供的硬事实，不要自行发明决定性设定。",
    "5. 本章结尾必须落实章节卡中的结尾钩子或制造新的悬念收束。",
    `作品标题：${bundle.work.title}`,
    `一句话卖点：${bundle.work.tagline}`,
    `主类型：${bundle.work.genre}`,
    `目标平台：${bundle.work.targetPlatform}`,
    `叙事视角：${bundle.style.perspective}`,
    `语言密度：${bundle.style.languageDensity}`,
    `节奏强度：${bundle.style.pacing}`,
    `情绪浓度：${bundle.style.emotionLevel}`,
    "禁止表达：",
    formatBulletList(bundle.style.bannedPatterns),
  ].join("\n");
}

/**
 * 章节初稿阶段的用户提示词。
 * 这里提供的是当前任务需要的最小上下文集合。
 */
export function buildDraftUserPrompt(bundle: ChapterMemoryBundle): string {
  return [
    `当前卷：第 ${bundle.volume.order} 卷《${bundle.volume.title}》`,
    `本卷目标：${bundle.volume.goal}`,
    `本卷核心冲突：${bundle.volume.mainConflict}`,
    `当前章节：第 ${bundle.chapter.order} 章《${bundle.chapter.title}》`,
    `本章摘要：${bundle.chapter.summary}`,
    `本章目标：${bundle.chapter.chapterGoal}`,
    `本章冲突：${bundle.chapter.conflict}`,
    `开章局面：${bundle.chapter.entryState}`,
    `收章局面：${bundle.chapter.exitState}`,
    "本章必须回应的旧线索：",
    formatBulletList(bundle.chapter.requiredCallbacks),
    "本章新增信息：",
    formatBulletList(bundle.chapter.newInfo),
    "本章新埋伏笔：",
    formatBulletList(bundle.chapter.foreshadowSeeds),
    `结尾钩子：${bundle.chapter.endingHook}`,
    "相关世界规则：",
    formatWorldRules(bundle.worldRules),
    "相关角色状态：",
    formatCharacterStates(bundle.characterStates),
    "相关伏笔：",
    formatForeshadows(bundle.foreshadows),
    "最近章节摘要：",
    formatBulletList(bundle.recentChapterSummaries),
    "输出要求：直接输出章节正文，不要额外解释。",
  ].join("\n\n");
}

/**
 * 连续性审校的系统提示词。
 * 强调的是找问题和举证，不是重写正文。
 */
export function buildContinuityCheckSystemPrompt(): string {
  return [
    "你是长篇网文的一致性审校助手。",
    "你的职责是找出正文与既有设定、角色状态、时间线、伏笔计划之间的冲突。",
    "请优先指出高风险问题，例如：",
    "1. 角色突然知道自己不该知道的信息。",
    "2. 世界规则被违反。",
    "3. 时间线前后矛盾。",
    "4. 章节目标没有完成，或章节结束状态与章卡不符。",
    "5. 伏笔被错误回收或被无意放弃。",
    "输出时请按结构化报告思路组织内容，先给总体结论，再列出问题、证据和建议。",
  ].join("\n");
}

/**
 * 连续性审校的用户提示词。
 * 这里既喂设定，也喂当前草稿，便于模型对照检查。
 */
export function buildContinuityCheckUserPrompt(bundle: ChapterMemoryBundle, draftContent: string): string {
  return [
    `检查对象：第 ${bundle.chapter.order} 章《${bundle.chapter.title}》`,
    `章节目标：${bundle.chapter.chapterGoal}`,
    `章节冲突：${bundle.chapter.conflict}`,
    `结尾钩子：${bundle.chapter.endingHook}`,
    "相关规则：",
    formatWorldRules(bundle.worldRules),
    "相关角色状态：",
    formatCharacterStates(bundle.characterStates),
    "相关伏笔：",
    formatForeshadows(bundle.foreshadows),
    "当前草稿正文：",
    draftContent,
  ].join("\n\n");
}

/**
 * 把连续性报告整理成更适合前端展示的文本。
 * 首版先返回纯文本，后面可以再换成更细的 UI 卡片。
 */
export function renderContinuityReport(report: ContinuityReport): string {
  const issueLines = report.issues.map((issue, index) => {
    return [
      `${index + 1}. [${issue.severity}] ${issue.category}`,
      `问题：${issue.description}`,
      `证据：${issue.evidence.join("；")}`,
      `建议：${issue.suggestion}`,
    ].join("\n");
  });

  return [
    `章节 ID：${report.chapterId}`,
    `总体结论：${report.summary}`,
    "问题列表：",
    issueLines.join("\n\n") || "- 无",
    "必须修复：",
    formatBulletList(report.mustFix),
    "可延后处理：",
    formatBulletList(report.canDefer),
  ].join("\n\n");
}