import { z } from "zod";

/**
 * 流水线阶段枚举。
 * 后续如果拆成更多阶段，可以直接在这里扩展。
 */
export const novelStageSchema = z.enum([
  "concept",
  "bible",
  "outline",
  "volume_outline",
  "chapter_card",
  "draft",
  "continuity_check",
  "polish",
  "approved",
]);

export type NovelStage = z.infer<typeof novelStageSchema>;

/**
 * 作品当前状态。
 * 用于区分一本书还在规划、连载中、已完结还是已归档。
 */
export const workStatusSchema = z.enum(["planning", "serializing", "completed", "archived"]);
export type WorkStatus = z.infer<typeof workStatusSchema>;

/**
 * 叙事视角。
 * 建议单书保持稳定，避免来回切换带来的风格漂移。
 */
export const narrativePerspectiveSchema = z.enum([
  "first_person",
  "third_person_limited",
  "third_person_omniscient",
]);
export type NarrativePerspective = z.infer<typeof narrativePerspectiveSchema>;

/**
 * 语言密度。
 * 简洁、均衡、浓烈分别对应不同类型的网文阅读节奏。
 */
export const languageDensitySchema = z.enum(["lean", "balanced", "lush"]);
export type LanguageDensity = z.infer<typeof languageDensitySchema>;

/**
 * 节奏强度。
 * 对长篇网文来说，这个字段会直接影响章节推进速度。
 */
export const pacingLevelSchema = z.enum(["slow", "balanced", "fast"]);
export type PacingLevel = z.infer<typeof pacingLevelSchema>;

/**
 * 情绪浓度。
 * 用于控制文风是克制、均衡还是强烈外放。
 */
export const emotionLevelSchema = z.enum(["restrained", "balanced", "intense"]);
export type EmotionLevel = z.infer<typeof emotionLevelSchema>;

/**
 * 伏笔状态。
 * 方便后续做伏笔回收率、遗失率等统计。
 */
export const foreshadowStatusSchema = z.enum(["seeded", "reinforced", "paid_off", "abandoned"]);
export type ForeshadowStatus = z.infer<typeof foreshadowStatusSchema>;

/**
 * 一部作品的顶层定位。
 * 这是整本书的“产品说明书”，后续所有环节都应该受它约束。
 */
export const workProfileSchema = z.object({
  id: z.string().min(1).describe("作品唯一 ID"),
  slug: z.string().min(1).describe("作品路由别名或短标识"),
  title: z.string().min(1).describe("作品标题"),
  tagline: z.string().min(1).describe("一句话卖点"),
  genre: z.string().min(1).describe("主类型，例如玄幻、都市、仙侠"),
  subgenre: z.string().min(1).optional().describe("副类型，例如系统流、种田流"),
  targetPlatform: z.string().min(1).describe("目标发布平台"),
  targetAudience: z.array(z.string()).describe("目标读者标签列表"),
  targetWordCount: z.number().int().positive().describe("全书目标字数"),
  dailyWordTarget: z.number().int().nonnegative().describe("日更目标字数"),
  updateCadence: z.string().min(1).describe("更新节奏，例如日更、双更、周更"),
  commercialHooks: z.array(z.string()).describe("商业卖点列表"),
  hardConstraints: z.array(z.string()).describe("绝对不能偏离的硬约束"),
  contentWarnings: z.array(z.string()).describe("题材边界或风险提示"),
  status: workStatusSchema.describe("作品当前状态"),
});
export type WorkProfile = z.infer<typeof workProfileSchema>;

/**
 * 单本书的风格卡。
 * 这层不负责内容设定，而是负责语言、节奏和情绪调性。
 */
export const styleProfileSchema = z.object({
  id: z.string().min(1).describe("风格卡 ID"),
  workId: z.string().min(1).describe("所属作品 ID"),
  perspective: narrativePerspectiveSchema.describe("叙事视角"),
  languageDensity: languageDensitySchema.describe("语言密度"),
  pacing: pacingLevelSchema.describe("整体节奏偏好"),
  emotionLevel: emotionLevelSchema.describe("情绪表达强度"),
  dialogueRatio: z.number().min(0).max(1).describe("对话占比，0 到 1 之间"),
  sensoryDetailLevel: z.number().min(0).max(1).describe("感官描写强度，0 到 1 之间"),
  humorRatio: z.number().min(0).max(1).describe("幽默表达占比，0 到 1 之间"),
  bannedPatterns: z.array(z.string()).describe("禁止出现的表达习惯或腔调"),
  styleAnchors: z.array(z.string()).describe("本书要刻意强化的风格锚点"),
  notes: z.array(z.string()).describe("补充说明，例如适合什么场景加重描写"),
});
export type StyleProfile = z.infer<typeof styleProfileSchema>;

