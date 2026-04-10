import fs from "node:fs";
import path from "node:path";

import YAML from "yaml";

import { closeSqliteClient, resolveWorkspaceRoot } from "./client";
import { configureAifictionPlugins } from "./plugins";
import { runInitWorkspaceCommand } from "./init-workspace";
import { cleanupSmokeWorkspace, prepareAifictionSmokeWorkspace } from "./smoke-workspace";

interface WorkspaceLikeFile {
  workspace_name?: string;
  book_index?: unknown[];
  plugins?: { bundles?: string[] };
  book_starters?: { default_profile_key?: string };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const repositoryWorkspaceRoot = resolveWorkspaceRoot();
  const smokeRoot = path.join(
    repositoryWorkspaceRoot,
    "storage",
    "smoke",
    "workspace-init",
    `run-${Date.now()}`,
  );
  const previousWorkspaceRoot = process.env.AIFICTION_WORKSPACE_ROOT;

  prepareAifictionSmokeWorkspace({
    smokeRoot,
    repositoryWorkspaceRoot,
    packageName: "aifiction-workspace-init-smoke",
    includeDrizzle: false,
  });

  process.env.AIFICTION_WORKSPACE_ROOT = smokeRoot;

  try {
    await runInitWorkspaceCommand([
      "init",
      "--workspace-name",
      "Workspace Init Smoke",
      "--profile",
      "serial-experimental",
    ]);

    const workspaceFilePath = path.join(smokeRoot, "workspace.yml");
    assert(fs.existsSync(workspaceFilePath), "workspace:init smoke must create workspace.yml.");

    let workspace = YAML.parse(fs.readFileSync(workspaceFilePath, "utf8")) as WorkspaceLikeFile | undefined;
    assert(workspace?.workspace_name === "Workspace Init Smoke", "workspace:init smoke must persist workspace_name.");
    assert(
      workspace?.book_starters?.default_profile_key === "serial-experimental",
      "workspace:init smoke must persist default starter profile.",
    );
    assert(
      workspace?.plugins?.bundles?.includes("core-default"),
      "workspace:init smoke must always keep core-default in workspace bundles.",
    );
    assert(
      workspace?.plugins?.bundles?.includes("topic-serial-experimental"),
      "workspace:init smoke must materialize the official topic bundle for the selected starter profile.",
    );
    assert(
      workspace?.book_starters &&
        "profiles" in workspace.book_starters &&
        Array.isArray((workspace.book_starters as { profiles?: Array<{ profile_key?: string; plugin_bundles?: string[] }> }).profiles) &&
        (workspace.book_starters as { profiles?: Array<{ profile_key?: string; plugin_bundles?: string[] }> }).profiles?.some(
          (profile) =>
            profile.profile_key === "serial-experimental" && profile.plugin_bundles?.includes("topic-serial-experimental"),
        ),
      "workspace:init smoke must persist merged starter profile definitions back into workspace.yml.",
    );
    assert((workspace?.book_index?.length ?? 0) === 0, "workspace:init smoke must not create book records.");

    await runInitWorkspaceCommand([
      "init",
      "--profile",
      "qidian-female-longform",
      "--bundle",
      "starter-qidian-female-longform",
    ]);

    workspace = YAML.parse(fs.readFileSync(workspaceFilePath, "utf8")) as WorkspaceLikeFile | undefined;
    assert(
      workspace?.book_starters?.default_profile_key === "qidian-female-longform",
      "workspace:init smoke must allow updating the default starter profile.",
    );
    assert(
      workspace?.plugins?.bundles?.includes("starter-qidian-female-longform"),
      "workspace:init smoke must preserve explicitly requested bundles.",
    );
    assert(
      workspace?.plugins?.bundles?.includes("topic-serial-experimental"),
      "workspace:init smoke must merge existing topic bundles additively instead of clobbering them.",
    );
    assert(
      workspace?.plugins?.bundles?.includes("topic-qidian-female-longform"),
      "workspace:init smoke must merge the official topic bundle for the updated default starter profile.",
    );

    const runtimeState = configureAifictionPlugins({
      source: "workspace",
      workspaceRoot: smokeRoot,
      reset: true,
    });
    assert(
      runtimeState.loadedPluginIds.includes("builtin.starter-qidian-female-longform"),
      "workspace:init smoke must load starter bundle plugins from workspace.yml.",
    );

    console.log("[AiFiction Init Workspace Smoke] Workspace:", smokeRoot);
    console.log(
      "[AiFiction Init Workspace Smoke] Bundles:",
      (workspace?.plugins?.bundles ?? []).join(", "),
    );
  } finally {
    await closeSqliteClient();

    if (previousWorkspaceRoot) {
      process.env.AIFICTION_WORKSPACE_ROOT = previousWorkspaceRoot;
    } else {
      delete process.env.AIFICTION_WORKSPACE_ROOT;
    }

    await cleanupSmokeWorkspace(smokeRoot);
  }
}

main()
  .catch((error) => {
    console.error("[AiFiction Init Workspace Smoke] Error:", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeSqliteClient();
  });
