import type { AifictionWorkspacePluginConfig } from "./plugins";

export type PluginOpsFixtureKey =
  | "compatibility-normalize-rollback"
  | "conflicting-topic-rollback"
  | "unknown-bundle-rollback"
  | "strict-toggle-roundtrip";

export type PluginOpsCheckpointKey =
  | "after-normalize"
  | "after-conflicting-upgrade"
  | "after-rollback"
  | "after-invalid-upgrade"
  | "after-strict-on"
  | "after-strict-off";

export interface PluginOpsFixtureAction {
  label: string;
  command: string[];
  checkpointKey?: PluginOpsCheckpointKey;
}

export interface PluginOpsFixture {
  fixtureKey: PluginOpsFixtureKey;
  workspaceName: string;
  description: string;
  initialPlugins: AifictionWorkspacePluginConfig;
  actions: PluginOpsFixtureAction[];
}

export const pluginOpsFixtures: PluginOpsFixture[] = [
  {
    fixtureKey: "compatibility-normalize-rollback",
    workspaceName: "Plugin Ops Compatibility Normalize",
    description: "Normalize legacy compatibility bundles into official topic bundles, then roll back.",
    initialPlugins: {
      api_version: "1",
      bundles: ["core-default", "starter-serial-experimental"],
      enabled: [],
      disabled: [],
      strict_mode: false,
    },
    actions: [
      {
        label: "baseline",
        command: ["snapshot", "baseline"],
      },
      {
        label: "normalize",
        command: ["normalize-bundles"],
        checkpointKey: "after-normalize",
      },
      {
        label: "rollback",
        command: ["rollback", "{{snapshot:baseline}}"],
        checkpointKey: "after-rollback",
      },
    ],
  },
  {
    fixtureKey: "conflicting-topic-rollback",
    workspaceName: "Plugin Ops Conflicting Topic Rollback",
    description: "Introduce a conflicting topic bundle, observe the blocker state, then roll back.",
    initialPlugins: {
      api_version: "1",
      bundles: ["core-default", "topic-qidian-male-longform"],
      enabled: [],
      disabled: [],
      strict_mode: false,
    },
    actions: [
      {
        label: "baseline",
        command: ["snapshot", "baseline"],
      },
      {
        label: "add-conflicting-topic",
        command: ["add-bundle", "topic-qidian-female-longform"],
        checkpointKey: "after-conflicting-upgrade",
      },
      {
        label: "rollback",
        command: ["rollback", "{{snapshot:baseline}}"],
        checkpointKey: "after-rollback",
      },
    ],
  },
  {
    fixtureKey: "unknown-bundle-rollback",
    workspaceName: "Plugin Ops Unknown Bundle",
    description: "Add an invalid bundle, inspect the blocker state, then roll back to baseline.",
    initialPlugins: {
      api_version: "1",
      bundles: ["core-default"],
      enabled: [],
      disabled: [],
      strict_mode: false,
    },
    actions: [
      {
        label: "baseline",
        command: ["snapshot", "baseline"],
      },
      {
        label: "add-missing-bundle",
        command: ["add-bundle", "missing-bundle"],
        checkpointKey: "after-invalid-upgrade",
      },
      {
        label: "rollback",
        command: ["rollback", "{{snapshot:baseline}}"],
        checkpointKey: "after-rollback",
      },
    ],
  },
  {
    fixtureKey: "strict-toggle-roundtrip",
    workspaceName: "Plugin Ops Strict Toggle",
    description: "Turn strict mode on and off around a healthy topic bundle workspace.",
    initialPlugins: {
      api_version: "1",
      bundles: ["core-default", "topic-qidian-female-longform"],
      enabled: [],
      disabled: [],
      strict_mode: false,
    },
    actions: [
      {
        label: "baseline",
        command: ["snapshot", "baseline"],
      },
      {
        label: "strict-on",
        command: ["set-strict", "--strict"],
        checkpointKey: "after-strict-on",
      },
      {
        label: "strict-off",
        command: ["set-strict", "--no-strict"],
        checkpointKey: "after-strict-off",
      },
    ],
  },
];
