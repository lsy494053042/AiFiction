import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import YAML from "yaml";

import { closeSqliteClient, resolveWorkspaceRoot } from "./client";
import { assertAifictionPreflight } from "./preflight";
import {
  configureAifictionPlugins,
  getAifictionPluginRegistry,
  listBuiltinAifictionPluginBundles,
} from "./plugins";
import type { AifictionWorkspacePluginConfig } from "./plugins";
import type {
  WorkspaceBookStartersProtocol,
  WorkspaceProtocol,
  WorkspaceStarterProfileProtocol,
} from "./protocol";
import { defaultWorkspaceBookStarters, mergeWorkspaceBookStarters } from "./protocol/starter-profiles";

export interface InitWorkspaceArgs {
  command: "show-defaults" | "init";
  workspaceName?: string;
  bundleIds: string[];
  defaultProfileKey?: string;
  dryRun: boolean;
}

interface WorkspaceInitDefaults {
  bundles: ReturnType<typeof listBuiltinAifictionPluginBundles>;
  configuredBundles: string[];
  defaultStarterProfile?: string;
  starterProfiles: Array<{
    profileKey?: string;
    label?: string;
    bundles?: string[];
  }>;
}

function dedupeStrings(values: Array<string | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .map((value) => value.trim()),
    ),
  );
}

export function parseInitWorkspaceArgs(argv: string[]): InitWorkspaceArgs {
  let command: InitWorkspaceArgs["command"] = "show-defaults";
  let workspaceName: string | undefined;
  const bundleIds: string[] = [];
  let defaultProfileKey: string | undefined;
  let dryRun = false;

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    if (current === "show-defaults" || current === "init") {
      command = current;
      continue;
    }
    if (current === "--workspace-name" && next) {
      workspaceName = next;
      index += 1;
      continue;
    }
    if ((current === "--default-profile" || current === "--profile") && next) {
      defaultProfileKey = next;
      index += 1;
      continue;
    }
    if (current === "--bundle" && next) {
      bundleIds.push(next);
      index += 1;
      continue;
    }
    if (current === "--dry-run") {
      dryRun = true;
    }
  }

  return {
    command,
    workspaceName,
    bundleIds,
    defaultProfileKey,
    dryRun,
  };
}

function readWorkspaceFile(workspaceRoot: string): WorkspaceProtocol | undefined {
  const workspaceFilePath = path.join(workspaceRoot, "workspace.yml");
  if (!fs.existsSync(workspaceFilePath)) {
    return undefined;
  }

  return YAML.parse(fs.readFileSync(workspaceFilePath, "utf8")) as WorkspaceProtocol | undefined;
}

function resolveCandidateBundleIds(
  existing: AifictionWorkspacePluginConfig | undefined,
  requestedBundleIds: string[],
): string[] {
  return dedupeStrings(["core-default", ...(existing?.bundles ?? []), ...requestedBundleIds]);
}

function resolveStarterProfiles(
  workspaceRoot: string,
  workspace: WorkspaceProtocol | undefined,
  bundleIds: string[],
): WorkspaceBookStartersProtocol {
  configureAifictionPlugins({
    source: "explicit",
    workspaceRoot,
    bundleIds,
    pluginIds: [],
    strictMode: true,
    reset: true,
  });

  const registry = getAifictionPluginRegistry();
  return mergeWorkspaceBookStarters({
    registeredDefaultProfileKey:
      registry.getPreferredDefaultStarterProfile()?.profile.profile_key ?? defaultWorkspaceBookStarters.default_profile_key,
    registeredProfiles: registry.listStarterProfiles().map((item) => item.profile),
    workspaceStarters: workspace?.book_starters,
  });
}

function resolveStarterProfile(
  starters: WorkspaceBookStartersProtocol,
  profileKey: string,
): WorkspaceStarterProfileProtocol {
  const profile = starters.profiles?.find((item) => item.profile_key === profileKey);
  if (!profile) {
    throw new Error(`workspace:init could not find starter profile: ${profileKey}`);
  }
  return profile;
}

function normalizePluginConfig(
  existing: AifictionWorkspacePluginConfig | undefined,
  bundleIds: string[],
): AifictionWorkspacePluginConfig {
  return {
    api_version: existing?.api_version ?? "1",
    bundles: dedupeStrings(bundleIds).length ? dedupeStrings(bundleIds) : ["core-default"],
    enabled: dedupeStrings(existing?.enabled ?? []),
    disabled: dedupeStrings(existing?.disabled ?? []),
    strict_mode: existing?.strict_mode ?? false,
  };
}

function normalizeStarterProfileForPersistence(
  profile: WorkspaceStarterProfileProtocol,
): WorkspaceStarterProfileProtocol {
  const pluginBundles = dedupeStrings(profile.plugin_bundles ?? []);
  const normalizedBundles =
    pluginBundles.length > 1 && pluginBundles.includes("core-default")
      ? pluginBundles.filter((bundleId) => bundleId !== "core-default")
      : pluginBundles;

  return {
    ...profile,
    plugin_bundles: normalizedBundles.length ? normalizedBundles : undefined,
  };
}

