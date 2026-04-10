import fs from "node:fs";
import path from "node:path";

import YAML from "yaml";

import { resolveWorkspaceRoot } from "../client";
import { builtinSourceDocumentSemanticsPlugin } from "../sync/source-document-semantics";
import { getAifictionPluginRegistry, registerAifictionPlugin, resetAifictionPluginRegistry } from "./registry";
import { builtinSourceDocumentDefinitionsPlugin } from "./builtin/source-document-definitions.plugin";
import { builtinStarterProfilesPlugin } from "./builtin/starter-profiles.plugin";
import {
  builtinStarterQidianFemaleLongformPlugin,
  builtinStarterQidianMaleLongformPlugin,
  builtinStarterSerialExperimentalPlugin,
} from "./builtin/starter-protocol-overlays.plugin";
import { builtinSourceDocumentWorkflowPlugin } from "./builtin/source-document-workflow.plugin";
import type {
  AifictionPlugin,
  AifictionPluginBundleDefinition,
  AifictionPluginManifest,
  AifictionPluginRuntimeState,
  AifictionWorkspacePluginConfig,
  ConfigureAifictionPluginsOptions,
} from "./types";

const aifictionPluginApiVersion = "1";

const builtinPlugins: AifictionPlugin[] = [
  builtinStarterProfilesPlugin,
  builtinStarterQidianMaleLongformPlugin,
  builtinStarterQidianFemaleLongformPlugin,
  builtinStarterSerialExperimentalPlugin,
  builtinSourceDocumentDefinitionsPlugin,
  builtinSourceDocumentSemanticsPlugin,
  builtinSourceDocumentWorkflowPlugin,
];

const coreDefaultPluginIds = [
  builtinStarterProfilesPlugin.manifest.pluginId,
  builtinSourceDocumentDefinitionsPlugin.manifest.pluginId,
  builtinSourceDocumentSemanticsPlugin.manifest.pluginId,
  builtinSourceDocumentWorkflowPlugin.manifest.pluginId,
];

const builtinPluginBundles: AifictionPluginBundleDefinition[] = [
  {
    bundleId: "core-default",
    displayName: "Core Default",
    description: "Loads the default builtin source-document definitions, semantics, and workflow plugins.",
    category: "system",
    pluginIds: coreDefaultPluginIds,
  },
  {
    bundleId: "safe-minimal",
    displayName: "Safe Minimal",
    description: "Loads only the source-document definition plugin for compatibility fallback.",
    category: "utility",
    pluginIds: [builtinSourceDocumentDefinitionsPlugin.manifest.pluginId],
  },
  {
    bundleId: "official-default-authoring",
    displayName: "Official Default Authoring",
    description: "Official default authoring capability bundle built on top of the core-default runtime.",
    category: "official-default",
    includesBundles: ["core-default"],
    pluginIds: [],
  },
  {
    bundleId: "starter-qidian-male-longform",
    displayName: "Starter Qidian Male Longform",
    description: "Legacy compatibility alias that loads only the Qidian male-frequency longform protocol overlay plugin.",
    category: "compatibility",
    pluginIds: [builtinStarterQidianMaleLongformPlugin.manifest.pluginId],
  },
  {
    bundleId: "starter-qidian-female-longform",
    displayName: "Starter Qidian Female Longform",
    description: "Legacy compatibility alias that loads only the Qidian female-frequency longform protocol overlay plugin.",
    category: "compatibility",
    pluginIds: [builtinStarterQidianFemaleLongformPlugin.manifest.pluginId],
  },
  {
    bundleId: "starter-serial-experimental",
    displayName: "Starter Serial Experimental",
    description: "Legacy compatibility alias that loads only the experimental serial protocol overlay plugin.",
    category: "compatibility",
    pluginIds: [builtinStarterSerialExperimentalPlugin.manifest.pluginId],
  },
  {
    bundleId: "topic-qidian-male-longform",
    displayName: "Topic Qidian Male Longform",
    description: "Official topic bundle for Qidian male-frequency longform projects.",
    category: "topic",
    includesBundles: ["official-default-authoring", "starter-qidian-male-longform"],
    conflictsWithBundles: ["topic-qidian-female-longform", "topic-serial-experimental"],
    recommendedStarterProfiles: ["qidian-male-longform"],
    pluginIds: [],
  },
  {
    bundleId: "topic-qidian-female-longform",
    displayName: "Topic Qidian Female Longform",
    description: "Official topic bundle for Qidian female-frequency longform projects.",
    category: "topic",
    includesBundles: ["official-default-authoring", "starter-qidian-female-longform"],
    conflictsWithBundles: ["topic-qidian-male-longform", "topic-serial-experimental"],
    recommendedStarterProfiles: ["qidian-female-longform"],
    pluginIds: [],
  },
  {
    bundleId: "topic-serial-experimental",
    displayName: "Topic Serial Experimental",
    description: "Official topic bundle for experimental serial validation projects.",
    category: "topic",
    includesBundles: ["official-default-authoring", "starter-serial-experimental"],
    conflictsWithBundles: ["topic-qidian-male-longform", "topic-qidian-female-longform"],
    recommendedStarterProfiles: ["serial-experimental"],
    pluginIds: [],
  },
];

