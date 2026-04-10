import fs from "node:fs";
import path from "node:path";

import YAML from "yaml";

import { closeSqliteClient, resolveWorkspaceRoot } from "./client";
import { buildPluginDoctorReport } from "./plugin-doctor";
import { pluginOpsFixtures, type PluginOpsCheckpointKey, type PluginOpsFixture } from "./plugin-ops-fixtures";
import { pluginOpsGoldenSnapshots, type PluginOpsGoldenSnapshot } from "./plugin-ops-golden";
import { pluginRuntimeFixtures, type PluginRuntimeFixture } from "./plugin-runtime-fixtures";
import { pluginRuntimeGoldenSnapshots, type PluginRuntimeGoldenSnapshot } from "./plugin-runtime-golden";
import { configureAifictionPlugins, resolveWorkspaceAifictionPluginConfig } from "./plugins";
import { runPluginsManagerCommand } from "./plugins-cli";
import { cleanupSmokeWorkspace, prepareAifictionSmokeWorkspace } from "./smoke-workspace";

interface WorkspaceLikeFile {
  workspace_id?: string;
  workspace_name?: string;
  root_dir?: string;
  books_dir?: string;
  plugins?: PluginRuntimeFixture["workspacePlugins"];
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function sortStrings(values: Array<string | undefined> | undefined): string[] {
  return (values ?? [])
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .sort((left, right) => left.localeCompare(right));
}

function normalizeRecordKeys(records: Array<{ pluginId: string; reason?: string; status: string }>): string[] {
  return sortStrings(records.map((record) => `${record.pluginId}:${record.reason ?? record.status}`));
}

function normalizeWorkspaceSnapshot(
  workspaceConfig: PluginRuntimeFixture["workspacePlugins"],
): PluginRuntimeGoldenSnapshot["workspace"] {
  return {
    bundles: sortStrings(workspaceConfig.bundles),
    enabled: sortStrings(workspaceConfig.enabled),
    disabled: sortStrings(workspaceConfig.disabled),
    strictMode: workspaceConfig.strict_mode ?? false,
  };
}

function normalizeRuntimeSnapshot(runtimeState: ReturnType<typeof configureAifictionPlugins>): PluginRuntimeGoldenSnapshot["runtime"] {
  return {
    bundleIds: sortStrings(runtimeState.bundleIds),
    expandedBundleIds: sortStrings(runtimeState.expandedBundleIds),
    selectedPluginIds: sortStrings(runtimeState.selectedPluginIds),
    loadedPluginIds: sortStrings(runtimeState.loadedPluginIds),
    hasBlockingIssues: runtimeState.hasBlockingIssues,
    blockingRecords: normalizeRecordKeys(runtimeState.records.filter((record) => ["blocked", "error"].includes(record.status))),
    skippedRecords: normalizeRecordKeys(runtimeState.records.filter((record) => record.status === "skipped")),
  };
}

function normalizeDoctorSnapshot(report: ReturnType<typeof buildPluginDoctorReport>): PluginRuntimeGoldenSnapshot["doctor"] {
  return {
    snapshotCount: report.snapshots.count,
    recommendations: sortStrings(report.recommendations),
  };
}

function canonicalizeGoldenSnapshot(snapshot: PluginRuntimeGoldenSnapshot): PluginRuntimeGoldenSnapshot {
  return {
    workspace: {
      ...snapshot.workspace,
      bundles: sortStrings(snapshot.workspace.bundles),
      enabled: sortStrings(snapshot.workspace.enabled),
      disabled: sortStrings(snapshot.workspace.disabled),
    },
    runtime: {
      ...snapshot.runtime,
      bundleIds: sortStrings(snapshot.runtime.bundleIds),
      expandedBundleIds: sortStrings(snapshot.runtime.expandedBundleIds),
      selectedPluginIds: sortStrings(snapshot.runtime.selectedPluginIds),
      loadedPluginIds: sortStrings(snapshot.runtime.loadedPluginIds),
      blockingRecords: sortStrings(snapshot.runtime.blockingRecords),
      skippedRecords: sortStrings(snapshot.runtime.skippedRecords),
    },
    doctor: {
      ...snapshot.doctor,
      recommendations: sortStrings(snapshot.doctor.recommendations),
    },
  };
}

function assertGoldenSnapshot(
  fixtureKey: PluginRuntimeFixture["fixtureKey"],
  actual: PluginRuntimeGoldenSnapshot,
) {
  const expected = canonicalizeGoldenSnapshot(pluginRuntimeGoldenSnapshots[fixtureKey]);
  const actualNormalized = canonicalizeGoldenSnapshot(actual);
  const actualSerialized = JSON.stringify(actualNormalized, null, 2);
  const expectedSerialized = JSON.stringify(expected, null, 2);

  assert(
    actualSerialized === expectedSerialized,
    `[${fixtureKey}] plugin runtime golden snapshot drifted.\nExpected:\n${expectedSerialized}\nActual:\n${actualSerialized}`,
  );
}

function normalizeOpsSnapshot(workspaceConfig: PluginRuntimeFixture["workspacePlugins"], report: ReturnType<typeof buildPluginDoctorReport>): PluginOpsGoldenSnapshot {
  return {
    workspace: {
      bundles: sortStrings(workspaceConfig.bundles),
      enabled: sortStrings(workspaceConfig.enabled),
      disabled: sortStrings(workspaceConfig.disabled),
      strictMode: workspaceConfig.strict_mode ?? false,
    },
    runtime: {
      loadedPluginIds: sortStrings(report.runtime.loadedPluginIds),
      hasBlockingIssues: report.runtime.hasBlockingIssues,
      blockingRecords: normalizeRecordKeys(report.runtime.blockingRecords),
      skippedRecords: normalizeRecordKeys(report.runtime.skippedRecords),
    },
    doctor: {
      snapshotCount: report.snapshots.count,
      recommendations: sortStrings(report.recommendations),
    },
  };
}

function canonicalizeOpsSnapshot(snapshot: PluginOpsGoldenSnapshot): PluginOpsGoldenSnapshot {
  return {
    workspace: {
      ...snapshot.workspace,
      bundles: sortStrings(snapshot.workspace.bundles),
      enabled: sortStrings(snapshot.workspace.enabled),
      disabled: sortStrings(snapshot.workspace.disabled),
    },
    runtime: {
      ...snapshot.runtime,
      loadedPluginIds: sortStrings(snapshot.runtime.loadedPluginIds),
      blockingRecords: sortStrings(snapshot.runtime.blockingRecords),
      skippedRecords: sortStrings(snapshot.runtime.skippedRecords),
    },
    doctor: {
      ...snapshot.doctor,
      recommendations: sortStrings(snapshot.doctor.recommendations),
    },
  };
}

function assertOpsGoldenSnapshot(
  fixtureKey: PluginOpsFixture["fixtureKey"],
  checkpointKey: PluginOpsCheckpointKey,
  actual: PluginOpsGoldenSnapshot,
) {
  const expected = pluginOpsGoldenSnapshots[fixtureKey][checkpointKey];
  assert(expected, `[${fixtureKey}] missing plugin ops golden snapshot for checkpoint ${checkpointKey}.`);
  const expectedNormalized = canonicalizeOpsSnapshot(expected);
  const actualNormalized = canonicalizeOpsSnapshot(actual);
  const actualSerialized = JSON.stringify(actualNormalized, null, 2);
  const expectedSerialized = JSON.stringify(expectedNormalized, null, 2);

  assert(
    actualSerialized === expectedSerialized,
    `[${fixtureKey}/${checkpointKey}] plugin ops golden snapshot drifted.\nExpected:\n${expectedSerialized}\nActual:\n${actualSerialized}`,
  );
}

async function runFixture(matrixRoot: string, fixture: PluginRuntimeFixture) {
  const repositoryWorkspaceRoot = resolveWorkspaceRoot();
  const workspaceRoot = path.join(matrixRoot, fixture.fixtureKey);
  const workspaceFilePath = path.join(workspaceRoot, "workspace.yml");

  prepareAifictionSmokeWorkspace({
    smokeRoot: workspaceRoot,
    repositoryWorkspaceRoot,
    includeDrizzle: false,
  });
  fs.writeFileSync(
    workspaceFilePath,
    YAML.stringify({
      workspace_id: `plugin-runtime-${fixture.fixtureKey}`,
      workspace_name: fixture.workspaceName,
      root_dir: ".",
      books_dir: "books",
      plugins: fixture.workspacePlugins,
    } satisfies WorkspaceLikeFile),
    "utf8",
  );

  const workspaceConfig = resolveWorkspaceAifictionPluginConfig(workspaceRoot);
  const runtimeState = configureAifictionPlugins({
    source: "workspace",
    workspaceRoot,
    reset: true,
  });
  const doctorReport = buildPluginDoctorReport(workspaceRoot, workspaceConfig);
  const actualGoldenSnapshot: PluginRuntimeGoldenSnapshot = {
    workspace: normalizeWorkspaceSnapshot(workspaceConfig),
    runtime: normalizeRuntimeSnapshot(runtimeState),
    doctor: normalizeDoctorSnapshot(doctorReport),
  };

  assertGoldenSnapshot(fixture.fixtureKey, actualGoldenSnapshot);

  console.log(
    `[AiFiction Plugin Runtime Matrix] ${fixture.fixtureKey}: bundles=${actualGoldenSnapshot.workspace.bundles.join(
      ",",
    )} / loaded=${actualGoldenSnapshot.runtime.loadedPluginIds.length} / blocked=${
      actualGoldenSnapshot.runtime.blockingRecords.length
    } / golden=ok`,
  );
}

function resolveActionCommand(command: string[], snapshotIds: Record<string, string>): string[] {
  return command.map((segment) => {
    const match = /^\{\{snapshot:(.+)\}\}$/.exec(segment);
    if (!match) {
      return segment;
    }

    const snapshotId = snapshotIds[match[1]];
    assert(snapshotId, `Missing snapshot reference: ${segment}`);
    return snapshotId;
  });
}

async function runOpsFixture(matrixRoot: string, fixture: PluginOpsFixture) {
  const repositoryWorkspaceRoot = resolveWorkspaceRoot();
  const workspaceRoot = path.join(matrixRoot, fixture.fixtureKey);
  const workspaceFilePath = path.join(workspaceRoot, "workspace.yml");
  const snapshotIds: Record<string, string> = {};

  prepareAifictionSmokeWorkspace({
    smokeRoot: workspaceRoot,
    repositoryWorkspaceRoot,
    includeDrizzle: false,
  });
  fs.writeFileSync(
    workspaceFilePath,
    YAML.stringify({
      workspace_id: `plugin-ops-${fixture.fixtureKey}`,
      workspace_name: fixture.workspaceName,
      root_dir: ".",
      books_dir: "books",
      plugins: fixture.initialPlugins,
    } satisfies WorkspaceLikeFile),
    "utf8",
  );

  for (const action of fixture.actions) {
    const resolvedCommand = resolveActionCommand(action.command, snapshotIds);
    await runPluginsManagerCommand([...resolvedCommand, "--workspace-root", workspaceRoot]);

    if (action.command[0] === "snapshot") {
      const doctorReport = buildPluginDoctorReport(workspaceRoot);
      const latestSnapshotId = doctorReport.snapshots.latest?.snapshotId;
      assert(latestSnapshotId, `[${fixture.fixtureKey}] snapshot action must produce a snapshot id.`);
      snapshotIds[action.label] = latestSnapshotId;
    }

    if (!action.checkpointKey) {
      continue;
    }

    const workspaceConfig = resolveWorkspaceAifictionPluginConfig(workspaceRoot);
    const doctorReport = buildPluginDoctorReport(workspaceRoot, workspaceConfig);
    const actualSnapshot = normalizeOpsSnapshot(workspaceConfig, doctorReport);
    assertOpsGoldenSnapshot(fixture.fixtureKey, action.checkpointKey, actualSnapshot);

    console.log(
      `[AiFiction Plugin Ops Matrix] ${fixture.fixtureKey}/${action.checkpointKey}: bundles=${actualSnapshot.workspace.bundles.join(
        ",",
      )} / strict=${actualSnapshot.workspace.strictMode} / blocked=${
        actualSnapshot.runtime.blockingRecords.length
      } / snapshots=${actualSnapshot.doctor.snapshotCount} / golden=ok`,
    );
  }
}

async function main() {
  const repositoryWorkspaceRoot = resolveWorkspaceRoot();
  const matrixRoot = path.join(
    repositoryWorkspaceRoot,
    "storage",
    "smoke",
    "plugin-runtime-matrix",
    `run-${Date.now()}`,
  );

  try {
    for (const fixture of pluginRuntimeFixtures) {
      await runFixture(matrixRoot, fixture);
    }
    for (const fixture of pluginOpsFixtures) {
      await runOpsFixture(matrixRoot, fixture);
    }
  } finally {
    await closeSqliteClient();
    await cleanupSmokeWorkspace(matrixRoot, {
      initialDelayMs: 250,
      maxAttempts: 25,
      retryDelayMs: 150,
    });
  }
}

main()
  .catch((error) => {
    console.error("[AiFiction Plugin Runtime Matrix] Error:", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeSqliteClient();
  });
