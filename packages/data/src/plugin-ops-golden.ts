import type { PluginOpsCheckpointKey, PluginOpsFixtureKey } from "./plugin-ops-fixtures";

export interface PluginOpsGoldenSnapshot {
  workspace: {
    bundles: string[];
    enabled: string[];
    disabled: string[];
    strictMode: boolean;
  };
  runtime: {
    loadedPluginIds: string[];
    hasBlockingIssues: boolean;
    blockingRecords: string[];
    skippedRecords: string[];
  };
  doctor: {
    snapshotCount: number;
    recommendations: string[];
  };
}

export const pluginOpsGoldenSnapshots: Record<
  PluginOpsFixtureKey,
  Partial<Record<PluginOpsCheckpointKey, PluginOpsGoldenSnapshot>>
> = {
  "compatibility-normalize-rollback": {
    "after-normalize": {
      workspace: {
        bundles: ["core-default", "topic-serial-experimental"],
        enabled: [],
        disabled: [],
        strictMode: false,
      },
      runtime: {
        loadedPluginIds: [
          "builtin.source-document-definitions",
          "builtin.source-document-semantics",
          "builtin.source-document-workflow",
          "builtin.starter-profiles",
          "builtin.starter-serial-experimental",
        ],
        hasBlockingIssues: false,
        blockingRecords: [],
        skippedRecords: [],
      },
      doctor: {
        snapshotCount: 3,
        recommendations: ["Consider enabling strict mode after the workspace plugin set is stable."],
      },
    },
    "after-rollback": {
      workspace: {
        bundles: ["core-default", "starter-serial-experimental"],
        enabled: [],
        disabled: [],
        strictMode: false,
      },
      runtime: {
        loadedPluginIds: [
          "builtin.source-document-definitions",
          "builtin.source-document-semantics",
          "builtin.source-document-workflow",
          "builtin.starter-profiles",
          "builtin.starter-serial-experimental",
        ],
        hasBlockingIssues: false,
        blockingRecords: [],
        skippedRecords: [],
      },
      doctor: {
        snapshotCount: 5,
        recommendations: [
          "bundle starter-serial-experimental is compatibility-only; prefer topic-serial-experimental or run: plugins:manage normalize-bundles.",
          "Consider enabling strict mode after the workspace plugin set is stable.",
        ],
      },
    },
  },
  "conflicting-topic-rollback": {
    "after-conflicting-upgrade": {
      workspace: {
        bundles: ["core-default", "topic-qidian-female-longform", "topic-qidian-male-longform"],
        enabled: [],
        disabled: [],
        strictMode: false,
      },
      runtime: {
        loadedPluginIds: [
          "builtin.source-document-definitions",
          "builtin.source-document-semantics",
          "builtin.source-document-workflow",
          "builtin.starter-profiles",
          "builtin.starter-qidian-male-longform",
        ],
        hasBlockingIssues: true,
        blockingRecords: ["bundle:topic-qidian-female-longform:conflicts-with-bundle:topic-qidian-male-longform"],
        skippedRecords: [],
      },
      doctor: {
        snapshotCount: 3,
        recommendations: [
          "Resolve blocked/error plugin records before enabling strict mode.",
          "bundle topic-qidian-female-longform conflicts with topic-qidian-male-longform; keep only one topic bundle or rollback the workspace plugin config.",
        ],
      },
    },
    "after-rollback": {
      workspace: {
        bundles: ["core-default", "topic-qidian-male-longform"],
        enabled: [],
        disabled: [],
        strictMode: false,
      },
      runtime: {
        loadedPluginIds: [
          "builtin.source-document-definitions",
          "builtin.source-document-semantics",
          "builtin.source-document-workflow",
          "builtin.starter-profiles",
          "builtin.starter-qidian-male-longform",
        ],
        hasBlockingIssues: false,
        blockingRecords: [],
        skippedRecords: [],
      },
      doctor: {
        snapshotCount: 5,
        recommendations: ["Consider enabling strict mode after the workspace plugin set is stable."],
      },
    },
  },
  "unknown-bundle-rollback": {
    "after-invalid-upgrade": {
      workspace: {
        bundles: ["core-default", "missing-bundle"],
        enabled: [],
        disabled: [],
        strictMode: false,
      },
      runtime: {
        loadedPluginIds: [
          "builtin.source-document-definitions",
          "builtin.source-document-semantics",
          "builtin.source-document-workflow",
          "builtin.starter-profiles",
        ],
        hasBlockingIssues: true,
        blockingRecords: ["bundle:missing-bundle:unknown-bundle"],
        skippedRecords: [],
      },
      doctor: {
        snapshotCount: 3,
        recommendations: ["Resolve blocked/error plugin records before enabling strict mode."],
      },
    },
    "after-rollback": {
      workspace: {
        bundles: ["core-default"],
        enabled: [],
        disabled: [],
        strictMode: false,
      },
      runtime: {
        loadedPluginIds: [
          "builtin.source-document-definitions",
          "builtin.source-document-semantics",
          "builtin.source-document-workflow",
          "builtin.starter-profiles",
        ],
        hasBlockingIssues: false,
        blockingRecords: [],
        skippedRecords: [],
      },
      doctor: {
        snapshotCount: 5,
        recommendations: ["Consider enabling strict mode after the workspace plugin set is stable."],
      },
    },
  },
  "strict-toggle-roundtrip": {
    "after-strict-on": {
      workspace: {
        bundles: ["core-default", "topic-qidian-female-longform"],
        enabled: [],
        disabled: [],
        strictMode: true,
      },
      runtime: {
        loadedPluginIds: [
          "builtin.source-document-definitions",
          "builtin.source-document-semantics",
          "builtin.source-document-workflow",
          "builtin.starter-profiles",
          "builtin.starter-qidian-female-longform",
        ],
        hasBlockingIssues: false,
        blockingRecords: [],
        skippedRecords: [],
      },
      doctor: {
        snapshotCount: 3,
        recommendations: [],
      },
    },
    "after-strict-off": {
      workspace: {
        bundles: ["core-default", "topic-qidian-female-longform"],
        enabled: [],
        disabled: [],
        strictMode: false,
      },
      runtime: {
        loadedPluginIds: [
          "builtin.source-document-definitions",
          "builtin.source-document-semantics",
          "builtin.source-document-workflow",
          "builtin.starter-profiles",
          "builtin.starter-qidian-female-longform",
        ],
        hasBlockingIssues: false,
        blockingRecords: [],
        skippedRecords: [],
      },
      doctor: {
        snapshotCount: 5,
        recommendations: ["Consider enabling strict mode after the workspace plugin set is stable."],
      },
    },
  },
};
