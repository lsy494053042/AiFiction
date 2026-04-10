export type StarterProfileKey =
  | "qidian-male-longform"
  | "qidian-female-longform"
  | "serial-experimental";

export interface StarterProfileFixture {
  profileKey: StarterProfileKey;
  bundleId: string;
  overlayPluginId: string;
  workspaceName: string;
  title: string;
  slug: string;
  rootDirName: string;
  targetPlatform: string;
  totalTargetWordCount: number;
  stopLossWordCount: number;
  chapterTargetWordCount: {
    min: number;
    max: number;
  };
  expectedRuleSet: string;
  expectedRewriteTrigger: string;
  expectedHardRuleNeedle: string;
  expectedRequireFullVolumePlanBeforeDrafting: boolean;
  expectedVolumeTarget?: {
    chaptersMin: number;
    chaptersMax: number;
  };
  excludedPrewriteSteps?: string[];
}

export const starterProfileFixtures: StarterProfileFixture[] = [
  {
    profileKey: "qidian-male-longform",
    bundleId: "topic-qidian-male-longform",
    overlayPluginId: "builtin.starter-qidian-male-longform",
    workspaceName: "Starter Matrix Male",
    title: "Starter Matrix Male",
    slug: "starter-matrix-male",
    rootDirName: "starter-matrix-male",
    targetPlatform: "起点中文网（男频）",
    totalTargetWordCount: 1000000,
    stopLossWordCount: 250000,
    chapterTargetWordCount: {
      min: 2000,
      max: 2500,
    },
    expectedRuleSet: "hook-strength",
    expectedRewriteTrigger: "hook-weakness",
    expectedHardRuleNeedle: "前三章必须至少连续两次直给钩子",
    expectedRequireFullVolumePlanBeforeDrafting: true,
  },
  {
    profileKey: "qidian-female-longform",
    bundleId: "topic-qidian-female-longform",
    overlayPluginId: "builtin.starter-qidian-female-longform",
    workspaceName: "Starter Matrix Female",
    title: "Starter Matrix Female",
    slug: "starter-matrix-female",
    rootDirName: "starter-matrix-female",
    targetPlatform: "起点中文网（女频）",
    totalTargetWordCount: 800000,
    stopLossWordCount: 200000,
    chapterTargetWordCount: {
      min: 2000,
      max: 2500,
    },
    expectedRuleSet: "relationship-line",
    expectedRewriteTrigger: "relationship-drift",
    expectedHardRuleNeedle: "关系推进必须绑定明确的情绪变化",
    expectedRequireFullVolumePlanBeforeDrafting: true,
  },
  {
    profileKey: "serial-experimental",
    bundleId: "topic-serial-experimental",
    overlayPluginId: "builtin.starter-serial-experimental",
    workspaceName: "Starter Matrix Experimental",
    title: "Starter Matrix Experimental",
    slug: "starter-matrix-experimental",
    rootDirName: "starter-matrix-experimental",
    targetPlatform: "待定",
    totalTargetWordCount: 300000,
    stopLossWordCount: 80000,
    chapterTargetWordCount: {
      min: 1800,
      max: 2200,
    },
    expectedRuleSet: "hook-strength",
    expectedRewriteTrigger: "concept-validation-failure",
    expectedHardRuleNeedle: "前 5-10 章先验证钩子与题材抓力",
    expectedRequireFullVolumePlanBeforeDrafting: false,
    expectedVolumeTarget: {
      chaptersMin: 8,
      chaptersMax: 15,
    },
    excludedPrewriteSteps: ["full-volume-plan"],
  },
];
