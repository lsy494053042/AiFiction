import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import YAML from "yaml";

import { closeSqliteClient, resolveWorkspaceRoot } from "./client";
import { buildPluginDoctorReport, inspectPluginRuntime } from "./plugin-doctor";
import { normalizeCompatibilityBundleIds } from "./plugin-bundle-compat";
import {
  getPluginConfigSnapshot,
  listPluginConfigSnapshots,
  savePluginConfigSnapshot,
} from "./plugin-config-history";
import {
  listBuiltinAifictionPluginBundles,
  listBuiltinAifictionPluginManifests,
  resolveWorkspaceAifictionPluginConfig,
} from "./plugins";
import { assertAifictionPreflight } from "./preflight";
import type { AifictionWorkspacePluginConfig } from "./plugins";

interface WorkspaceFileWithPlugins {
  plugins?: AifictionWorkspacePluginConfig;
}

interface PluginConfigUpdateOptions {
  silent?: boolean;
}

interface PluginConfigUpdateResult {
  previousConfig: AifictionWorkspacePluginConfig;
  nextConfig: AifictionWorkspacePluginConfig;
  beforeSnapshotId: string;
  afterSnapshotId: string;
}

function parseArgs(argv: string[]) {
  let command = "status";
  let value: string | undefined;
  let commandSet = false;
  const options: Record<string, string | boolean> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    if (!current.startsWith("--")) {
      if (!commandSet) {
        command = current;
        commandSet = true;
      } else if (!value) {
        value = current;
      }
      continue;
    }

    if (current === "--workspace-root" && next) {
      options.workspaceRoot = next;
      index += 1;
      continue;
    }
    if (current === "--strict") {
      options.strict = true;
      continue;
    }
    if (current === "--no-strict") {
      options.strict = false;
      continue;
    }
  }

  return {
    command,
    value,
    workspaceRoot:
      typeof options.workspaceRoot === "string" ? path.resolve(options.workspaceRoot) : resolveWorkspaceRoot(),
    strict: typeof options.strict === "boolean" ? options.strict : undefined,
  };
}

function readWorkspaceFile(workspaceRoot: string): WorkspaceFileWithPlugins {
  const workspaceFilePath = path.join(workspaceRoot, "workspace.yml");
  if (!fs.existsSync(workspaceFilePath)) {
    throw new Error(`workspace.yml does not exist: ${workspaceFilePath}`);
  }

  return YAML.parse(fs.readFileSync(workspaceFilePath, "utf8")) as WorkspaceFileWithPlugins;
}

function writeWorkspaceFile(workspaceRoot: string, data: WorkspaceFileWithPlugins) {
  const workspaceFilePath = path.join(workspaceRoot, "workspace.yml");
  fs.writeFileSync(workspaceFilePath, YAML.stringify(data), "utf8");
}

function normalizeConfig(config: AifictionWorkspacePluginConfig | undefined): AifictionWorkspacePluginConfig {
  return {
    api_version: config?.api_version ?? "1",
    bundles: config?.bundles?.length ? [...new Set(config.bundles)] : ["core-default"],
    enabled: config?.enabled?.length ? [...new Set(config.enabled)] : [],
    disabled: config?.disabled?.length ? [...new Set(config.disabled)] : [],
    strict_mode: config?.strict_mode ?? false,
  };
}

function printSnapshotHistory(workspaceRoot: string) {
  const snapshots = listPluginConfigSnapshots(workspaceRoot);
  console.log("[AiFiction Plugins] Snapshot History:");
  if (!snapshots.length) {
    console.log("- (empty)");
    return;
  }

  for (const snapshot of snapshots) {
    const bundles = snapshot.workspaceConfig.bundles?.join(", ") || "(none)";
    console.log(
      `- ${snapshot.snapshotId} / ${snapshot.createdAt} / ${snapshot.label ?? "manual"} / bundles=${bundles}`,
    );
  }
}

function printDoctorReport(workspaceRoot: string) {
  const report = buildPluginDoctorReport(workspaceRoot);
  console.log("[AiFiction Plugins] Doctor:");
  console.log(JSON.stringify(report, null, 2));
}

