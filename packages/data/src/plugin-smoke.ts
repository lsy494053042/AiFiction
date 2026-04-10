import fs from "node:fs";
import path from "node:path";

import YAML from "yaml";

import { closeSqliteClient, resolveWorkspaceRoot } from "./client";
import { listPluginConfigSnapshots } from "./plugin-config-history";
import {
  configureAifictionPlugins,
  createAifictionPluginRegistry,
  resolveWorkspaceAifictionPluginConfig,
} from "./plugins";
import type { AifictionPlugin } from "./plugins";
import { runPluginsManagerCommand } from "./plugins-cli";
import { cleanupSmokeWorkspace, prepareAifictionSmokeWorkspace } from "./smoke-workspace";

interface WorkspaceLikeFile {
  plugins?: {
    bundles?: string[];
    enabled?: string[];
    disabled?: string[];
    strict_mode?: boolean;
  };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const workspaceRoot = resolveWorkspaceRoot();
  const workspaceConfig = resolveWorkspaceAifictionPluginConfig(workspaceRoot);
  assert(workspaceConfig.bundles?.includes("core-default"), "Workspace plugin config must include core-default bundle.");

  const workspaceState = configureAifictionPlugins({
    source: "workspace",
    workspaceRoot,
    reset: true,
  });
  assert(!workspaceState.hasBlockingIssues, "Workspace plugin runtime must load without blocking issues.");
  assert(
    workspaceState.loadedPluginIds.includes("builtin.starter-profiles") &&
      workspaceState.loadedPluginIds.includes("builtin.source-document-definitions") &&
      workspaceState.loadedPluginIds.includes("builtin.source-document-semantics") &&
      workspaceState.loadedPluginIds.includes("builtin.source-document-workflow"),
    "Workspace plugin runtime must load all builtin core plugins including starter profiles.",
  );
  assert(
    !workspaceState.loadedPluginIds.includes("builtin.starter-serial-experimental"),
    "Workspace core-default bundle must not load starter-specific overlay plugins by default.",
  );
  assert(
    workspaceState.loadedPluginIds.includes("builtin.source-document-definitions") &&
      workspaceState.loadedPluginIds.includes("builtin.starter-profiles"),
    "Workspace plugin runtime must expose starter profile support.",
  );

  const dependencyFailureState = configureAifictionPlugins({
    source: "explicit",
    pluginIds: ["builtin.source-document-workflow"],
    bundleIds: [],
    reset: true,
  });
  assert(
    dependencyFailureState.records.some(
      (record) => record.pluginId === "builtin.source-document-workflow" && record.reason?.startsWith("missing-required-plugin:"),
    ),
    "Explicit workflow-only selection must report missing required plugins.",
  );

  const starterBundleState = configureAifictionPlugins({
    source: "explicit",
    bundleIds: ["topic-serial-experimental"],
    pluginIds: [],
    reset: true,
  });
  assert(
    starterBundleState.loadedPluginIds.includes("builtin.starter-serial-experimental"),
    "Topic bundle must load the corresponding starter protocol overlay plugin.",
  );
  assert(
    starterBundleState.expandedBundleIds.includes("official-default-authoring") &&
      starterBundleState.expandedBundleIds.includes("starter-serial-experimental"),
    "Topic bundle must expand through the official default bundle and the compatibility starter alias.",
  );

  const compatibilityStarterBundleState = configureAifictionPlugins({
    source: "explicit",
    bundleIds: ["starter-serial-experimental"],
    pluginIds: [],
    reset: true,
  });
  assert(
    compatibilityStarterBundleState.loadedPluginIds.includes("builtin.starter-serial-experimental"),
    "Legacy starter bundle aliases must remain compatible.",
  );

  const conflictingTopicState = configureAifictionPlugins({
    source: "explicit",
    bundleIds: ["topic-qidian-male-longform", "topic-qidian-female-longform"],
    pluginIds: [],
    reset: true,
  });
  assert(
    conflictingTopicState.records.some(
      (record) =>
        record.pluginId === "bundle:topic-qidian-female-longform" &&
        record.reason === "conflicts-with-bundle:topic-qidian-male-longform",
    ),
    "Conflicting topic bundles must produce a bundle-level blocker record.",
  );
  assert(
    conflictingTopicState.loadedPluginIds.includes("builtin.starter-qidian-male-longform") &&
      !conflictingTopicState.loadedPluginIds.includes("builtin.starter-qidian-female-longform"),
    "Conflicting topic bundles must keep the first accepted topic bundle and block the conflicting one.",
  );