/**
 * 世界规则。
 * 硬规则建议用 hardConstraint = true 标出，后续一致性检查更容易发现问题。
 */
export const worldRuleSchema = z.object({
  id: z.string().min(1).describe("规则 ID"),
  workId: z.string().min(1).describe("所属作品 ID"),
  category: z.string().min(1).describe("规则分类，例如力量体系、地理、社会秩序"),
  title: z.string().min(1).describe("规则标题"),
  description: z.string().min(1).describe("规则详细描述"),
  hardConstraint: z.boolean().describe("是否为绝对不能违反的硬规则"),
  examples: z.array(z.string()).describe("规则示例或边界样例"),
});
export type WorldRule = z.infer<typeof worldRuleSchema>;

/**
 * 角色关系边。
 * 建议同时区分公开关系和隐藏关系，便于后续反转设计。
 */
export const characterRelationSchema = z.object({
  targetCharacterId: z.string().min(1).describe("关系目标角色 ID"),
  publicLabel: z.string().min(1).describe("表面关系，例如师徒、同学、盟友"),
  privateLabel: z.string().min(1).optional().describe("隐藏关系，例如宿敌、血亲、卧底"),
  trustLevel: z.number().int().min(-100).max(100).describe("信任度，负数表示敌意"),
  tensionLevel: z.number().int().min(0).max(100).describe("紧张度，用于衡量关系冲突强度"),
  notes: z.array(z.string()).describe("这段关系的关键备注"),
});
export type CharacterRelation = z.infer<typeof characterRelationSchema>;

/**
 * 角色静态卡。
 * 用于保存角色不应轻易变化的底层信息。
 */
export const characterCardSchema = z.object({
  id: z.string().min(1).describe("角色唯一 ID"),
  workId: z.string().min(1).describe("所属作品 ID"),
  name: z.string().min(1).describe("角色姓名"),
  role: z.string().min(1).describe("角色定位，例如主角、反派、女主、导师"),
  archetype: z.string().min(1).describe("角色原型或人物类型"),
  publicIdentity: z.string().min(1).describe("角色公开身份"),
  hiddenIdentity: z.string().min(1).optional().describe("角色隐藏身份"),
  coreDesire: z.string().min(1).describe("角色最核心的欲望"),
  coreFear: z.string().min(1).describe("角色最核心的恐惧"),
  strengths: z.array(z.string()).describe("角色优势"),
  flaws: z.array(z.string()).describe("角色缺点"),
  secrets: z.array(z.string()).describe("角色秘密"),
  speechStyle: z.array(z.string()).describe("角色说话习惯，用于对话风格稳定"),
  growthArc: z.string().min(1).describe("角色成长弧"),
  relationships: z.array(characterRelationSchema).describe("角色关系网络"),
});
export type CharacterCard = z.infer<typeof characterCardSchema>;

/**
 * 角色关系变化。
 * 每写完一章后，可以把变化量单独记下来，后续方便回放和统计。
 */
export const relationshipDeltaSchema = z.object({
  targetCharacterId: z.string().min(1).describe("关系变化指向的角色 ID"),
  changeSummary: z.string().min(1).describe("关系变化摘要"),
  trustDelta: z.number().int().min(-100).max(100).describe("信任变化值"),
  tensionDelta: z.number().int().min(-100).max(100).describe("紧张变化值"),
});
export type RelationshipDelta = z.infer<typeof relationshipDeltaSchema>;

/**
 * 角色动态状态快照。
 * 这是长篇小说可控记忆的关键，不建议只从正文里临时检索。
 */
export const characterStateSnapshotSchema = z.object({
  snapshotId: z.string().min(1).describe("状态快照 ID"),
  workId: z.string().min(1).describe("所属作品 ID"),
  chapterId: z.string().min(1).describe("关联章节 ID"),
  characterId: z.string().min(1).describe("角色 ID"),
  knows: z.array(z.string()).describe("当前角色已经知道的事实"),
  resources: z.array(z.string()).describe("当前角色持有的资源、道具、人脉或能力"),
  wounds: z.array(z.string()).describe("当前角色的伤势、限制或隐患"),
  emotionalState: z.string().min(1).describe("当前主导情绪"),
  stanceSummary: z.string().min(1).describe("当前立场摘要"),
  relationshipDeltas: z.array(relationshipDeltaSchema).describe("相较上一个章节的关系变化"),
  unresolvedThreads: z.array(z.string()).describe("当前角色视角下尚未解决的问题"),
});
export type CharacterStateSnapshot = z.infer<typeof characterStateSnapshotSchema>;

