import fs from "node:fs";
import path from "node:path";

import YAML from "yaml";

import { closeSqliteClient, resolveWorkspaceRoot } from "./client";
import { configureAifictionPlugins } from "./plugins";
import { WorkspaceProtocolService } from "./protocol";
import { runInitBookCommand } from "./init-book";
import { runInitWorkspaceCommand } from "./init-workspace";
import { cleanupSmokeWorkspace, prepareAifictionSmokeWorkspace } from "./smoke-workspace";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

interface WorkspaceLikeFile {
  book_index?: Array<{ book_id?: string; root_path?: string; book_file?: string }>;
  book_starters?: { default_profile_key?: string };
  plugins?: { bundles?: string[] };
}

interface BookLikeFile {
  starter_profile_key?: string;
  publication?: {
    total_target_word_count?: number;
    stop_loss_word_count?: number;
    chapter_target_word_count?: { min?: number; max?: number };
  };
  prewrite_gate?: {
    require_full_volume_plan_before_drafting?: boolean;
    current_total_target_locked?: boolean;
    current_stop_loss_locked?: boolean;
    current_chapter_target_locked?: boolean;
  };
  planning_budget?: {
    volume_target?: { chapters_min?: number; chapters_max?: number };
  };
  execution_controls?: {
    planning_first?: { required_prewrite_sequence?: string[] };
  };
  rhythm_plan?: {
    hard_rules?: string[];
  };
  source_of_truth?: {
    documents?: Array<{ relative_path?: string }>;
  };
}

async function main() {
  const repositoryWorkspaceRoot = resolveWorkspaceRoot();
  const smokeRoot = path.join(
    repositoryWorkspaceRoot,
    "storage",
    "smoke",
    "books-init",
    `run-${Date.now()}`,
  );
  const smokeDbPath = path.join(smokeRoot, "storage", "db", "aifiction.sqlite");
  const previousWorkspaceRoot = process.env.AIFICTION_WORKSPACE_ROOT;
  const previousDbPath = process.env.AIFICTION_DB_PATH;
  const smokeSlug = "books-init-smoke";
  const smokeRootDirName = "books-init-smoke";
  const smokeTitle = "Books Init Smoke";

  prepareAifictionSmokeWorkspace({
    smokeRoot,
    repositoryWorkspaceRoot,
    packageName: "aifiction-books-init-smoke",
  });

  process.env.AIFICTION_WORKSPACE_ROOT = smokeRoot;
  process.env.AIFICTION_DB_PATH = smokeDbPath;

  try {
    await runInitWorkspaceCommand([
      "init",
      "--workspace-name",
      "Books Init Smoke",
      "--profile",
      "serial-experimental",
    ]);

    await runInitBookCommand([
      "create",
      smokeTitle,
      "--profile",
      "serial-experimental",
      "--slug",
      smokeSlug,
      "--root-dir-name",
      smokeRootDirName,
    ]);

    const workspaceFilePath = path.join(smokeRoot, "workspace.yml");
    const bookFilePath = path.join(smokeRoot, "books", smokeRootDirName, "book.yml");
    assert(fs.existsSync(workspaceFilePath), "books:init smoke must create workspace.yml.");
    assert(fs.existsSync(bookFilePath), "books:init smoke must create book.yml.");

    const workspace = YAML.parse(fs.readFileSync(workspaceFilePath, "utf8")) as WorkspaceLikeFile | undefined;
    const book = YAML.parse(fs.readFileSync(bookFilePath, "utf8")) as BookLikeFile | undefined;
    const runtimeState = configureAifictionPlugins({
      source: "workspace",
      workspaceRoot: smokeRoot,
      reset: true,
    });
    assert(workspace?.book_starters?.default_profile_key, "books:init smoke must persist workspace starter profiles.");
    assert(
      workspace?.plugins?.bundles?.includes("topic-serial-experimental"),
      "books:init smoke must apply the official topic bundle for the selected starter profile to workspace.yml.",
    );
    assert(
      runtimeState.loadedPluginIds.includes("builtin.starter-serial-experimental"),
      "books:init smoke must load the selected starter bundle plugin.",
    );
    assert(
      workspace?.book_index?.some((entry) => entry.book_id === smokeSlug),
      "books:init smoke must register the created book in workspace.yml.",
    );
    assert(book?.starter_profile_key === "serial-experimental", "books:init smoke must persist starter_profile_key.");
    assert(
      book?.publication?.total_target_word_count === 300000,
      "books:init smoke must persist starter profile total target word count.",
    );
    assert(
      book?.publication?.stop_loss_word_count === 80000,
      "books:init smoke must persist starter profile stop-loss word count.",
    );
    assert(
      book?.publication?.chapter_target_word_count?.min === 1800 &&
        book?.publication?.chapter_target_word_count?.max === 2200,
      "books:init smoke must persist starter profile chapter target range.",
    );
    assert(book?.prewrite_gate?.current_total_target_locked, "books:init smoke must lock total target word count.");
    assert(book?.prewrite_gate?.current_stop_loss_locked, "books:init smoke must lock stop-loss word count.");
    assert(book?.prewrite_gate?.current_chapter_target_locked, "books:init smoke must lock chapter target word count.");
    assert(
      book?.prewrite_gate?.require_full_volume_plan_before_drafting === false,
      "books:init smoke must apply starter bundle prewrite gate overrides.",
    );
    assert(
      book?.planning_budget?.volume_target?.chapters_min === 8 &&
        book?.planning_budget?.volume_target?.chapters_max === 15,
      "books:init smoke must apply starter bundle volume target overrides.",
    );
    assert(
      !book?.execution_controls?.planning_first?.required_prewrite_sequence?.includes("full-volume-plan"),
      "books:init smoke must apply starter bundle planning sequence overrides.",
    );
    assert(
      book?.rhythm_plan?.hard_rules?.some((rule) => rule.includes("前 5-10 章先验证钩子")),
      "books:init smoke must apply starter bundle rhythm rules.",
    );
    assert(
      (book?.source_of_truth?.documents?.length ?? 0) > 0,
      "books:init smoke must generate registered source documents.",
    );

    for (const document of book?.source_of_truth?.documents ?? []) {
      if (!document.relative_path) {
        continue;
      }
      const absolutePath = path.join(smokeRoot, "books", smokeRootDirName, document.relative_path);
      assert(fs.existsSync(absolutePath), `books:init smoke is missing placeholder source document: ${document.relative_path}`);
    }

    const protocolService = new WorkspaceProtocolService();
    const summary = await protocolService.getWorkProtocolSummaryBySlug(smokeSlug);
    assert(summary?.bookFileExists, "books:init smoke must create a readable protocol summary.");
    assert(summary?.book?.starter_profile_key === "serial-experimental", "books:init smoke summary must expose starter profile.");

    console.log("[AiFiction Init Book Smoke] Workspace:", smokeRoot);
    console.log("[AiFiction Init Book Smoke] Book:", summary?.workTitle ?? smokeTitle, `(${smokeSlug})`);
    console.log(
      "[AiFiction Init Book Smoke] Placeholder docs:",
      String(book?.source_of_truth?.documents?.length ?? 0),
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
    console.error("[AiFiction Init Book Smoke] Error:", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeSqliteClient();
  });