let lastRuntimeState: AifictionPluginRuntimeState | null = null;
let lastRuntimeKey: string | null = null;

interface WorkspaceProtocolWithPlugins {
  plugins?: AifictionWorkspacePluginConfig;
}

function dedupeStrings(values: Array<string | undefined>): string[] {
  return Array.from(
    new Set(values.filter((value): value is string => typeof value === "string" && value.trim().length > 0).map((value) => value.trim())),
  );
}

function normalizeWorkspacePluginConfig(config: AifictionWorkspacePluginConfig | undefined): AifictionWorkspacePluginConfig {
  return {
    api_version: config?.api_version ?? aifictionPluginApiVersion,
    bundles: dedupeStrings(config?.bundles?.length ? config.bundles : ["core-default"]),
    enabled: dedupeStrings(config?.enabled ?? []),
    disabled: dedupeStrings(config?.disabled ?? []),
    strict_mode: config?.strict_mode ?? false,
  };
}

function readWorkspacePluginConfig(workspaceRoot: string): AifictionWorkspacePluginConfig | undefined {
  const workspaceFilePath = path.join(workspaceRoot, "workspace.yml");
  if (!fs.existsSync(workspaceFilePath)) {
    return undefined;
  }

  const workspace = YAML.parse(fs.readFileSync(workspaceFilePath, "utf8")) as WorkspaceProtocolWithPlugins | undefined;
  return workspace?.plugins;
}

function buildRuntimeCacheKey(state: {
  source: string;
  workspaceRoot?: string;
  bundleIds: string[];
  selectedPluginIds: string[];
  disabledPluginIds: string[];
  strictMode: boolean;
  availablePlugins: AifictionPlugin[];
}): string {
  return JSON.stringify({
    source: state.source,
    workspaceRoot: state.workspaceRoot,
    bundleIds: state.bundleIds,
    selectedPluginIds: state.selectedPluginIds,
    disabledPluginIds: state.disabledPluginIds,
    strictMode: state.strictMode,
    availablePlugins: state.availablePlugins.map((plugin) => ({
      pluginId: plugin.manifest.pluginId,
      version: plugin.manifest.version,
      apiVersion: plugin.manifest.apiVersion ?? aifictionPluginApiVersion,
    })),
  });
}

function summarizeBlockingRecords(state: AifictionPluginRuntimeState): string {
  return state.records
    .filter((record) => ["blocked", "error"].includes(record.status))
    .map((record) => `${record.pluginId}: ${record.reason ?? record.status}`)
    .join("; ");
}

function resolveBundlePluginIds(
  bundleIds: string[],
  bundleDefinitions: AifictionPluginBundleDefinition[],
): {
  bundleIds: string[];
  expandedBundleIds: string[];
  pluginIds: string[];
  unknownBundleIds: string[];
  circularBundleIds: string[];
  conflictingBundleRecords: Array<{ bundleId: string; conflictingBundleIds: string[] }>;
} {
  const bundleById = new Map(bundleDefinitions.map((bundle) => [bundle.bundleId, bundle]));
  const selectedBundles = dedupeStrings(bundleIds);
  const expandedBundleIds: string[] = [];
  const pluginIds: string[] = [];
  const unknownBundleIds: string[] = [];
  const circularBundleIds: string[] = [];
  const conflictingBundleRecords: Array<{ bundleId: string; conflictingBundleIds: string[] }> = [];
  const visitedBundleIds = new Set<string>();
  const visitingBundleIds = new Set<string>();
  const acceptedBundleIds = new Set<string>();

  const visitBundle = (bundleId: string) => {
    if (visitedBundleIds.has(bundleId)) {
      return;
    }
    if (visitingBundleIds.has(bundleId)) {
      circularBundleIds.push(bundleId);
      return;
    }

    const bundle = bundleById.get(bundleId);
    if (!bundle) {
      unknownBundleIds.push(bundleId);
      return;
    }

    const conflictingBundleIds = dedupeStrings(bundle.conflictsWithBundles ?? []).filter((conflictBundleId) =>
      acceptedBundleIds.has(conflictBundleId),
    );
    if (conflictingBundleIds.length) {
      conflictingBundleRecords.push({ bundleId, conflictingBundleIds });
      visitedBundleIds.add(bundleId);
      return;
    }

    visitingBundleIds.add(bundleId);
    acceptedBundleIds.add(bundleId);
    expandedBundleIds.push(bundleId);
    for (const includedBundleId of dedupeStrings(bundle.includesBundles ?? [])) {
      visitBundle(includedBundleId);
    }
    pluginIds.push(...bundle.pluginIds);
    visitingBundleIds.delete(bundleId);
    visitedBundleIds.add(bundleId);
  };

  for (const bundleId of selectedBundles) {
    visitBundle(bundleId);
  }

  return {
    bundleIds: selectedBundles,
    expandedBundleIds: dedupeStrings(expandedBundleIds),
    pluginIds: dedupeStrings(pluginIds),
    circularBundleIds: dedupeStrings(circularBundleIds),
    unknownBundleIds: dedupeStrings(unknownBundleIds),
    conflictingBundleRecords: conflictingBundleRecords.map((record) => ({
      bundleId: record.bundleId,
      conflictingBundleIds: dedupeStrings(record.conflictingBundleIds),
    })),
  };
}

