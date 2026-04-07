import {
  createContinuityCheckPromptBundle,
  createDraftPromptBundle,
  defaultPipelineStages,
  type PromptBundle,
} from "@aifiction/core";
import type { ChapterMemoryBundle } from "@aifiction/schemas";

export interface ChapterPipelineJob extends ChapterMemoryBundle {}

export class NovelPipelineRunner {
  listStages() {
    return defaultPipelineStages;
  }

  prepareDraft(job: ChapterPipelineJob): PromptBundle {
    return createDraftPromptBundle(job);
  }

  prepareContinuityCheck(job: ChapterPipelineJob, draftContent: string): PromptBundle {
    return createContinuityCheckPromptBundle(job, draftContent);
  }
}

export function createDemoChapterJob(): ChapterPipelineJob {
  return {
    work: {
      id: "work_demo",
      slug: "demo-work",
      title: "示例作品",
      tagline: "用于本地验证写作流水线与 prompt 组装逻辑的最小样例。",
      genre: "示例题材",
      subgenre: "示例子类型",
      targetPlatform: "未指定平台",
      targetAudience: ["示例读者"],
      targetWordCount: 100000,
      dailyWordTarget: 2000,
      updateCadence: "日更",
      commercialHooks: ["成长", "悬念"],
      hardConstraints: ["示例规则一", "示例规则二"],
      contentWarnings: [],
      status: "planning",
    },
    style: {
      id: "style_demo",
      workId: "work_demo",
      perspective: "third_person_limited",
      languageDensity: "balanced",
      pacing: "balanced",
      emotionLevel: "balanced",
      dialogueRatio: 0.4,
      sensoryDetailLevel: 0.5,
      humorRatio: 0.1,
      bannedPatterns: ["空洞解释", "无来源设定堆叠"],
      styleAnchors: ["叙事清楚", "信息有序释放"],
      notes: ["这个对象只是开发期最小样例，不绑定任何真实作品。"],
    },
    volume: {
      id: "volume_demo_1",
      workId: "work_demo",
      order: 1,
      title: "第一卷",
      goal: "验证卷级上下文能够正确进入 prompt。",
      mainConflict: "示例冲突",
      entryHook: "示例开篇钩子",
      climax: "示例高潮",
      payoff: "示例兑现",
      mustDeliverInfo: ["示例世界规则"],
      keyCharacters: ["char_demo_lead"],
      plannedChapterCount: 12,
    },
    chapter: {
      id: "chapter_demo_1",
      workId: "work_demo",
      volumeId: "volume_demo_1",
      order: 1,
      title: "第一章",
      summary: "示例章节摘要。",
      chapterGoal: "验证章节卡和场景卡能进入 prompt。",
      conflict: "示例冲突",
      entryState: "开场状态",
      exitState: "章末状态",
      newInfo: ["示例新信息"],
      foreshadowSeeds: ["示例伏笔"],
      requiredCallbacks: ["示例回收项"],
      endingHook: "示例章末钩子",
      keyCharacters: ["char_demo_lead"],
      sceneCards: [
        {
          id: "scene_demo_1",
          title: "开场场景",
          purpose: "建立基础锚点",
          conflict: "示例场景冲突",
          emotionalShift: "从平静转向紧张",
        },
      ],
    },
    worldRules: [
      {
        id: "rule_demo_1",
        workId: "work_demo",
        category: "示例规则",
        title: "示例规则",
        description: "用于本地验证的示例规则。",
        hardConstraint: true,
        examples: ["示例一", "示例二"],
      },
    ],
    characters: [
      {
        id: "char_demo_lead",
        workId: "work_demo",
        name: "示例主角",
        role: "主角",
        archetype: "示例原型",
        publicIdentity: "示例公开身份",
        hiddenIdentity: "示例隐藏身份",
        coreDesire: "示例核心欲望",
        coreFear: "示例核心恐惧",
        strengths: ["执行力"],
        flaws: ["经验不足"],
        secrets: ["有一段未公开经历"],
        speechStyle: ["短句"],
        growthArc: "从被动转为主动。",
        relationships: [],
      },
    ],
    characterStates: [
      {
        snapshotId: "snapshot_demo_1",
        workId: "work_demo",
        chapterId: "chapter_demo_0",
        characterId: "char_demo_lead",
        knows: ["示例已知信息"],
        resources: ["示例资源"],
        wounds: [],
        emotionalState: "警觉",
        stanceSummary: "先观察，再行动。",
        relationshipDeltas: [],
        unresolvedThreads: ["示例未解问题"],
      },
    ],
    foreshadows: [
      {
        id: "foreshadow_demo_1",
        workId: "work_demo",
        seedChapterId: "chapter_demo_1",
        description: "示例伏笔。",
        narrativePurpose: "验证伏笔信息进入上下文。",
        expectedPayoffVolumeId: "volume_demo_1",
        expectedPayoffChapterId: "chapter_demo_6",
        actualPayoffChapterId: undefined,
        status: "seeded",
      },
    ],
    timelineEvents: [
      {
        id: "event_demo_1",
        workId: "work_demo",
        inWorldDay: 0,
        title: "示例事件",
        description: "用于验证时间线事件进入上下文。",
        relatedChapterId: "chapter_demo_1",
        involvedCharacterIds: ["char_demo_lead"],
        consequences: ["示例后果"],
      },
    ],
    recentChapterSummaries: ["示例最近章节摘要。"],
  };
}