/**
 * 分卷大纲。
 * 用于控制中期推进，防止整本书只有章纲没有阶段性目标。
 */
export const volumeOutlineSchema = z.object({
  id: z.string().min(1).describe("卷 ID"),
  workId: z.string().min(1).describe("所属作品 ID"),
  order: z.number().int().positive().describe("卷序号"),
  title: z.string().min(1).describe("卷标题"),
  goal: z.string().min(1).describe("本卷阶段目标"),
  mainConflict: z.string().min(1).describe("本卷核心冲突"),
  entryHook: z.string().min(1).describe("卷开局钩子"),
  climax: z.string().min(1).describe("卷高潮或最大爆点"),
  payoff: z.string().min(1).describe("本卷需要兑现的承诺"),
  mustDeliverInfo: z.array(z.string()).describe("本卷必须交代的关键信息"),
  keyCharacters: z.array(z.string()).describe("本卷重点角色 ID 列表"),
  plannedChapterCount: z.number().int().positive().describe("预计章节数"),
});
export type VolumeOutline = z.infer<typeof volumeOutlineSchema>;

/**
 * 场景卡。
 * 这是章节内的最小控制单元，首版可以先只做章节级，后续再细化。
 */
export const sceneCardSchema = z.object({
  id: z.string().min(1).describe("场景 ID"),
  title: z.string().min(1).describe("场景标题"),
  purpose: z.string().min(1).describe("该场景承担的功能，例如推进剧情、揭露信息"),
  conflict: z.string().min(1).describe("场景内部冲突"),
  emotionalShift: z.string().min(1).describe("场景完成后的情绪变化"),
});
export type SceneCard = z.infer<typeof sceneCardSchema>;

/**
 * 章节卡。
 * 章节卡是正文生成的直接输入，建议始终在生成正文前先完成这一层。
 */
export const chapterCardSchema = z.object({
  id: z.string().min(1).describe("章节 ID"),
  workId: z.string().min(1).describe("所属作品 ID"),
  volumeId: z.string().min(1).describe("所属卷 ID"),
  order: z.number().int().positive().describe("章节序号"),
  title: z.string().min(1).describe("章节标题"),
  summary: z.string().min(1).describe("本章摘要"),
  chapterGoal: z.string().min(1).describe("本章必须完成的主要目标"),
  conflict: z.string().min(1).describe("本章核心冲突"),
  entryState: z.string().min(1).describe("本章开始前的局面"),
  exitState: z.string().min(1).describe("本章结束后的局面"),
  newInfo: z.array(z.string()).describe("本章引入的新信息"),
  foreshadowSeeds: z.array(z.string()).describe("本章新埋下的伏笔"),
  requiredCallbacks: z.array(z.string()).describe("本章必须回应的旧线索"),
  endingHook: z.string().min(1).describe("本章结尾钩子"),
  keyCharacters: z.array(z.string()).describe("本章重点角色 ID 列表"),
  sceneCards: z.array(sceneCardSchema).describe("本章场景卡列表"),
});
export type ChapterCard = z.infer<typeof chapterCardSchema>;

/**
 * 伏笔账本项。
 * 伏笔一旦结构化，就可以做“未回收伏笔”提醒，不再完全靠人工记忆。
 */
export const foreshadowLedgerItemSchema = z.object({
  id: z.string().min(1).describe("伏笔 ID"),
  workId: z.string().min(1).describe("所属作品 ID"),
  seedChapterId: z.string().min(1).describe("埋点章节 ID"),
  description: z.string().min(1).describe("伏笔内容描述"),
  narrativePurpose: z.string().min(1).describe("伏笔存在的叙事目的"),
  expectedPayoffVolumeId: z.string().min(1).optional().describe("预期回收卷 ID"),
  expectedPayoffChapterId: z.string().min(1).optional().describe("预期回收章节 ID"),
  actualPayoffChapterId: z.string().min(1).optional().describe("实际回收章节 ID"),
  status: foreshadowStatusSchema.describe("伏笔当前状态"),
});
export type ForeshadowLedgerItem = z.infer<typeof foreshadowLedgerItemSchema>;

/**
 * 时间线事件。
 * 这层数据用于检查事件先后关系、角色行程是否合理。
 */
export const timelineEventSchema = z.object({
  id: z.string().min(1).describe("事件 ID"),
  workId: z.string().min(1).describe("所属作品 ID"),
  inWorldDay: z.number().int().nonnegative().describe("世界内发生在第几天"),
  title: z.string().min(1).describe("事件标题"),
  description: z.string().min(1).describe("事件描述"),
  relatedChapterId: z.string().min(1).describe("关联章节 ID"),
  involvedCharacterIds: z.array(z.string()).describe("涉及角色 ID 列表"),
  consequences: z.array(z.string()).describe("事件造成的后续影响"),
});
export type TimelineEvent = z.infer<typeof timelineEventSchema>;

