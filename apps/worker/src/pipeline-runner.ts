import {
  createContinuityCheckPromptBundle,
  createDraftPromptBundle,
  defaultPipelineStages,
  type PromptBundle,
} from "@aifiction/core";
import type { ChapterMemoryBundle } from "@aifiction/schemas";

/**
 * 章节级流水线任务。
 * 首版先聚焦“一个章节如何被安全地产出”，后面再扩展到整卷调度。
 */
export interface ChapterPipelineJob extends ChapterMemoryBundle {}

/**
 * 流水线执行器。
 * 当前版本先负责准备 prompt 和阶段上下文，后续再接 Redis 队列、数据库和 OpenAI 调用。
 */
export class NovelPipelineRunner {
  /**
   * 返回当前支持的阶段列表。
   * Web 端可以直接复用这里的结果显示阶段进度。
   */
  listStages() {
    return defaultPipelineStages;
  }

  /**
   * 为章节初稿阶段准备 prompt 包。
   */
  prepareDraft(job: ChapterPipelineJob): PromptBundle {
    return createDraftPromptBundle(job);
  }

  /**
   * 为连续性审校阶段准备 prompt 包。
   */
  prepareContinuityCheck(job: ChapterPipelineJob, draftContent: string): PromptBundle {
    return createContinuityCheckPromptBundle(job, draftContent);
  }
}

/**
 * Demo 数据。
 * 这部分方便你本地先跑通“上下文组装 -> prompt 生成”的链路。
 */
