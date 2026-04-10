import { listPluginConfigSnapshots } from "./plugin-config-history";
import { formatCompatibilityBundleAdvice } from "./plugin-bundle-compat";
import { configureAifictionPlugins, resolveWorkspaceAifictionPluginConfig } from "./plugins";
import type { AifictionPluginRuntimeState, AifictionWorkspacePluginConfig } from "./plugins";

export interface PluginDoctorReport {
  workspaceRoot: string;
  workspaceConfig: AifictionWorkspacePluginConfig;
  runtime: {
    bundleIds: string[];
    expandedBundleIds: string[];
    loadedPluginIds: string[];
    hasBlockingIssues: boolean;
    blockingRecords: AifictionPluginRuntimeState["records"];
    skippedRecords: AifictionPluginRuntimeState["records"];
  };
  snapshots: {
    count: number;
    latest?: {
      snapshotId: string;
      createdAt: string;
      label?: string;
    };
  };
  recommendations: string[];
}

export function inspectPluginRuntime(
  workspaceRoot: string,
  config = resolveWorkspaceAifictionPluginConfig(workspaceRoot),
): AifictionPluginRuntimeState {
  return configureAifictionPlugins({
    source: "explicit",
    workspaceRoot,
    bundleIds: config.bundles ?? ["core-default"],
    pluginIds: config.enabled ?? [],
    disabledPluginIds: config.disabled ?? [],
    strictMode: false,
    reset: true,
  });
}

export function compatibilityBundleAdvice(config: AifictionWorkspacePluginConfig | undefined): string[] {
  return formatCompatibilityBundleAdvice(config?.bundles ?? []);
}

export function buildPluginDoctorReport(
  workspaceRoot: string,
  config = resolveWorkspaceAifictionPluginConfig(workspaceRoot),
): PluginDoctorReport {
  const runtimeState = inspectPluginRuntime(workspaceRoot, config);
  const snapshots = listPluginConfigSnapshots(workspaceRoot);
  const compatibilityAdvice = compatibilityBundleAdvice(config);
  const blockingRecords = runtimeState.records.filter((record) => ["blocked", "error"].includes(record.status));
  const skippedRecords = runtimeState.records.filter((record) => record.status === "skipped");
  const recommendations: string[] = [];

  if (!snapshots.length) {
    recommendations.push("Create a baseline snapshot with: plugins:manage snapshot baseline");
  }
  if (compatibilityAdvice.length) {
    recommendations.push(...compatibilityAdvice);
  }
  for (const record of blockingRecords) {
    if (!record.pluginId.startsWith("bundle:") || !record.reason?.startsWith("conflicts-with-bundle:")) {
      continue;
    }
    const bundleId = record.pluginId.slice("bundle:".length);
    const conflictingBundleIds = record.reason.slice("conflicts-with-bundle:".length);
    recommendations.push(
      `bundle ${bundleId} conflicts with ${conflictingBundleIds}; keep only one topic bundle or rollback the workspace plugin config.`,
    );
  }
  if (runtimeState.hasBlockingIssues) {
    recommendations.push("Resolve blocked/error plugin records before enabling strict mode.");
  }
  if (!config.strict_mode && !runtimeState.hasBlockingIssues) {
    recommendations.push("Consider enabling strict mode after the workspace plugin set is stable.");
  }

  return {
    workspaceRoot,
    workspaceConfig: config,
    runtime: {
      bundleIds: runtimeState.bundleIds,
      expandedBundleIds: runtimeState.expandedBundleIds,
      loadedPluginIds: runtimeState.loadedPluginIds,
      hasBlockingIssues: runtimeState.hasBlockingIssues,
      blockingRecords,
      skippedRecords,
    },
    snapshots: {
      count: snapshots.length,
      latest: snapshots[0]
        ? {
            snapshotId: snapshots[0].snapshotId,
            createdAt: snapshots[0].createdAt,
            label: snapshots[0].label,
          }
        : undefined,
    },
    recommendations,
  };
}