function normalizeBookStartersForPersistence(
  starters: WorkspaceBookStartersProtocol,
): WorkspaceBookStartersProtocol {
  return {
    default_profile_key: starters.default_profile_key,
    profiles: (starters.profiles ?? []).map((profile) => normalizeStarterProfileForPersistence(profile)),
  };
}

function buildWorkspaceProtocolDefaults(input: {
  workspaceName?: string;
  existing?: WorkspaceProtocol;
  pluginConfig: AifictionWorkspacePluginConfig;
  defaultProfileKey: string;
  bookStarters: WorkspaceBookStartersProtocol;
}): WorkspaceProtocol {
  const current = input.existing;

  return {
    workspace_id: current?.workspace_id ?? "aifiction-workspace",
    workspace_name: input.workspaceName ?? current?.workspace_name ?? "AiFiction 工作区",
    root_dir: current?.root_dir ?? ".",
    books_dir: current?.books_dir ?? "books",
    active_book_id: current?.active_book_id,
    default_book_id: current?.default_book_id,
    book_index: current?.book_index ?? [],
    defaults: {
      chapter_file_pattern: current?.defaults?.chapter_file_pattern ?? "{index:04d}-{title}.md",
      encoding: current?.defaults?.encoding ?? "utf-8",
      auto_sync_after_finalize: current?.defaults?.auto_sync_after_finalize ?? true,
      context_pack_dirname: current?.defaults?.context_pack_dirname ?? "03-中间产物/context-packs",
      proposal_dirname: current?.defaults?.proposal_dirname ?? "03-中间产物/proposals",
    },
    plugins: input.pluginConfig,
    book_starters: {
      default_profile_key: input.defaultProfileKey,
      profiles: normalizeBookStartersForPersistence(input.bookStarters).profiles ?? [],
    },
    knowledge_workflow: {
      batch_size: current?.knowledge_workflow?.batch_size ?? 10,
      require_batch_review_before_next_batch: current?.knowledge_workflow?.require_batch_review_before_next_batch ?? true,
      auto_create_candidates_from_feedback: current?.knowledge_workflow?.auto_create_candidates_from_feedback ?? true,
      opening_arc_review_points:
        current?.knowledge_workflow?.opening_arc_review_points?.length
          ? current.knowledge_workflow.opening_arc_review_points
          : [3, 5, 10],
      phase_review_word_counts:
        current?.knowledge_workflow?.phase_review_word_counts?.length
          ? current.knowledge_workflow.phase_review_word_counts
          : [30000, 50000],
      active_budget: {
        global_rules: current?.knowledge_workflow?.active_budget?.global_rules ?? 12,
        book_rules: current?.knowledge_workflow?.active_budget?.book_rules ?? 12,
        batch_focus_findings: current?.knowledge_workflow?.active_budget?.batch_focus_findings ?? 5,
        total_book_rules: current?.knowledge_workflow?.active_budget?.total_book_rules ?? 20,
        total_validated_global_rules: current?.knowledge_workflow?.active_budget?.total_validated_global_rules ?? 30,
      },
      promotion_policy: {
        book_only_after_hits: current?.knowledge_workflow?.promotion_policy?.book_only_after_hits ?? 2,
        validated_global_after_batch_hits:
          current?.knowledge_workflow?.promotion_policy?.validated_global_after_batch_hits ?? 3,
        validated_global_after_book_hits:
          current?.knowledge_workflow?.promotion_policy?.validated_global_after_book_hits ?? 2,
      },
      enabled_gates:
        current?.knowledge_workflow?.enabled_gates?.length
          ? current.knowledge_workflow.enabled_gates
          : [
              "batch-review-required",
              "meta-language-check",
              "continuity-review",
              "anchoring-review",
              "opening-arc-review",
              "prewrite-plan-required",
              "rhythm-plan-required",
              "volume-budget-check",
            ],
    },
    execution_policy: {
      planning_first: {
        require_full_volume_plan_before_drafting:
          current?.execution_policy?.planning_first?.require_full_volume_plan_before_drafting ?? true,
        require_stage_map_before_batch_drafting:
          current?.execution_policy?.planning_first?.require_stage_map_before_batch_drafting ?? true,
        require_current_batch_outline_before_drafting:
          current?.execution_policy?.planning_first?.require_current_batch_outline_before_drafting ?? true,
      },
      verification_before_completion: {
        require_evidence_before_mark_done:
          current?.execution_policy?.verification_before_completion?.require_evidence_before_mark_done ?? true,
        required_after_batch:
          current?.execution_policy?.verification_before_completion?.required_after_batch?.length
            ? current.execution_policy.verification_before_completion.required_after_batch
            : ["writing:meta-check", "writing:budget-check"],
        required_before_claiming_completion:
          current?.execution_policy?.verification_before_completion?.required_before_claiming_completion?.length
            ? current.execution_policy.verification_before_completion.required_before_claiming_completion
            : ["encoding:check", "db:protocol-smoke"],
      },
      root_cause_first: {
        require_issue_classification_before_rewrite:
          current?.execution_policy?.root_cause_first?.require_issue_classification_before_rewrite ?? true,
        default_categories:
          current?.execution_policy?.root_cause_first?.default_categories?.length
            ? current.execution_policy.root_cause_first.default_categories
            : [
                "planning-gap",
                "continuity-gap",
                "anchor-gap",
                "knowledge-layer-gap",
                "exposition-gap",
                "pacing-gap",
                "volume-budget-gap",
                "execution-bug",
              ],
      },
    },
    task_routing: current?.task_routing ?? {
      create_book: {
        trigger_examples: ["我想写一本都市悬疑", "新建一本玄幻复仇文"],
        default_stage: "planning",
      },
      continue_book: {
        trigger_examples: ["继续写这本书", "继续写当前作品"],
        use_active_book: true,
      },
      write_chapter: {
        trigger_examples: ["从第 12 章开始写", "继续写第 25 章"],
        required_context_pack: "writing-pack",
      },
      investigate_risk: {
        trigger_examples: ["处理这个风险", "看看这个冲突怎么改"],
        required_context_pack: "risk-investigation-pack",
      },
    },
  };
}