function printStatus(workspaceRoot: string) {
  const manifests = listBuiltinAifictionPluginManifests();
  const bundles = listBuiltinAifictionPluginBundles();
  const workspaceConfig = resolveWorkspaceAifictionPluginConfig(workspaceRoot);
  const runtimeState = inspectPluginRuntime(workspaceRoot, workspaceConfig);

  console.log("[AiFiction Plugins] Workspace:", workspaceRoot);
  console.log("[AiFiction Plugins] Bundles:");
  for (const bundle of bundles) {
    const category = bundle.category ? ` [${bundle.category}]` : "";
    const includes = bundle.includesBundles?.length ? ` / includes=${bundle.includesBundles.join(", ")}` : "";
    const plugins = bundle.pluginIds.length ? ` / plugins=${bundle.pluginIds.join(", ")}` : "";
    const profiles = bundle.recommendedStarterProfiles?.length
      ? ` / starters=${bundle.recommendedStarterProfiles.join(", ")}`
      : "";
    console.log(`- ${bundle.bundleId}${category}${includes}${plugins}${profiles}`);
  }

  console.log("[AiFiction Plugins] Builtin Plugins:");
  for (const manifest of manifests) {
    const requires = manifest.requiresPlugins?.length ? ` / requires=${manifest.requiresPlugins.join(",")}` : "";
    const conflicts = manifest.conflictsWith?.length
      ? ` / conflicts=${manifest.conflictsWith.join(",")}`
      : "";
    console.log(`- ${manifest.pluginId} @ ${manifest.version} / api=${manifest.apiVersion ?? "1"}${requires}${conflicts}`);
  }

  console.log("[AiFiction Plugins] Workspace Config:");
  console.log(JSON.stringify(workspaceConfig, null, 2));

  console.log("[AiFiction Plugins] Runtime:");
  console.log(JSON.stringify(runtimeState, null, 2));
}

function updateWorkspacePlugins(
  workspaceRoot: string,
  label: string,
  mutate: (config: AifictionWorkspacePluginConfig) => AifictionWorkspacePluginConfig,
  options: PluginConfigUpdateOptions = {},
): PluginConfigUpdateResult {
  const { silent = false } = options;
  const workspace = readWorkspaceFile(workspaceRoot);
  const previousConfig = normalizeConfig(workspace.plugins);
  const beforeSnapshot = savePluginConfigSnapshot({
    workspaceRoot,
    source: "plugins-cli",
    label: `before:${label}`,
    workspaceConfig: previousConfig,
  });

  const nextConfig = mutate(previousConfig);
  workspace.plugins = normalizeConfig(nextConfig);
  writeWorkspaceFile(workspaceRoot, workspace);

  const runtimeState = inspectPluginRuntime(workspaceRoot, workspace.plugins);
  const afterSnapshot = savePluginConfigSnapshot({
    workspaceRoot,
    source: "plugins-cli",
    label: `after:${label}`,
    workspaceConfig: normalizeConfig(workspace.plugins),
    runtimeState,
  });
  if (!silent) {
    console.log(`[AiFiction Plugins] Snapshot saved: ${afterSnapshot.snapshotId} (${afterSnapshot.label})`);
  }

  return {
    previousConfig,
    nextConfig: normalizeConfig(workspace.plugins),
    beforeSnapshotId: beforeSnapshot.snapshotId,
    afterSnapshotId: afterSnapshot.snapshotId,
  };
}

export function normalizeWorkspaceCompatibilityBundles(
  workspaceRoot: string,
  options: PluginConfigUpdateOptions = {},
): PluginConfigUpdateResult {
  return updateWorkspacePlugins(
    workspaceRoot,
    "normalize-bundles",
    (config) => ({
      ...config,
      bundles: normalizeCompatibilityBundleIds(config.bundles ?? []),
    }),
    options,
  );
}

function createManualSnapshot(workspaceRoot: string, label?: string) {
  const workspace = readWorkspaceFile(workspaceRoot);
  const workspaceConfig = normalizeConfig(workspace.plugins);
  const runtimeState = inspectPluginRuntime(workspaceRoot, workspaceConfig);
  const snapshot = savePluginConfigSnapshot({
    workspaceRoot,
    source: "plugins-cli",
    label,
    workspaceConfig,
    runtimeState,
  });
  console.log(`[AiFiction Plugins] Snapshot saved: ${snapshot.snapshotId} (${snapshot.label ?? "manual"})`);
}

function rollbackWorkspacePlugins(workspaceRoot: string, snapshotId: string) {
  const snapshot = getPluginConfigSnapshot(workspaceRoot, snapshotId);
  if (!snapshot) {
    throw new Error(`rollback could not find snapshot: ${snapshotId}`);
  }

  const workspace = readWorkspaceFile(workspaceRoot);
  const currentConfig = normalizeConfig(workspace.plugins);
  savePluginConfigSnapshot({
    workspaceRoot,
    source: "plugins-cli",
    label: `before:rollback:${snapshotId}`,
    workspaceConfig: currentConfig,
  });

  workspace.plugins = normalizeConfig(snapshot.workspaceConfig);
  writeWorkspaceFile(workspaceRoot, workspace);

  const runtimeState = inspectPluginRuntime(workspaceRoot, workspace.plugins);
  const afterSnapshot = savePluginConfigSnapshot({
    workspaceRoot,
    source: "plugins-cli",
    label: `after:rollback:${snapshotId}`,
    workspaceConfig: normalizeConfig(workspace.plugins),
    runtimeState,
  });
  console.log(`[AiFiction Plugins] Rolled back to snapshot: ${snapshot.snapshotId}`);
  console.log(`[AiFiction Plugins] Snapshot saved: ${afterSnapshot.snapshotId} (${afterSnapshot.label})`);
}

