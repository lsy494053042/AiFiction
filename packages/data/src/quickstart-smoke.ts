import fs from "node:fs";
import path from "node:path";

import YAML from "yaml";

import { closeSqliteClient, resolveWorkspaceRoot } from "./client";
import { WorkspaceProtocolService } from "./protocol";
import { runQuickstartCommand } from "./quickstart";
import { cleanupSmokeWorkspace, prepareAifictionSmokeWorkspace } from "./smoke-workspace";

interface WorkspaceLikeFile {
  workspace_name?: string;
  plugins?: {
    bundles?: string[];
  };
  book_starters?: {
    default_profile_key?: string;
  };
  book_index?: Array<{ book_id?: string }>;
}

interface BookLikeFile {
  book_id?: string;
  starter_profile_key?: string;
  publication?: {
    target_platform?: string;
  };
  source_of_truth?: {
    documents?: Array<{ relative_path?: string }>;
  };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function prepareSmokeWorkspace(smokeRoot: string, repositoryWorkspaceRoot: string) {
  prepareAifictionSmokeWorkspace({
    smokeRoot,
    repositoryWorkspaceRoot,
  });
}

async function main() {
  const repositoryWorkspaceRoot = resolveWorkspaceRoot();
  const smokeRoot = path.join(repositoryWorkspaceRoot, "storage", "smoke", "quickstart", `run-${Date.now()}`);
  const smokeDbPath = path.join(smokeRoot, "storage", "db", "aifiction.sqlite");
  const previousWorkspaceRoot = process.env.AIFICTION_WORKSPACE_ROOT;
  const previousDbPath = process.env.AIFICTION_DB_PATH;

  prepareSmokeWorkspace(smokeRoot, repositoryWorkspaceRoot);
  process.env.AIFICTION_WORKSPACE_ROOT = smokeRoot;
  process.env.AIFICTION_DB_PATH = smokeDbPath;

  try {
    await runQuickstartCommand([
      "create",
      "Quickstart Smoke Book",
      "--profile",
      "qidian-female-longform",
      "--workspace-name",
      "Quickstart Smoke",
      "--slug",
      "quickstart-smoke-book",
      "--root-dir-name",
      "quickstart-smoke-book",
    ]);

    const workspaceFilePath = path.join(smokeRoot, "workspace.yml");
    const bookRoot = path.join(smokeRoot, "books", "quickstart-smoke-book");
    const bookFilePath = path.join(bookRoot, "book.yml");
    assert(fs.existsSync(workspaceFilePath), "quickstart smoke must create workspace.yml.");
    assert(fs.existsSync(bookFilePath), "quickstart smoke must create book.yml.");

    const workspace = YAML.parse(fs.readFileSync(workspaceFilePath, "utf8")) as WorkspaceLikeFile | undefined;
    const book = YAML.parse(fs.readFileSync(bookFilePath, "utf8")) as BookLikeFile | undefined;
    assert(workspace?.workspace_name === "Quickstart Smoke", "quickstart smoke must persist workspace name.");
    assert(
      workspace?.book_starters?.default_profile_key === "qidian-female-longform",
      "quickstart smoke must persist selected starter profile to workspace.yml.",
    );
    assert(
      workspace?.plugins?.bundles?.includes("core-default") &&
        workspace?.plugins?.bundles?.includes("topic-qidian-female-longform"),
      "quickstart smoke must initialize workspace bundles from selected profile.",
    );
    assert(
      workspace?.book_index?.some((entry) => entry.book_id === "quickstart-smoke-book"),
      "quickstart smoke must register the created book in workspace.yml.",
    );
    assert(
      book?.book_id === "quickstart-smoke-book" && book?.starter_profile_key === "qidian-female-longform",
      "quickstart smoke must persist the selected book starter profile.",
    );
    assert(
      book?.publication?.target_platform === "起点中文网（女频）",
      "quickstart smoke must apply starter profile publication defaults.",
    );

    for (const document of book?.source_of_truth?.documents ?? []) {
      if (!document.relative_path) {
        continue;
      }
      assert(
        fs.existsSync(path.join(bookRoot, document.relative_path)),
        `quickstart smoke must materialize placeholder source doc: ${document.relative_path}`,
      );
    }

    const protocolService = new WorkspaceProtocolService();
    const summary = await protocolService.getWorkProtocolSummaryBySlug("quickstart-smoke-book");
    assert(summary?.protocolStatus === "ready", "quickstart smoke must leave a ready protocol summary.");

    await runQuickstartCommand(["doctor"]);

    const firstSourceDocument = book?.source_of_truth?.documents?.[0]?.relative_path;
    if (firstSourceDocument) {
      fs.rmSync(path.join(bookRoot, firstSourceDocument), { force: true });
    }
    workspace!.plugins = {
      bundles: ["core-default", "starter-qidian-female-longform"],
    };
    fs.writeFileSync(workspaceFilePath, YAML.stringify(workspace), "utf8");

    await runQuickstartCommand(["repair"]);

    const repairedWorkspace = YAML.parse(fs.readFileSync(workspaceFilePath, "utf8")) as WorkspaceLikeFile | undefined;
    const repairedBook = YAML.parse(fs.readFileSync(bookFilePath, "utf8")) as BookLikeFile | undefined;
    assert(
      repairedWorkspace?.plugins?.bundles?.includes("topic-qidian-female-longform") &&
        !repairedWorkspace?.plugins?.bundles?.includes("starter-qidian-female-longform"),
      "quickstart repair must normalize compatibility bundles into official topic bundles.",
    );
    if (firstSourceDocument) {
      assert(
        fs.existsSync(path.join(bookRoot, firstSourceDocument)),
        "quickstart repair must recreate missing placeholder source docs.",
      );
    }
    const repairedSummary = await protocolService.getWorkProtocolSummaryBySlug("quickstart-smoke-book");
    assert(repairedSummary?.protocolStatus === "ready", "quickstart repair must keep protocol summary ready.");

    console.log(
      `[AiFiction Quickstart Smoke] ready=${repairedSummary?.protocolStatus} / bundles=${(repairedWorkspace?.plugins?.bundles ?? []).join(
        ",",
      )} / docs=${repairedBook?.source_of_truth?.documents?.length ?? 0}`,
    );
  } finally {
    await closeSqliteClient();

    if (previousWorkspaceRoot) {
      process.env.AIFICTION_WORKSPACE_ROOT = previousWorkspaceRoot;
    } else {
      delete process.env.AIFICTION_WORKSPACE_ROOT;
    }

    if (previousDbPath) {
      process.env.AIFICTION_DB_PATH = previousDbPath;
    } else {
      delete process.env.AIFICTION_DB_PATH;
    }

    await cleanupSmokeWorkspace(smokeRoot);
  }
}

main()
  .catch((error) => {
    console.error("[AiFiction Quickstart Smoke] Error:", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeSqliteClient();
  });