  const officialDefaultState = configureAifictionPlugins({
    source: "explicit",
    bundleIds: ["official-default-authoring"],
    pluginIds: [],
    reset: true,
  });
  assert(
    officialDefaultState.loadedPluginIds.includes("builtin.source-document-definitions") &&
      officialDefaultState.loadedPluginIds.includes("builtin.source-document-semantics") &&
      officialDefaultState.loadedPluginIds.includes("builtin.source-document-workflow"),
    "Official default authoring bundle must expand to the core authoring plugin set.",
  );

  let strictFailureObserved = false;
  try {
    configureAifictionPlugins({
      source: "explicit",
      pluginIds: ["missing.plugin"],
      bundleIds: [],
      strictMode: true,
      reset: true,
    });
  } catch {
    strictFailureObserved = true;
  }
  assert(strictFailureObserved, "Strict mode must fail on unknown plugin IDs.");

  const conflictPlugins: AifictionPlugin[] = [
    {
      manifest: {
        pluginId: "test.plugin-a",
        version: "1.0.0",
        apiVersion: "1",
        displayName: "Test Plugin A",
        conflictsWith: ["test.plugin-b"],
        capabilityKinds: [],
      },
    },
    {
      manifest: {
        pluginId: "test.plugin-b",
        version: "1.0.0",
        apiVersion: "1",
        displayName: "Test Plugin B",
        conflictsWith: ["test.plugin-a"],
        capabilityKinds: [],
      },
    },
  ];
  const conflictState = configureAifictionPlugins({
    source: "explicit",
    pluginIds: ["test.plugin-a", "test.plugin-b"],
    bundleIds: [],
    availablePlugins: conflictPlugins,
    reset: true,
  });
  assert(
    conflictState.records.some(
      (record) => record.pluginId === "test.plugin-b" && record.reason?.startsWith("conflicts-with:"),
    ),
    "Conflict runtime must report conflicts-with blockers.",
  );

  const localRegistry = createAifictionPluginRegistry();
  localRegistry.register({
    manifest: {
      pluginId: "test.registry-a",
      version: "1.0.0",
      displayName: "Registry A",
      capabilityKinds: ["source-document-definition"],
    },
    sourceDocumentDefinitions: [
      {
        docKind: "test-doc-kind",
        templateKey: "test-template",
        scope: "test",
        priority: 1,
      },
    ],
  });

  let duplicateDefinitionRejected = false;
  try {
    localRegistry.register({
      manifest: {
        pluginId: "test.registry-b",
        version: "1.0.0",
        displayName: "Registry B",
        capabilityKinds: ["source-document-definition"],
      },
      sourceDocumentDefinitions: [
        {
          docKind: "test-doc-kind",
          templateKey: "other-template",
          scope: "test",
          priority: 1,
        },
      ],
    });
  } catch {
    duplicateDefinitionRejected = true;
  }
  assert(duplicateDefinitionRejected, "Registry must reject duplicated source document definitions from different plugins.");

  const pluginOpsSmokeRoot = path.join(workspaceRoot, "storage", "smoke", "plugin-ops", `run-${Date.now()}`);
  prepareAifictionSmokeWorkspace({
    smokeRoot: pluginOpsSmokeRoot,
    repositoryWorkspaceRoot: workspaceRoot,
    includeDrizzle: false,
  });
  fs.writeFileSync(
    path.join(pluginOpsSmokeRoot, "workspace.yml"),
    YAML.stringify({
      workspace_id: "plugin-ops-smoke",
      workspace_name: "Plugin Ops Smoke",
      root_dir: ".",
      books_dir: "books",
      plugins: {
        api_version: "1",
        bundles: ["core-default", "starter-serial-experimental"],
        enabled: [],
        disabled: [],
        strict_mode: false,
      },
    }),
    "utf8",
  );