export async function runPluginsManagerCommand(argv = process.argv.slice(2)) {
  const { command, value, workspaceRoot, strict } = parseArgs(argv);
  assertAifictionPreflight({
    commandLabel: `plugins:manage:${command}`,
    workspaceRoot,
    mode: "workspace",
  });

  switch (command) {
    case "list":
    case "status":
      printStatus(workspaceRoot);
      break;
    case "doctor":
      printDoctorReport(workspaceRoot);
      break;
    case "history":
      printSnapshotHistory(workspaceRoot);
      break;
    case "snapshot":
      createManualSnapshot(workspaceRoot, value);
      break;
    case "rollback":
      if (!value) {
        throw new Error("rollback requires a snapshot ID.");
      }
      rollbackWorkspacePlugins(workspaceRoot, value);
      printStatus(workspaceRoot);
      break;
    case "enable":
      if (!value) {
        throw new Error("enable requires a plugin ID.");
      }
      updateWorkspacePlugins(workspaceRoot, `enable:${value}`, (config) => ({
        ...config,
        enabled: [...new Set([...(config.enabled ?? []), value])],
        disabled: (config.disabled ?? []).filter((pluginId) => pluginId !== value),
      }));
      printStatus(workspaceRoot);
      break;
    case "disable":
      if (!value) {
        throw new Error("disable requires a plugin ID.");
      }
      updateWorkspacePlugins(workspaceRoot, `disable:${value}`, (config) => ({
        ...config,
        disabled: [...new Set([...(config.disabled ?? []), value])],
        enabled: (config.enabled ?? []).filter((pluginId) => pluginId !== value),
      }));
      printStatus(workspaceRoot);
      break;
    case "use-bundle":
      if (!value) {
        throw new Error("use-bundle requires a bundle ID.");
      }
      updateWorkspacePlugins(workspaceRoot, `use-bundle:${value}`, (config) => ({
        ...config,
        bundles: [...new Set([value])],
      }));
      printStatus(workspaceRoot);
      break;
    case "add-bundle":
      if (!value) {
        throw new Error("add-bundle requires a bundle ID.");
      }
      updateWorkspacePlugins(workspaceRoot, `add-bundle:${value}`, (config) => ({
        ...config,
        bundles: [...new Set([...(config.bundles ?? []), value])],
      }));
      printStatus(workspaceRoot);
      break;
    case "remove-bundle":
      if (!value) {
        throw new Error("remove-bundle requires a bundle ID.");
      }
      updateWorkspacePlugins(workspaceRoot, `remove-bundle:${value}`, (config) => ({
        ...config,
        bundles: (config.bundles ?? []).filter((bundleId) => bundleId !== value),
      }));
      printStatus(workspaceRoot);
      break;
    case "normalize-bundles":
      normalizeWorkspaceCompatibilityBundles(workspaceRoot);
      printStatus(workspaceRoot);
      break;
    case "set-strict":
      if (typeof strict !== "boolean") {
        throw new Error("set-strict requires --strict or --no-strict.");
      }
      updateWorkspacePlugins(workspaceRoot, `set-strict:${strict ? "true" : "false"}`, (config) => ({
        ...config,
        strict_mode: strict,
      }));
      printStatus(workspaceRoot);
      break;
    case "reset":
      updateWorkspacePlugins(workspaceRoot, "reset", () => ({
        api_version: "1",
        bundles: ["core-default"],
        enabled: [],
        disabled: [],
        strict_mode: false,
      }));
      printStatus(workspaceRoot);
      break;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

async function main() {
  await runPluginsManagerCommand();
}

function isDirectExecution() {
  const entryPath = process.argv[1];
  if (!entryPath) {
    return false;
  }

  return import.meta.url === pathToFileURL(entryPath).href;
}

if (isDirectExecution()) {
  main()
    .catch((error) => {
      console.error("[AiFiction Plugins] Error:", error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    })
    .finally(async () => {
      await closeSqliteClient();
    });
}
