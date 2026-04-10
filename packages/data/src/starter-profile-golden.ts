import type { StarterProfileKey } from "./starter-profile-fixtures";

export interface StarterProfileGoldenSnapshot {
  workspace: {
    defaultStarterProfile: string;
    bundles: string[];
    bookCount: number;
  };
  book: {
    starterProfileKey: string;
    targetPlatform: string;
    totalTargetWordCount: number;
    stopLossWordCount: number;
    chapterTargetWordCount: {
      min: number;
      max: number;
    };
    requireFullVolumePlanBeforeDrafting: boolean;
    chapterFunctionMix: Record<string, string>;
    enabledRuleSets: string[];
    allowedRewriteTriggers: string[];
    requiredPrewriteSequence?: string[];
    volumeTarget?: {
      chaptersMin: number;
      chaptersMax: number;
    };
    hardRuleCount: number;
    sourceDocumentCount: number;
    sourceDocumentPaths: string[];
  };
}

export const starterProfileGoldenSnapshots: Record<StarterProfileKey, StarterProfileGoldenSnapshot> = {
  "qidian-male-longform": {
    workspace: {
      defaultStarterProfile: "qidian-male-longform",
      bundles: ["core-default", "topic-qidian-male-longform"],
      bookCount: 1,
    },
    book: {
      starterProfileKey: "qidian-male-longform",
      targetPlatform: "起点中文网（男频）",
      totalTargetWordCount: 1000000,
      stopLossWordCount: 250000,
      chapterTargetWordCount: {
        min: 2000,
        max: 2500,
      },
      requireFullVolumePlanBeforeDrafting: true,
      chapterFunctionMix: {
        main_push: "45-55%",
        transition: "10-20%",
        relationship: "5-10%",
        daily_life: "5-10%",
        information: "10-15%",
        payoff: "10-15%",
      },
      enabledRuleSets: [
        "anchoring",
        "continuity",
        "exposition",
        "hook-strength",
        "opening-arc",
        "pacing",
      ],
      allowedRewriteTriggers: [
        "anchor-gap",
        "continuity-gap",
        "execution-bug",
        "exposition-gap",
        "hook-weakness",
        "knowledge-layer-gap",
        "pacing-gap",
        "planning-gap",
        "volume-budget-gap",
      ],
      requiredPrewriteSequence: [
        "platform-lock",
        "stop-loss-lock",
        "total-word-target-lock",
        "chapter-word-target-lock",
        "volume-budget-content-first",
        "full-volume-plan",
        "stage-map",
        "chapter-function-mix",
        "transition-and-daily-slots",
        "full-volume-chapter-positioning",
        "current-batch-outline",
      ],
      volumeTarget: {
        chaptersMin: 0,
        chaptersMax: 0,
      },
      hardRuleCount: 3,
      sourceDocumentCount: 6,
      sourceDocumentPaths: [
        "00-设定/角色设定.md",
        "00-设定/世界设定.md",
        "00-设定/组织生态设定.md",
        "00-设定/作品定位.md",
        "01-大纲/卷一大纲.md",
        "01-大纲/全书大纲.md",
      ],
    },
  },
  "qidian-female-longform": {
    workspace: {
      defaultStarterProfile: "qidian-female-longform",
      bundles: ["core-default", "topic-qidian-female-longform"],
      bookCount: 1,
    },
    book: {
      starterProfileKey: "qidian-female-longform",
      targetPlatform: "起点中文网（女频）",
      totalTargetWordCount: 800000,
      stopLossWordCount: 200000,
      chapterTargetWordCount: {
        min: 2000,
        max: 2500,
      },
      requireFullVolumePlanBeforeDrafting: true,
      chapterFunctionMix: {
        main_push: "25-35%",
        transition: "10-20%",
        relationship: "25-35%",
        daily_life: "10-20%",
        information: "10-15%",
        payoff: "10-15%",
      },
      enabledRuleSets: [
        "anchoring",
        "continuity",
        "exposition",
        "opening-arc",
        "pacing",
        "relationship-line",
      ],
      allowedRewriteTriggers: [
        "anchor-gap",
        "continuity-gap",
        "execution-bug",
        "exposition-gap",
        "knowledge-layer-gap",
        "pacing-gap",
        "planning-gap",
        "relationship-drift",
        "volume-budget-gap",
      ],
      requiredPrewriteSequence: [
        "platform-lock",
        "stop-loss-lock",
        "total-word-target-lock",
        "chapter-word-target-lock",
        "volume-budget-content-first",
        "full-volume-plan",
        "stage-map",
        "chapter-function-mix",
        "transition-and-daily-slots",
        "full-volume-chapter-positioning",
        "current-batch-outline",
      ],
      volumeTarget: {
        chaptersMin: 0,
        chaptersMax: 0,
      },
      hardRuleCount: 3,
      sourceDocumentCount: 6,
      sourceDocumentPaths: [
        "00-设定/角色设定.md",
        "00-设定/世界设定.md",
        "00-设定/组织生态设定.md",
        "00-设定/作品定位.md",
        "01-大纲/卷一大纲.md",
        "01-大纲/全书大纲.md",
      ],
    },
  },
  "serial-experimental": {
    workspace: {
      defaultStarterProfile: "serial-experimental",
      bundles: ["core-default", "topic-serial-experimental"],
      bookCount: 1,
    },
    book: {
      starterProfileKey: "serial-experimental",
      targetPlatform: "待定",
      totalTargetWordCount: 300000,
      stopLossWordCount: 80000,
      chapterTargetWordCount: {
        min: 1800,
        max: 2200,
      },
      requireFullVolumePlanBeforeDrafting: false,
      chapterFunctionMix: {
        main_push: "35-45%",
        transition: "10-15%",
        relationship: "10-15%",
        daily_life: "5-10%",
        information: "15-20%",
        payoff: "10-15%",
      },
      enabledRuleSets: [
        "anchoring",
        "continuity",
        "exposition",
        "hook-strength",
        "opening-arc",
        "pacing",
      ],
      allowedRewriteTriggers: [
        "anchor-gap",
        "concept-validation-failure",
        "continuity-gap",
        "execution-bug",
        "exposition-gap",
        "hook-weakness",
        "knowledge-layer-gap",
        "pacing-gap",
        "planning-gap",
        "volume-budget-gap",
      ],
      requiredPrewriteSequence: [
        "platform-lock",
        "stop-loss-lock",
        "total-word-target-lock",
        "chapter-word-target-lock",
        "current-batch-outline",
      ],
      volumeTarget: {
        chaptersMin: 8,
        chaptersMax: 15,
      },
      hardRuleCount: 3,
      sourceDocumentCount: 6,
      sourceDocumentPaths: [
        "00-设定/角色设定.md",
        "00-设定/世界设定.md",
        "00-设定/组织生态设定.md",
        "00-设定/作品定位.md",
        "01-大纲/卷一大纲.md",
        "01-大纲/全书大纲.md",
      ],
    },
  },
};
