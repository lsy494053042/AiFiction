import type { AifictionWorkspacePluginConfig } from "./plugins";

export type PluginRuntimeFixtureKey =
  | "core-default-baseline"
  | "compatibility-serial-alias"
  | "conflicting-topic-bundles"
  | "topic-female-strict"
  | "topic-male-overlay-disabled"
  | "broken-unknown-bundle";

export interface PluginRuntimeFixture {
  fixtureKey: PluginRuntimeFixtureKey;
  workspaceName: string;
  description: string;
  workspacePlugins: AifictionWorkspacePluginConfig;
}

export const pluginRuntimeFixtures: PluginRuntimeFixture[] = [
  {
    fixtureKey: "core-default-baseline",
    workspaceName: "Plugin Runtime Core Default",
    description: "Baseline core-default workspace with no topic bundle enabled.",
    workspacePlugins: {
      api_version: "1",
      bundles: ["core-default"],
      enabled: [],
      disabled: [],
      strict_mode: false,
    },
  },
  {
    fixtureKey: "compatibility-serial-alias",
    workspaceName: "Plugin Runtime Compatibility Alias",
    description: "Workspace using legacy starter alias bundle without the official topic bundle.",
    workspacePlugins: {
      api_version: "1",
      bundles: ["core-default", "starter-serial-experimental"],
      enabled: [],
      disabled: [],
      strict_mode: false,
    },
  },
  {
    fixtureKey: "conflicting-topic-bundles",
    workspaceName: "Plugin Runtime Conflicting Topics",
    description: "Workspace accidentally enabling two mutually exclusive official topic bundles.",
    workspacePlugins: {
      api_version: "1",
      bundles: ["core-default", "topic-qidian-male-longform", "topic-qidian-female-longform"],
      enabled: [],
      disabled: [],
      strict_mode: false,
    },
  },
  {
    fixtureKey: "topic-female-strict",
    workspaceName: "Plugin Runtime Topic Strict",
    description: "Workspace using official female topic bundle under strict mode.",
    workspacePlugins: {
      api_version: "1",
      bundles: ["core-default", "topic-qidian-female-longform"],
      enabled: [],
      disabled: [],
      strict_mode: true,
    },
  },
  {
    fixtureKey: "topic-male-overlay-disabled",
    workspaceName: "Plugin Runtime Overlay Disabled",
    description: "Workspace with topic bundle enabled but overlay plugin intentionally disabled.",
    workspacePlugins: {
      api_version: "1",
      bundles: ["core-default", "topic-qidian-male-longform"],
      enabled: [],
      disabled: ["builtin.starter-qidian-male-longform"],
      strict_mode: false,
    },
  },
  {
    fixtureKey: "broken-unknown-bundle",
    workspaceName: "Plugin Runtime Broken Bundle",
    description: "Workspace carrying an unknown bundle to validate blocker diagnostics.",
    workspacePlugins: {
      api_version: "1",
      bundles: ["core-default", "missing-bundle"],
      enabled: [],
      disabled: [],
      strict_mode: false,
    },
  },
];
