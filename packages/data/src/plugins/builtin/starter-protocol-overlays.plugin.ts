import type { AifictionPlugin, StarterProfileProtocolOverlayRegistration } from "../types";

const qidianMaleLongformOverlay: StarterProfileProtocolOverlayRegistration = {
  overlayKey: "starter-qidian-male-longform:book-defaults",
  profileKeys: ["qidian-male-longform"],
  priority: 100,
  buildBookProtocolOverlay: () => ({
    rhythm_plan: {
      chapter_function_mix: {
        main_push: "45-55%",
        transition: "10-20%",
        relationship: "5-10%",
        daily_life: "5-10%",
        information: "10-15%",
        payoff: "10-15%",
      },
      hard_rules: [
        "前三章必须至少连续两次直给钩子。",
        "每个小阶段都要有一次看得见的阶段性兑现。",
        "关系章不能连续吃掉两章以上的主线推进。",
      ],
    },
    knowledge_state: {
      enabled_rule_sets: ["continuity", "opening-arc", "anchoring", "exposition", "pacing", "hook-strength"],
    },
    execution_controls: {
      root_cause_first: {
        allowed_rewrite_triggers: [
          "planning-gap",
          "continuity-gap",
          "anchor-gap",
          "knowledge-layer-gap",
          "exposition-gap",
          "pacing-gap",
          "volume-budget-gap",
          "execution-bug",
          "hook-weakness",
        ],
      },
    },
  }),
};

const qidianFemaleLongformOverlay: StarterProfileProtocolOverlayRegistration = {
  overlayKey: "starter-qidian-female-longform:book-defaults",
  profileKeys: ["qidian-female-longform"],
  priority: 100,
  buildBookProtocolOverlay: () => ({
    rhythm_plan: {
      chapter_function_mix: {
        main_push: "25-35%",
        transition: "10-20%",
        relationship: "25-35%",
        daily_life: "10-20%",
        information: "10-15%",
        payoff: "10-15%",
      },
      hard_rules: [
        "关系推进必须绑定明确的情绪变化或关系状态变化。",
        "每个阶段至少兑现一次人物关系层面的关键变化。",
        "日常和关系章不能完全脱离主线钩子。",
      ],
    },
    knowledge_state: {
      enabled_rule_sets: ["continuity", "opening-arc", "anchoring", "exposition", "pacing", "relationship-line"],
    },
    execution_controls: {
      root_cause_first: {
        allowed_rewrite_triggers: [
          "planning-gap",
          "continuity-gap",
          "anchor-gap",
          "knowledge-layer-gap",
          "exposition-gap",
          "pacing-gap",
          "volume-budget-gap",
          "execution-bug",
          "relationship-drift",
        ],
      },
    },
  }),
};

const serialExperimentalOverlay: StarterProfileProtocolOverlayRegistration = {
  overlayKey: "starter-serial-experimental:book-defaults",
  profileKeys: ["serial-experimental"],
  priority: 100,
  buildBookProtocolOverlay: () => ({
    prewrite_gate: {
      require_full_volume_plan_before_drafting: false,
    },
    planning_budget: {
      volume_target: {
        chapters_min: 8,
        chapters_max: 15,
        chars_min: 16000,
        chars_max: 33000,
      },
    },
    rhythm_plan: {
      chapter_function_mix: {
        main_push: "35-45%",
        transition: "10-15%",
        relationship: "10-15%",
        daily_life: "5-10%",
        information: "15-20%",
        payoff: "10-15%",
      },
      hard_rules: [
        "前 5-10 章先验证钩子与题材抓力，不急于展开全部大设定。",
        "实验阶段每一卷都必须有独立止损点和可复盘结论。",
        "如果概念验证失败，优先止损而不是硬扩盘。",
      ],
    },
    execution_controls: {
      planning_first: {
        required_prewrite_sequence: [
          "platform-lock",
          "stop-loss-lock",
          "total-word-target-lock",
          "chapter-word-target-lock",
          "current-batch-outline",
        ],
      },
      root_cause_first: {
        allowed_rewrite_triggers: [
          "planning-gap",
          "continuity-gap",
          "anchor-gap",
          "knowledge-layer-gap",
          "exposition-gap",
          "pacing-gap",
          "volume-budget-gap",
          "execution-bug",
          "hook-weakness",
          "concept-validation-failure",
        ],
      },
    },
    knowledge_state: {
      enabled_rule_sets: ["continuity", "opening-arc", "anchoring", "exposition", "pacing", "hook-strength"],
    },
  }),
};

export const builtinStarterQidianMaleLongformPlugin: AifictionPlugin = {
  manifest: {
    pluginId: "builtin.starter-qidian-male-longform",
    version: "1.0.0",
    apiVersion: "1",
    displayName: "Starter Qidian Male Longform",
    description: "Applies protocol defaults for Qidian male-frequency longform projects.",
    builtin: true,
    capabilityKinds: ["starter-profile-protocol-overlay"],
  },
  starterProfileProtocolOverlays: [qidianMaleLongformOverlay],
};

export const builtinStarterQidianFemaleLongformPlugin: AifictionPlugin = {
  manifest: {
    pluginId: "builtin.starter-qidian-female-longform",
    version: "1.0.0",
    apiVersion: "1",
    displayName: "Starter Qidian Female Longform",
    description: "Applies protocol defaults for Qidian female-frequency longform projects.",
    builtin: true,
    capabilityKinds: ["starter-profile-protocol-overlay"],
  },
  starterProfileProtocolOverlays: [qidianFemaleLongformOverlay],
};

export const builtinStarterSerialExperimentalPlugin: AifictionPlugin = {
  manifest: {
    pluginId: "builtin.starter-serial-experimental",
    version: "1.0.0",
    apiVersion: "1",
    displayName: "Starter Serial Experimental",
    description: "Applies protocol defaults for experimental serial validation projects.",
    builtin: true,
    capabilityKinds: ["starter-profile-protocol-overlay"],
  },
  starterProfileProtocolOverlays: [serialExperimentalOverlay],
};