export function createDemoChapterJob(): ChapterPipelineJob {
  return {
    work: {
      id: "work_the_last_station",
      slug: "the-last-station",
      title: "末站执灯人",
      tagline: "一个被逐出主城的底层修补工，在废墟铁道里点亮失落文明的最后一盏灯。",
      genre: "科幻冒险",
      subgenre: "废土成长",
      targetPlatform: "起点中文网",
      targetAudience: ["男频", "成长流", "世界观推进爱好者"],
      targetWordCount: 1800000,
      dailyWordTarget: 4000,
      updateCadence: "日更",
      commercialHooks: ["文明遗迹", "阶层跃迁", "装备升级"],
      hardConstraints: ["遗迹灯塔只能由执灯人系谱触发", "主角不能一夜之间掌握完整古文明知识"],
      contentWarnings: ["废土暴力", "资源压迫"],
      status: "planning",
    },
    style: {
      id: "style_the_last_station",
      workId: "work_the_last_station",
      perspective: "third_person_limited",
      languageDensity: "balanced",
      pacing: "fast",
      emotionLevel: "balanced",
      dialogueRatio: 0.42,
      sensoryDetailLevel: 0.58,
      humorRatio: 0.12,
      bannedPatterns: ["滥用网络段子", "现代口水化吐槽", "无依据的设定说明书式独白"],
      styleAnchors: ["工业废土质感", "动作与信息同步推进", "紧张中保留人味"],
      notes: ["开篇阶段优先拉强冲突与悬念", "重要世界规则要借剧情带出"],
    },
    volume: {
      id: "volume_1",
      workId: "work_the_last_station",
      order: 1,
      title: "锈轨下的火种",
      goal: "让主角拿到第一份能改变阶层的遗迹线索，并被卷入主城势力注意。",
      mainConflict: "主角既要活下去，又不能暴露自己与古文明灯塔的特殊联系。",
      entryHook: "废弃支线铁路上出现一列不该存在的无灯列车。",
      climax: "主角在黑雨夜点亮地下站台的残灯，引来三方势力围剿。",
      payoff: "兑现主角身世与遗迹能力的第一层承诺。",
      mustDeliverInfo: ["主城与下层站区的阶层差距", "执灯人系谱的传闻"],
      keyCharacters: ["char_lin_ye", "char_qiao_ning"],
      plannedChapterCount: 60,
    },
    chapter: {
      id: "chapter_1",
      workId: "work_the_last_station",
      volumeId: "volume_1",
      order: 1,
      title: "没有车灯的列车",
      summary: "林野在锈轨巡修时发现一列没有任何编号的列车，从而被迫做出违背站区规定的选择。",
      chapterGoal: "完成世界观第一层展示，并让主角与神秘列车建立联系。",
      conflict: "主角想保命避祸，但眼前的列车可能是改变命运的唯一机会。",
      entryState: "林野仍是下层站区最底层的巡修工，负债且被站务处盯上。",
      exitState: "林野决定追查这列车的来历，并因此被人记住。",
      newInfo: ["黑雨夜会干扰主城监测", "无灯列车会自动避开普通巡查点"],
      foreshadowSeeds: ["列车车门内侧的古旧灯纹", "林野被列车短暂识别"],
      requiredCallbacks: ["主角负债压力", "站区晚上封轨的铁律"],
      endingHook: "车门在无人触碰的情况下向林野打开了一道缝。",
      keyCharacters: ["char_lin_ye", "char_qiao_ning"],
      sceneCards: [
        {
          id: "scene_1",
          title: "黑雨巡轨",
          purpose: "交代底层生存环境与主角身份",
          conflict: "主角必须冒险巡修才能换到药费",
          emotionalShift: "从麻木转向警觉",
        },
        {
          id: "scene_2",
          title: "无灯列车入轨",
          purpose: "引入核心悬念",
          conflict: "主角是否上报异常目标",
          emotionalShift: "从警觉转向被迫抉择",
        },
      ],
    },
    worldRules: [
      {
        id: "rule_lamp_bloodline",
        workId: "work_the_last_station",
        category: "遗迹规则",
        title: "灯塔识别规则",
        description: "古文明灯塔类设备只会对执灯人系谱产生响应。",
        hardConstraint: true,
        examples: ["普通人能看见灯塔，但不能启动", "伪造系谱凭证无法骗过灯塔核心"],
      },
      {
        id: "rule_black_rain",
        workId: "work_the_last_station",
        category: "环境规则",
        title: "黑雨规则",
        description: "黑雨会短暂屏蔽主城的一部分监测网络，但会让裸露金属快速腐蚀。",
        hardConstraint: true,
        examples: ["站区执法会在黑雨时减少外巡", "旧轨设备在黑雨后更容易故障"],
      },
    ],
    characters: [
      {
        id: "char_lin_ye",
        workId: "work_the_last_station",
        name: "林野",
        role: "主角",
        archetype: "底层修补工成长型主角",
        publicIdentity: "下层站区巡修工",
        hiddenIdentity: "执灯人系谱后代",
        coreDesire: "还清药债并离开下层站区",
        coreFear: "在没有价值之前就被主城秩序吞掉",
        strengths: ["临场判断强", "耐压", "熟悉老轨设备"],
        flaws: ["不轻易信人", "遇到上层权力时容易本能退缩"],
        secrets: ["母亲留下过一枚无法点亮的灯芯"],
        speechStyle: ["短句", "谨慎", "不主动暴露情绪"],
        growthArc: "从只想苟活到底层求生者，成长为敢于点灯的人。",
        relationships: [
          {
            targetCharacterId: "char_qiao_ning",
            publicLabel: "旧相识",
            privateLabel: "彼此都不完全信任的临时同盟",
            trustLevel: 20,
            tensionLevel: 55,
            notes: ["乔宁更了解主城情报", "林野知道她在隐瞒来历"],
          },
        ],
      },
      {
        id: "char_qiao_ning",
        workId: "work_the_last_station",
        name: "乔宁",
        role: "重要配角",
        archetype: "聪明危险的情报中间人",
        publicIdentity: "旧站区零件掮客",
        hiddenIdentity: "主城边缘机构的线人",
        coreDesire: "借遗迹线索翻身进入主城内部层级",
        coreFear: "被任何一方当成随时能抛弃的棋子",
        strengths: ["消息灵通", "反应快", "谈判能力强"],
        flaws: ["过于现实", "容易试探底线"],
        secrets: ["她已经看过一次无灯列车的影子"],
        speechStyle: ["话里带钩子", "善于试探", "不说满话"],
        growthArc: "从机会主义者逐渐建立真正的立场。",
        relationships: [
          {
            targetCharacterId: "char_lin_ye",
            publicLabel: "旧相识",
            privateLabel: "潜在合作对象",
            trustLevel: 25,
            tensionLevel: 50,
            notes: ["她觉得林野身上有主城买不到的价值"],
          },
        ],
      },
    ],
    characterStates: [
      {
        snapshotId: "snapshot_lin_ye_before_ch1",
        workId: "work_the_last_station",
        chapterId: "chapter_0",
        characterId: "char_lin_ye",
        knows: ["夜间封轨后通常不会有列车出现", "自己欠着药债", "乔宁最近在打听遗迹消息"],
        resources: ["旧式巡轨灯", "熟悉下层站区小路"],
        wounds: ["长期营养不良", "右手旧伤在黑雨天会发麻"],
        emotionalState: "压抑而警惕",
        stanceSummary: "优先保命，但内心并未放弃翻身可能。",
        relationshipDeltas: [],
        unresolvedThreads: ["母亲遗物灯芯的用途", "药债何时会压垮自己"],
      },
      {
        snapshotId: "snapshot_qiao_ning_before_ch1",
        workId: "work_the_last_station",
        chapterId: "chapter_0",
        characterId: "char_qiao_ning",
        knows: ["主城最近在查找一条失落支线", "林野手里可能有关键线索"],
        resources: ["黑市消息渠道", "一张伪造通行条"],
        wounds: ["背后被两股势力同时盯梢"],
        emotionalState: "冷静中带着焦躁",
        stanceSummary: "想先试探林野，再决定是否合作。",
        relationshipDeltas: [],
        unresolvedThreads: ["如何在主城势力前保住自己"],
      },
    ],
    foreshadows: [
      {
        id: "foreshadow_lamp_mark",
        workId: "work_the_last_station",
        seedChapterId: "chapter_1",
        description: "列车车门内侧的古旧灯纹",
        narrativePurpose: "提前埋下主角与执灯人系谱的联系",
        expectedPayoffVolumeId: "volume_1",
        expectedPayoffChapterId: "chapter_12",
        actualPayoffChapterId: undefined,
        status: "seeded",
      },
    ],
    timelineEvents: [
      {
        id: "event_black_rain",
        workId: "work_the_last_station",
        inWorldDay: 0,
        title: "黑雨来临",
        description: "黑雨覆盖下层站区，夜间监测出现盲区。",
        relatedChapterId: "chapter_1",
        involvedCharacterIds: ["char_lin_ye"],
        consequences: ["站区封轨更加严格", "主城巡逻密度下降"],
      },
      {
        id: "event_ghost_train_appears",
        workId: "work_the_last_station",
        inWorldDay: 0,
        title: "无灯列车入轨",
        description: "一列无编号、无车灯的列车进入废弃支线。",
        relatedChapterId: "chapter_1",
        involvedCharacterIds: ["char_lin_ye", "char_qiao_ning"],
        consequences: ["主角命运被改写", "主城与黑市势力都会被吸引"],
      },
    ],
    recentChapterSummaries: [
      "开书前状态：林野欠债、受伤、被迫接最危险的夜巡活。",
      "乔宁在旧站区放出风声，试图寻找能看懂古旧灯纹的人。",
    ],
  };
}