function buildWorkspaceInitDefaults(
  workspaceRoot: string,
  bundleIds: string[],
): WorkspaceInitDefaults {
  const existing = readWorkspaceFile(workspaceRoot);
  const configuredBundles = resolveCandidateBundleIds(existing?.plugins, bundleIds);
  const starters = resolveStarterProfiles(workspaceRoot, existing, configuredBundles);

  return {
    bundles: listBuiltinAifictionPluginBundles(),
    configuredBundles,
    defaultStarterProfile: starters.default_profile_key,
    starterProfiles: (starters.profiles ?? []).map((profile) => ({
      profileKey: profile.profile_key,
      label: profile.label,
      bundles: profile.plugin_bundles,
    })),
  };
}

export async function initWorkspace(args: InitWorkspaceArgs) {
  const workspaceRoot = resolveWorkspaceRoot();
  const existing = readWorkspaceFile(workspaceRoot);
  const candidateBundleIds = resolveCandidateBundleIds(existing?.plugins, args.bundleIds);
  const starters = resolveStarterProfiles(workspaceRoot, existing, candidateBundleIds);
  const defaultProfileKey =
    args.defaultProfileKey ??
    existing?.book_starters?.default_profile_key ??
    starters.default_profile_key ??
    defaultWorkspaceBookStarters.default_profile_key ??
    "qidian-male-longform";
  const starterProfile = resolveStarterProfile(starters, defaultProfileKey);
  const finalBundleIds = dedupeStrings([...candidateBundleIds, ...(starterProfile.plugin_bundles ?? [])]);
  const pluginConfig = normalizePluginConfig(existing?.plugins, finalBundleIds);

  const nextWorkspace = buildWorkspaceProtocolDefaults({
    workspaceName: args.workspaceName,
    existing,
    pluginConfig,
    defaultProfileKey,
    bookStarters: starters,
  });

  const workspaceFilePath = path.join(workspaceRoot, "workspace.yml");
  if (args.dryRun) {
    console.log(
      JSON.stringify(
        {
          workspaceFilePath,
          workspaceName: nextWorkspace.workspace_name,
          bundles: nextWorkspace.plugins?.bundles ?? [],
          defaultStarterProfile: nextWorkspace.book_starters?.default_profile_key,
          starterProfileBundles: starterProfile.plugin_bundles ?? [],
          bookCount: nextWorkspace.book_index?.length ?? 0,
        },
        null,
        2,
      ),
    );
    return;
  }

  fs.writeFileSync(workspaceFilePath, YAML.stringify(nextWorkspace), "utf8");
  console.log(`[AiFiction Init Workspace] Workspace file: ${workspaceFilePath}`);
  console.log(`[AiFiction Init Workspace] Workspace name: ${nextWorkspace.workspace_name}`);
  console.log(`[AiFiction Init Workspace] Bundles: ${(nextWorkspace.plugins?.bundles ?? []).join(", ")}`);
  console.log(`[AiFiction Init Workspace] Default starter profile: ${nextWorkspace.book_starters?.default_profile_key}`);
}

export async function runInitWorkspaceCommand(argv = process.argv.slice(2)) {
  const args = parseInitWorkspaceArgs(argv);
  assertAifictionPreflight({
    commandLabel: `workspace:init:${args.command}`,
    mode: "bootstrap",
  });

  if (args.command === "show-defaults") {
    const workspaceRoot = resolveWorkspaceRoot();
    console.log(JSON.stringify(buildWorkspaceInitDefaults(workspaceRoot, args.bundleIds), null, 2));
    return;
  }

  await initWorkspace(args);
}

function isDirectExecution() {
  const entryPath = process.argv[1];
  if (!entryPath) {
    return false;
  }

  return import.meta.url === pathToFileURL(entryPath).href;
}

if (isDirectExecution()) {
  runInitWorkspaceCommand()
    .catch((error) => {
      console.error("[AiFiction Init Workspace] Error:", error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    })
    .finally(async () => {
      await closeSqliteClient();
    });
}