  await runPluginsManagerCommand(["snapshot", "baseline", "--workspace-root", pluginOpsSmokeRoot]);
  const baselineSnapshots = listPluginConfigSnapshots(pluginOpsSmokeRoot);
  assert(baselineSnapshots.length === 1, "plugins:manage snapshot must persist a baseline snapshot.");

  await runPluginsManagerCommand(["doctor", "--workspace-root", pluginOpsSmokeRoot]);
  await runPluginsManagerCommand(["normalize-bundles", "--workspace-root", pluginOpsSmokeRoot]);

  let pluginOpsWorkspace = YAML.parse(
    fs.readFileSync(path.join(pluginOpsSmokeRoot, "workspace.yml"), "utf8"),
  ) as WorkspaceLikeFile | undefined;
  assert(
    pluginOpsWorkspace?.plugins?.bundles?.includes("topic-serial-experimental") &&
      !pluginOpsWorkspace?.plugins?.bundles?.includes("starter-serial-experimental"),
    "plugins:manage normalize-bundles must upgrade compatibility bundle aliases to official topic bundles.",
  );

  const snapshotsAfterNormalize = listPluginConfigSnapshots(pluginOpsSmokeRoot);
  assert(
    snapshotsAfterNormalize.length >= 3,
    "plugins:manage normalize-bundles must create before/after snapshots.",
  );

  await runPluginsManagerCommand(["add-bundle", "topic-qidian-female-longform", "--workspace-root", pluginOpsSmokeRoot]);

  pluginOpsWorkspace = YAML.parse(
    fs.readFileSync(path.join(pluginOpsSmokeRoot, "workspace.yml"), "utf8"),
  ) as WorkspaceLikeFile | undefined;
  assert(
    pluginOpsWorkspace?.plugins?.bundles?.includes("topic-qidian-female-longform"),
    "plugins:manage add-bundle must update workspace.yml in the target workspace.",
  );

  const snapshotsAfterMutation = listPluginConfigSnapshots(pluginOpsSmokeRoot);
  assert(
    snapshotsAfterMutation.length >= 5,
    "plugins:manage mutations must capture before/after snapshots for rollback history.",
  );

  await runPluginsManagerCommand(["rollback", baselineSnapshots[0].snapshotId, "--workspace-root", pluginOpsSmokeRoot]);
  pluginOpsWorkspace = YAML.parse(
    fs.readFileSync(path.join(pluginOpsSmokeRoot, "workspace.yml"), "utf8"),
  ) as WorkspaceLikeFile | undefined;
  assert(
    pluginOpsWorkspace?.plugins?.bundles?.includes("starter-serial-experimental") &&
      !pluginOpsWorkspace?.plugins?.bundles?.includes("topic-serial-experimental") &&
      !pluginOpsWorkspace?.plugins?.bundles?.includes("topic-qidian-female-longform"),
    "plugins:manage rollback must restore the snapped workspace plugin config.",
  );

  const snapshotsAfterRollback = listPluginConfigSnapshots(pluginOpsSmokeRoot);
  assert(
    snapshotsAfterRollback.length >= 7,
    "plugins:manage rollback must also create snapshot history entries.",
  );

  await cleanupSmokeWorkspace(pluginOpsSmokeRoot, {
    initialDelayMs: 250,
    maxAttempts: 25,
    retryDelayMs: 150,
  });

  console.log("[AiFiction Plugin Smoke] Workspace config:", JSON.stringify(workspaceConfig));
  console.log("[AiFiction Plugin Smoke] Workspace runtime loaded:", workspaceState.loadedPluginIds.join(", "));
  console.log("[AiFiction Plugin Smoke] Dependency failure validated.");
  console.log("[AiFiction Plugin Smoke] Conflict handling validated.");
  console.log("[AiFiction Plugin Smoke] Registry duplicate protection validated.");
  console.log("[AiFiction Plugin Smoke] Normalize / snapshot / doctor / rollback flow validated.");
}

main()
  .catch((error) => {
    console.error("[AiFiction Plugin Smoke] Error:", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeSqliteClient();
  });