export function listBuiltinAifictionPluginManifests(): AifictionPluginManifest[] {
  return builtinPlugins
    .map((plugin) => plugin.manifest)
    .sort((left, right) => left.displayName.localeCompare(right.displayName));
}

export function listBuiltinAifictionPluginBundles(): AifictionPluginBundleDefinition[] {
  return [...builtinPluginBundles].sort((left, right) => left.bundleId.localeCompare(right.bundleId));
}

export function resolveWorkspaceAifictionPluginConfig(workspaceRoot = resolveWorkspaceRoot()): AifictionWorkspacePluginConfig {
  return normalizeWorkspacePluginConfig(readWorkspacePluginConfig(workspaceRoot));
}

export function configureAifictionPlugins(options: ConfigureAifictionPluginsOptions = {}): AifictionPluginRuntimeState {
  const source = options.source ?? (options.workspaceRoot || !options.pluginIds ? "workspace" : "explicit");
  const workspaceRoot = options.workspaceRoot ?? (source === "workspace" ? resolveWorkspaceRoot() : undefined);
  const workspaceConfig = source === "workspace" && workspaceRoot ? resolveWorkspaceAifictionPluginConfig(workspaceRoot) : undefined;
  const bundleResolution = resolveBundlePluginIds(
    options.bundleIds ?? workspaceConfig?.bundles ?? ["core-default"],
    builtinPluginBundles,
  );
  const explicitlyEnabledPluginIds = options.pluginIds ?? workspaceConfig?.enabled ?? [];
  const disabledPluginIds = dedupeStrings(options.disabledPluginIds ?? workspaceConfig?.disabled ?? []);
  const selectedPluginIds = dedupeStrings([...bundleResolution.pluginIds, ...explicitlyEnabledPluginIds]).filter(
    (pluginId) => !disabledPluginIds.includes(pluginId),
  );
  const strictMode = options.strictMode ?? workspaceConfig?.strict_mode ?? false;
  const availablePlugins = options.availablePlugins ?? builtinPlugins;
  const runtimeKey = buildRuntimeCacheKey({
    source,
    workspaceRoot,
    bundleIds: bundleResolution.bundleIds,
    selectedPluginIds,
    disabledPluginIds,
    strictMode,
    availablePlugins,
  });

  if (!options.reset && lastRuntimeKey === runtimeKey && lastRuntimeState) {
    return lastRuntimeState;
  }

  resetAifictionPluginRegistry();
  const availablePluginsById = new Map(availablePlugins.map((plugin) => [plugin.manifest.pluginId, plugin]));
  const records: AifictionPluginRuntimeState["records"] = [];
  const loadedPluginIds = new Set<string>();

  for (const pluginId of disabledPluginIds) {
    if (availablePluginsById.has(pluginId)) {
      records.push({
        pluginId,
        displayName: availablePluginsById.get(pluginId)?.manifest.displayName,
        status: "skipped",
        reason: "disabled-by-workspace",
        capabilityKinds: availablePluginsById.get(pluginId)?.manifest.capabilityKinds,
      });
    }
  }

  for (const bundleId of bundleResolution.unknownBundleIds) {
    records.push({
      pluginId: `bundle:${bundleId}`,
      status: "blocked",
      reason: "unknown-bundle",
    });
  }

  for (const bundleId of bundleResolution.circularBundleIds) {
    records.push({
      pluginId: `bundle:${bundleId}`,
      status: "blocked",
      reason: "circular-bundle",
    });
  }

  for (const conflict of bundleResolution.conflictingBundleRecords) {
    records.push({
      pluginId: `bundle:${conflict.bundleId}`,
      status: "blocked",
      reason: `conflicts-with-bundle:${conflict.conflictingBundleIds.join(",")}`,
    });
  }

  for (const plugin of availablePlugins) {
    const pluginId = plugin.manifest.pluginId;
    if (!selectedPluginIds.includes(pluginId)) {
      continue;
    }

    const manifest = plugin.manifest;
    const runtimeApiVersion = manifest.apiVersion ?? aifictionPluginApiVersion;
    if (runtimeApiVersion !== aifictionPluginApiVersion) {
      records.push({
        pluginId,
        displayName: manifest.displayName,
        status: "blocked",
        reason: `api-version-mismatch:${runtimeApiVersion}`,
        capabilityKinds: manifest.capabilityKinds,
      });
      continue;
    }

    const missingSelectedDependencies = dedupeStrings(manifest.requiresPlugins ?? []).filter(
      (dependencyId) => !selectedPluginIds.includes(dependencyId),
    );
    if (missingSelectedDependencies.length) {
      records.push({
        pluginId,
        displayName: manifest.displayName,
        status: "blocked",
        reason: `missing-required-plugin:${missingSelectedDependencies.join(",")}`,
        capabilityKinds: manifest.capabilityKinds,
      });
      continue;
    }

    const unloadedDependencies = dedupeStrings(manifest.requiresPlugins ?? []).filter(
      (dependencyId) => !loadedPluginIds.has(dependencyId),
    );
    if (unloadedDependencies.length) {
      records.push({
        pluginId,
        displayName: manifest.displayName,
        status: "blocked",
        reason: `required-plugin-not-loaded:${unloadedDependencies.join(",")}`,
        capabilityKinds: manifest.capabilityKinds,
      });
      continue;
    }

    const conflictingPlugins = dedupeStrings(manifest.conflictsWith ?? []).filter((conflictId) => loadedPluginIds.has(conflictId));
    if (conflictingPlugins.length) {
      records.push({
        pluginId,
        displayName: manifest.displayName,
        status: "blocked",
        reason: `conflicts-with:${conflictingPlugins.join(",")}`,
        capabilityKinds: manifest.capabilityKinds,
      });
      continue;
    }

    try {
      const loaded = registerAifictionPlugin(plugin);
      if (!loaded) {
        records.push({
          pluginId,
          displayName: manifest.displayName,
          status: "skipped",
          reason: "already-registered",
          capabilityKinds: manifest.capabilityKinds,
        });
        continue;
      }

      loadedPluginIds.add(pluginId);
      records.push({
        pluginId,
        displayName: manifest.displayName,
        status: "loaded",
        capabilityKinds: manifest.capabilityKinds,
      });
    } catch (error) {
      records.push({
        pluginId,
        displayName: manifest.displayName,
        status: "error",
        reason: error instanceof Error ? error.message : "unknown-error",
        capabilityKinds: manifest.capabilityKinds,
      });
    }
  }

  for (const pluginId of selectedPluginIds) {
    if (availablePluginsById.has(pluginId)) {
      continue;
    }

    records.push({
      pluginId,
      status: "blocked",
      reason: "unknown-plugin",
    });
  }

  const state: AifictionPluginRuntimeState = {
    apiVersion: aifictionPluginApiVersion,
    source,
    workspaceRoot,
    bundleIds: bundleResolution.bundleIds,
    expandedBundleIds: bundleResolution.expandedBundleIds,
    selectedPluginIds,
    disabledPluginIds,
    strictMode,
    loadedPluginIds: [...loadedPluginIds],
    records,
    hasBlockingIssues: records.some((record) => ["blocked", "error"].includes(record.status)),
  };

  lastRuntimeKey = runtimeKey;
  lastRuntimeState = state;

  if (strictMode && state.hasBlockingIssues) {
    throw new Error(`Plugin runtime strict mode blocked startup: ${summarizeBlockingRecords(state)}`);
  }

  return state;
}

export function ensureBuiltinAifictionPluginsRegistered(): AifictionPluginRuntimeState {
  return configureAifictionPlugins({
    source: "default",
    bundleIds: ["core-default"],
  });
}

export function ensureWorkspaceAifictionPluginsRegistered(workspaceRoot = resolveWorkspaceRoot()): AifictionPluginRuntimeState {
  return configureAifictionPlugins({
    source: "workspace",
    workspaceRoot,
  });
}

export function getAifictionPluginRuntimeState(): AifictionPluginRuntimeState | null {
  return lastRuntimeState;
}
