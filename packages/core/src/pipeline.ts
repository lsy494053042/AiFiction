import {
  type ChapterMemoryBundle,
  type CharacterCard,
  type CharacterStateSnapshot,
  type ForeshadowLedgerItem,
  type TimelineEvent,
  type WorldRule,
} from "@aifiction/schemas";
import {
  PROMPT_VERSION,
  buildContinuityCheckSystemPrompt,
  buildContinuityCheckUserPrompt,
  buildDraftSystemPrompt,
  buildDraftUserPrompt,
} from "@aifiction/prompts";

/**
 * 流水线阶段元数据。
 * 前端和 Worker 都可以复用这一层，用于展示进度或驱动队列。
 */
export const defaultPipelineStages = [
  { key: "concept", label: "作品定位", requiresHumanReview: true },
  { key: "bible", label: "设定圣经", requiresHumanReview: true },
  { key: "outline", label: "全书大纲", requiresHumanReview: true },
  { key: "volume_outline", label: "分卷大纲", requiresHumanReview: true },
  { key: "chapter_card", label: "章节卡", requiresHumanReview: false },
  { key: "draft", label: "章节初稿", requiresHumanReview: false },
  { key: "continuity_check", label: "连续性审校", requiresHumanReview: false },
  { key: "polish", label: "文风润色", requiresHumanReview: false },
  { key: "approved", label: "人工确认", requiresHumanReview: true },
] as const;

/**
 * 章节上下文筛选输入。
 * 这里会从整本书的资产中只挑当前章节真正需要的部分。
 */
export interface ChapterContextSelectionInput extends ChapterMemoryBundle {}

/**
 * 章节 prompt 包。
 * 后续接 OpenAI Responses API 时，可以直接把这里的 systemPrompt 和 userPrompt 送出去。
 */
export interface PromptBundle {
  stage: "draft" | "continuity_check";
  promptVersion: string;
  systemPrompt: string;
  userPrompt: string;
  context: ChapterMemoryBundle;
}

function filterCharactersByChapter(bundle: ChapterMemoryBundle): CharacterCard[] {
  const relevantIds = new Set(bundle.chapter.keyCharacters);
  return bundle.characters.filter((character) => relevantIds.has(character.id));
}

function filterStatesByChapter(bundle: ChapterMemoryBundle): CharacterStateSnapshot[] {
  const relevantIds = new Set(bundle.chapter.keyCharacters);
  return bundle.characterStates.filter((state) => relevantIds.has(state.characterId));
}

function filterForeshadowsByChapter(bundle: ChapterMemoryBundle): ForeshadowLedgerItem[] {
  const callbackSet = new Set(bundle.chapter.requiredCallbacks);
  return bundle.foreshadows.filter((item) => {
    return callbackSet.has(item.description) || item.seedChapterId === bundle.chapter.id;
  });
}

function filterTimelineEvents(bundle: ChapterMemoryBundle): TimelineEvent[] {
  return bundle.timelineEvents.slice(-5);
}

function filterRules(bundle: ChapterMemoryBundle): WorldRule[] {
  if (bundle.worldRules.length <= 8) {
    return bundle.worldRules;
  }

  return bundle.worldRules.filter((rule) => rule.hardConstraint).slice(0, 8);
}

/**
 * 构建当前章节的最小上下文。
 * 这一步的目标是降噪，而不是把信息尽量塞满。
 */
export function buildChapterContext(bundle: ChapterContextSelectionInput): ChapterMemoryBundle {
  return {
    ...bundle,
    characters: filterCharactersByChapter(bundle),
    characterStates: filterStatesByChapter(bundle),
    foreshadows: filterForeshadowsByChapter(bundle),
    timelineEvents: filterTimelineEvents(bundle),
    worldRules: filterRules(bundle),
    recentChapterSummaries: bundle.recentChapterSummaries.slice(-3),
  };
}

/**
 * 生成初稿阶段的 prompt 包。
 */
export function createDraftPromptBundle(bundle: ChapterContextSelectionInput): PromptBundle {
  const context = buildChapterContext(bundle);

  return {
    stage: "draft",
    promptVersion: PROMPT_VERSION,
    systemPrompt: buildDraftSystemPrompt(context),
    userPrompt: buildDraftUserPrompt(context),
    context,
  };
}

/**
 * 生成连续性审校阶段的 prompt 包。
 */
export function createContinuityCheckPromptBundle(
  bundle: ChapterContextSelectionInput,
  draftContent: string,
): PromptBundle {
  const context = buildChapterContext(bundle);

  return {
    stage: "continuity_check",
    promptVersion: PROMPT_VERSION,
    systemPrompt: buildContinuityCheckSystemPrompt(),
    userPrompt: buildContinuityCheckUserPrompt(context, draftContent),
    context,
  };
}