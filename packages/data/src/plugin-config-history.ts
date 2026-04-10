import fs from "node:fs";
import path from "node:path";

import type { AifictionPluginLoadRecord, AifictionPluginRuntimeState, AifictionWorkspacePluginConfig } from "./plugins";

export interface PluginConfigSnapshotRecord {
  snapshotId: string;
  createdAt: string;
  workspaceRoot: string;
  source: string;
  label?: string;
  workspaceConfig: AifictionWorkspacePluginConfig;
  runtimeState?: {
    bundleIds: string[];
    expandedBundleIds: string[];
    loadedPluginIds: string[];
    hasBlockingIssues: boolean;
    records: AifictionPluginLoadRecord[];
  };
}

function sanitizeSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "snapshot";
}

function snapshotFileName(record: Pick<PluginConfigSnapshotRecord, "snapshotId" | "label">): string {
  return record.label
    ? `${record.snapshotId}-${sanitizeSegment(record.label)}.json`
    : `${record.snapshotId}.json`;
}

export function getPluginConfigHistoryDir(workspaceRoot: string): string {
  return path.join(workspaceRoot, "storage", "plugin-config-history");
}

export function createPluginConfigSnapshotId(now = new Date()): string {
  const timestamp = now.toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const nonce = Math.random().toString(36).slice(2, 8);
  return `${timestamp}-${nonce}`;
}

function normalizeRuntimeState(runtimeState: AifictionPluginRuntimeState | undefined) {
  if (!runtimeState) {
    return undefined;
  }

  return {
    bundleIds: runtimeState.bundleIds,
    expandedBundleIds: runtimeState.expandedBundleIds,
    loadedPluginIds: runtimeState.loadedPluginIds,
    hasBlockingIssues: runtimeState.hasBlockingIssues,
    records: runtimeState.records,
  };
}

export function savePluginConfigSnapshot(input: {
  workspaceRoot: string;
  source: string;
  label?: string;
  workspaceConfig: AifictionWorkspacePluginConfig;
  runtimeState?: AifictionPluginRuntimeState;
}): PluginConfigSnapshotRecord {
  const record: PluginConfigSnapshotRecord = {
    snapshotId: createPluginConfigSnapshotId(),
    createdAt: new Date().toISOString(),
    workspaceRoot: path.resolve(input.workspaceRoot),
    source: input.source,
    label: input.label,
    workspaceConfig: input.workspaceConfig,
    runtimeState: normalizeRuntimeState(input.runtimeState),
  };

  const historyDir = getPluginConfigHistoryDir(record.workspaceRoot);
  fs.mkdirSync(historyDir, { recursive: true });
  fs.writeFileSync(
    path.join(historyDir, snapshotFileName(record)),
    JSON.stringify(record, null, 2),
    "utf8",
  );
  return record;
}

export function listPluginConfigSnapshots(workspaceRoot: string): PluginConfigSnapshotRecord[] {
  const historyDir = getPluginConfigHistoryDir(path.resolve(workspaceRoot));
  if (!fs.existsSync(historyDir)) {
    return [];
  }

  return fs
    .readdirSync(historyDir)
    .filter((entry) => entry.endsWith(".json"))
    .map((entry) =>
      JSON.parse(fs.readFileSync(path.join(historyDir, entry), "utf8")) as PluginConfigSnapshotRecord,
    )
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function getPluginConfigSnapshot(
  workspaceRoot: string,
  snapshotId: string,
): PluginConfigSnapshotRecord | undefined {
  return listPluginConfigSnapshots(workspaceRoot).find((record) => record.snapshotId === snapshotId);
}
