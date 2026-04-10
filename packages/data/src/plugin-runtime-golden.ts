import type { PluginRuntimeFixtureKey } from "./plugin-runtime-fixtures";

export interface PluginRuntimeGoldenSnapshot {
  workspace: {
    bundles: string[];
    enabled: string[];
    disabled: string[];
    strictMode: boolean;
  };
  runtime: {
    bundleIds: string[];
    expandedBundleIds: string[];
    selectedPluginIds: string[];
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

export const pluginRuntimeGoldenSnapshots: Record<PluginRuntimeFixtureKey, PluginRuntimeGoldenSnapshot> = {
  "core-default-baseline": {
    workspace: {
      bundles: ["core-default"],
      enabled: [],
      disabled: [],
      strictMode: false,
    },
    runtime: {
      bundleIds: ["core-default"],
      expandedBundleIds: ["core-default"],
      selectedPluginIds: [
        "builtin.source-document-definitions",
        "builtin.source-document-semantics",
        "builtin.source-document-workflow",
        "builtin.starter-profiles",
      ],
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
      snapshotCount: 0,
      recommendations: [
        "Consider enabling strict mode after the workspace plugin set is stable.",
        "Create a baseline snapshot with: plugins:manage snapshot baseline",
      ],
    },
  },
  "compatibility-serial-alias": {
    workspace: {
      bundles: ["core-default", "starter-serial-experimental"],
      enabled: [],
      disabled: [],
      strictMode: false,
    },
    runtime: {
      bundleIds: ["core-default", "starter-serial-experimental"],
      expandedBundleIds: ["core-default", "starter-serial-experimental"],
      selectedPluginIds: [
        "builtin.source-document-definitions",
        "builtin.source-document-semantics",
        "builtin.source-document-workflow",
        "builtin.starter-profiles",
        "builtin.starter-serial-experimental",
      ],
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
      snapshotCount: 0,
      recommendations: [
        "Consider enabling strict mode after the workspace plugin set is stable.",
        "Create a baseline snapshot with: plugins:manage snapshot baseline",
        "bundle starter-serial-experimental is compatibility-only; prefer topic-serial-experimental or run: plugins:manage normalize-bundles.",
      ],
    },
  },
  "conflicting-topic-bundles": {
    workspace: {
      bundles: ["core-default", "topic-qidian-female-longform", "topic-qidian-male-longform"],
      enabled: [],
      disabled: [],
      strictMode: false,
    },
    runtime: {
      bundleIds: ["core-default", "topic-qidian-female-longform", "topic-qidian-male-longform"],
      expandedBundleIds: [
        "core-default",
        "official-default-authoring",
        "starter-qidian-male-longform",
        "topic-qidian-male-longform",
      ],
      selectedPluginIds: [
        "builtin.source-document-definitions",
        "builtin.source-document-semantics",
        "builtin.source-document-workflow",
        "builtin.starter-profiles",
        "builtin.starter-qidian-male-longform",
      ],
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
      snapshotCount: 0,
      recommendations: [
        "Create a baseline snapshot with: plugins:manage snapshot baseline",
        "Resolve blocked/error plugin records before enabling strict mode.",
        "bundle topic-qidian-female-longform conflicts with topic-qidian-male-longform; keep only one topic bundle or rollback the workspace plugin config.",
      ],
    },
  },
  "topic-female-strict": {
    workspace: {
      bundles: ["core-default", "topic-qidian-female-longform"],
      enabled: [],
      disabled: [],
      strictMode: true,
    },
    runtime: {
      bundleIds: ["core-default", "topic-qidian-female-longform"],
      expandedBundleIds: [
        "core-default",
        "official-default-authoring",
        "starter-qidian-female-longform",
        "topic-qidian-female-longform",
      ],
      selectedPluginIds: [
        "builtin.source-document-definitions",
        "builtin.source-document-semantics",
        "builtin.source-document-workflow",
        "builtin.starter-profiles",
        "builtin.starter-qidian-female-longform",
      ],
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
      snapshotCount: 0,
      recommendations: ["Create a baseline snapshot with: plugins:manage snapshot baseline"],
    },
  },
  "topic-male-overlay-disabled": {
    workspace: {
      bundles: ["core-default", "topic-qidian-male-longform"],
      enabled: [],
      disabled: ["builtin.starter-qidian-male-longform"],
      strictMode: false,
    },
    runtime: {
      bundleIds: ["core-default", "topic-qidian-male-longform"],
      expandedBundleIds: [
        "core-default",
        "official-default-authoring",
        "starter-qidian-male-longform",
        "topic-qidian-male-longform",
      ],
      selectedPluginIds: [
        "builtin.source-document-definitions",
        "builtin.source-document-semantics",
        "builtin.source-document-workflow",
        "builtin.starter-profiles",
      ],
      loadedPluginIds: [
        "builtin.source-document-definitions",
        "builtin.source-document-semantics",
        "builtin.source-document-workflow",
        "builtin.starter-profiles",
      ],
      hasBlockingIssues: false,
      blockingRecords: [],
      skippedRecords: ["builtin.starter-qidian-male-longform:disabled-by-workspace"],
    },
    doctor: {
      snapshotCount: 0,
      recommendations: [
        "Consider enabling strict mode after the workspace plugin set is stable.",
        "Create a baseline snapshot with: plugins:manage snapshot baseline",
      ],
    },
  },
  "broken-unknown-bundle": {
    workspace: {
      bundles: ["core-default", "missing-bundle"],
      enabled: [],
      disabled: [],
      strictMode: false,
    },
    runtime: {
      bundleIds: ["core-default", "missing-bundle"],
      expandedBundleIds: ["core-default"],
      selectedPluginIds: [
        "builtin.source-document-definitions",
        "builtin.source-document-semantics",
        "builtin.source-document-workflow",
        "builtin.starter-profiles",
      ],
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
      snapshotCount: 0,
      recommendations: [
        "Create a baseline snapshot with: plugins:manage snapshot baseline",
        "Resolve blocked/error plugin records before enabling strict mode.",
      ],
    },
  },
};
