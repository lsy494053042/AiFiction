import type {
  WorkspaceBookStartersProtocol,
  WorkspaceStarterProfileProtocol,
} from "./workspace-protocol.service";

function mergeChapterTarget(
  base: WorkspaceStarterProfileProtocol["chapter_target_word_count"] | undefined,
  override: WorkspaceStarterProfileProtocol["chapter_target_word_count"] | undefined,
) {
  if (!base && !override) {
    return undefined;
  }

  return {
    min: override?.min ?? base?.min,
    max: override?.max ?? base?.max,
  };
}

function mergeStarterProfile(
  base: WorkspaceStarterProfileProtocol | undefined,
  override: WorkspaceStarterProfileProtocol,
): WorkspaceStarterProfileProtocol {
  const pluginBundles = Array.from(new Set([...(base?.plugin_bundles ?? []), ...(override.plugin_bundles ?? [])]));
  return {
    ...base,
    ...override,
    profile_key: override.profile_key ?? base?.profile_key,
    chapter_target_word_count: mergeChapterTarget(base?.chapter_target_word_count, override.chapter_target_word_count),
    plugin_bundles: pluginBundles.length ? pluginBundles : undefined,
    hard_constraints: override.hard_constraints?.length ? override.hard_constraints : base?.hard_constraints,
  };
}

export const defaultWorkspaceBookStarters: WorkspaceBookStartersProtocol = {
  default_profile_key: "qidian-male-longform",
  profiles: [
    {
      profile_key: "qidian-male-longform",
      label: "起点男频长篇",
      description: "默认用于起点男频、百万字级别、2000-2500 章均的连载项目。",
      genre: "男频网文",
      target_platform: "起点中文网（男频）",
      total_target_word_count: 1000000,
      stop_loss_word_count: 250000,
      chapter_target_word_count: {
        min: 2000,
        max: 2500,
      },
      daily_word_target: 4000,
      update_cadence: "日更",
      plugin_bundles: ["topic-qidian-male-longform"],
      hard_constraints: [
        "单章目标字数 2000-2500",
        "分卷按内容优先测算，不先拍章数",
        "正文前必须先完成整卷规划和全章定位",
      ],
      focus_task_type: "planning",
      focus_task_label: "开书规划",
      focus_goal: "先完成平台、止损线、整卷规划、阶段图和批次章纲，再进入正文。",
      focus_summary: "先固化设定和大纲骨架，正文只建立在完整规划之后。",
    },
    {
      profile_key: "qidian-female-longform",
      label: "起点女频长篇",
      description: "默认用于起点女频、长篇连载、稳定日更项目。",
      genre: "女频网文",
      target_platform: "起点中文网（女频）",
      total_target_word_count: 800000,
      stop_loss_word_count: 200000,
      chapter_target_word_count: {
        min: 2000,
        max: 2500,
      },
      daily_word_target: 4000,
      update_cadence: "日更",
      plugin_bundles: ["topic-qidian-female-longform"],
      hard_constraints: [
        "单章目标字数 2000-2500",
        "开正文前必须锁定平台、总字数、止损线和卷体量",
      ],
      focus_task_type: "planning",
      focus_task_label: "开书规划",
      focus_goal: "先完成作品定位、核心关系线、卷级规划和当前批次章纲。",
      focus_summary: "先把感情线、人物锚点和卷级推进关系钉死，再进正文。",
    },
    {
      profile_key: "serial-experimental",
      label: "实验连载",
      description: "用于先快速验证概念、再决定是否扩成长篇的实验型项目。",
      genre: "实验项目",
      target_platform: "待定",
      total_target_word_count: 300000,
      stop_loss_word_count: 80000,
      chapter_target_word_count: {
        min: 1800,
        max: 2200,
      },
      daily_word_target: 2500,
      update_cadence: "灵活",
      plugin_bundles: ["topic-serial-experimental"],
      hard_constraints: [
        "先验证题材与钩子，不提前承诺超长总盘子",
        "实验阶段每一卷都要有独立止损节点",
      ],
      focus_task_type: "planning",
      focus_task_label: "概念验证",
      focus_goal: "先验证题材卖点、主线闭环和前 5-10 章抓力。",
      focus_summary: "这是试跑型项目，先证明读者抓力和结构闭环，再决定是否扩盘。",
    },
  ],
};

export function mergeWorkspaceBookStarters(input: {
  registeredDefaultProfileKey?: string;
  registeredProfiles?: WorkspaceStarterProfileProtocol[];
  workspaceStarters?: WorkspaceBookStartersProtocol;
}): WorkspaceBookStartersProtocol {
  const profilesByKey = new Map<string, WorkspaceStarterProfileProtocol>();

  for (const profile of input.registeredProfiles ?? []) {
    const profileKey = profile.profile_key?.trim();
    if (!profileKey) {
      continue;
    }
    profilesByKey.set(profileKey, mergeStarterProfile(undefined, profile));
  }

  for (const profile of input.workspaceStarters?.profiles ?? []) {
    const profileKey = profile.profile_key?.trim();
    if (!profileKey) {
      continue;
    }
    profilesByKey.set(profileKey, mergeStarterProfile(profilesByKey.get(profileKey), profile));
  }

  const defaultProfileKey =
    input.workspaceStarters?.default_profile_key ??
    input.registeredDefaultProfileKey ??
    defaultWorkspaceBookStarters.default_profile_key;

  return {
    default_profile_key: defaultProfileKey,
    profiles: [...profilesByKey.values()].sort((left, right) =>
      left.profile_key === defaultProfileKey
        ? -1
        : right.profile_key === defaultProfileKey
          ? 1
          : (left.profile_key ?? "").localeCompare(right.profile_key ?? "", "zh-CN"),
    ),
  };
}