/**
 * 草稿产物。
 * 每次生成正文、改写稿或精修稿，都建议生成一个独立版本对象。
 */
export const draftArtifactSchema = z.object({
  id: z.string().min(1).describe("草稿产物 ID"),
  workId: z.string().min(1).describe("所属作品 ID"),
  chapterId: z.string().min(1).describe("所属章节 ID"),
  stage: novelStageSchema.describe("产物所属阶段"),
  version: z.number().int().positive().describe("版本号，从 1 开始"),
  content: z.string().min(1).describe("正文或报告主体内容"),
  summary: z.string().min(1).describe("该版本的摘要"),
  promptVersion: z.string().min(1).describe("对应的 prompt 版本号"),
  model: z.string().min(1).describe("生成该版本所使用的模型"),
  createdAt: z.string().min(1).describe("生成时间，建议使用 ISO 字符串"),
});
export type DraftArtifact = z.infer<typeof draftArtifactSchema>;

/**
 * 连续性问题项。
 * 用于表达设定冲突、人物行为不一致、时间线错位等问题。
 */
export const continuityIssueSchema = z.object({
  severity: z.enum(["low", "medium", "high"]).describe("问题严重程度"),
  category: z.string().min(1).describe("问题分类"),
  description: z.string().min(1).describe("问题描述"),
  evidence: z.array(z.string()).describe("支撑该判断的证据"),
  suggestion: z.string().min(1).describe("建议修复方式"),
});
export type ContinuityIssue = z.infer<typeof continuityIssueSchema>;

/**
 * 连续性审校报告。
 * 这层结果很适合走结构化输出，再配合人工审核决定是否打回。
 */
export const continuityReportSchema = z.object({
  chapterId: z.string().min(1).describe("被检查的章节 ID"),
  summary: z.string().min(1).describe("总体审校结论摘要"),
  issues: z.array(continuityIssueSchema).describe("发现的问题列表"),
  mustFix: z.array(z.string()).describe("必须先修复的点"),
  canDefer: z.array(z.string()).describe("可以延后处理的点"),
});
export type ContinuityReport = z.infer<typeof continuityReportSchema>;

/**
 * 一次流水线运行记录。
 * 用于统计成本、失败率、返工率，也是后面做可视化的基础。
 */
export const pipelineRunSchema = z.object({
  id: z.string().min(1).describe("运行记录 ID"),
  workId: z.string().min(1).describe("所属作品 ID"),
  chapterId: z.string().min(1).optional().describe("关联章节 ID"),
  stage: novelStageSchema.describe("运行阶段"),
  promptVersion: z.string().min(1).describe("本次运行使用的 prompt 版本"),
  model: z.string().min(1).describe("本次运行使用的模型"),
  success: z.boolean().describe("本次运行是否成功"),
  inputSummary: z.string().min(1).describe("输入摘要"),
  outputSummary: z.string().min(1).describe("输出摘要"),
  estimatedTokenCost: z.number().nonnegative().describe("估算 token 成本"),
  startedAt: z.string().min(1).describe("开始时间"),
  finishedAt: z.string().min(1).optional().describe("结束时间"),
  errorMessage: z.string().optional().describe("失败时的错误信息"),
});
export type PipelineRun = z.infer<typeof pipelineRunSchema>;

/**
 * 章节生成时的记忆包。
 * 这里只放当前任务真正需要的上下文，避免把整本书全文塞进模型。
 */
export const chapterMemoryBundleSchema = z.object({
  work: workProfileSchema.describe("作品定位卡"),
  style: styleProfileSchema.describe("风格卡"),
  volume: volumeOutlineSchema.describe("当前卷大纲"),
  chapter: chapterCardSchema.describe("当前章节卡"),
  worldRules: z.array(worldRuleSchema).describe("与当前章节相关的规则"),
  characters: z.array(characterCardSchema).describe("与当前章节相关的角色卡"),
  characterStates: z.array(characterStateSnapshotSchema).describe("与当前章节相关的角色状态"),
  foreshadows: z.array(foreshadowLedgerItemSchema).describe("与当前章节相关的伏笔"),
  timelineEvents: z.array(timelineEventSchema).describe("近期或相关时间线事件"),
  recentChapterSummaries: z.array(z.string()).describe("最近几章摘要"),
});
export type ChapterMemoryBundle = z.infer<typeof chapterMemoryBundleSchema>;