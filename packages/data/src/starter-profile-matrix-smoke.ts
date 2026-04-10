import fs from "node:fs";
import path from "node:path";

import YAML from "yaml";

import { closeSqliteClient, resolveWorkspaceRoot } from "./client";
import { runInitWorkspaceCommand } from "./init-workspace";
import { runInitBookCommand } from "./init-book";
import { configureAifictionPlugins } from "./plugins";
import { WorkspaceProtocolService } from "./protocol";
import { starterProfileFixtures, type StarterProfileFixture } from "./starter-profile-fixtures";
import { starterProfileGoldenSnapshots, type StarterProfileGoldenSnapshot } from "./starter-profile-golden";
import { cleanupSmokeWorkspace, prepareAifictionSmokeWorkspace } from "./smoke-workspace";

interface WorkspaceLikeFile {
  workspace_name?: string;
  book_index?: Array<{ book_id?: string }>;
  plugins?: { bundles?: string[] };
  book_starters?: { default_profile_key?: string };
}

interface BookLikeFile {
  starter_profile_key?: string;
  publication?: {
    target_platform?: string;
    total_target_word_count?: number;
    stop_loss_word_count?: number;
    chapter_target_word_count?: { min?: number; max?: number };
  };
  prewrite_gate?: {
    require_full_volume_plan_before_drafting?: boolean;
  };
  planning_budget?: {
    volume_target?: { chapters_min?: number; chapters_max?: number };
  };
  execution_controls?: {
    planning_first?: { required_prewrite_sequence?: string[] };
    root_cause_first?: { allowed_rewrite_triggers?: string[] };
  };
  rhythm_plan?: {
    chapter_function_mix?: Record<string, string>;
    hard_rules?: string[];
  };
  knowledge_state?: {
    enabled_rule_sets?: string[];
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

function sortStrings(values: Array<string | undefined> | undefined): string[] {
  return (values ?? [])
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .sort((left, right) => left.localeCompare(right, "zh-CN"));
}

function normalizeWorkspaceSnapshot(workspace: WorkspaceLikeFile | undefined): StarterProfileGoldenSnapshot["workspace"] {
  return {
    defaultStarterProfile: workspace?.book_starters?.default_profile_key ?? "",
    bundles: sortStrings(workspace?.plugins?.bundles),
    bookCount: workspace?.book_index?.length ?? 0,
  };
}

function normalizeBookSnapshot(book: BookLikeFile | undefined): StarterProfileGoldenSnapshot["book"] {
  return {
    starterProfileKey: book?.starter_profile_key ?? "",
    targetPlatform: book?.publication?.target_platform ?? "",
    totalTargetWordCount: book?.publication?.total_target_word_count ?? 0,
    stopLossWordCount: book?.publication?.stop_loss_word_count ?? 0,
    chapterTargetWordCount: {
      min: book?.publication?.chapter_target_word_count?.min ?? 0,
      max: book?.publication?.chapter_target_word_count?.max ?? 0,
    },
    requireFullVolumePlanBeforeDrafting: book?.prewrite_gate?.require_full_volume_plan_before_drafting ?? false,
    chapterFunctionMix: book?.rhythm_plan?.chapter_function_mix ?? {},
    enabledRuleSets: sortStrings(book?.knowledge_state?.enabled_rule_sets),
    allowedRewriteTriggers: sortStrings(book?.execution_controls?.root_cause_first?.allowed_rewrite_triggers),
    requiredPrewriteSequence: book?.execution_controls?.planning_first?.required_prewrite_sequence ?? undefined,
    volumeTarget: book?.planning_budget?.volume_target
      ? {
          chaptersMin: book.planning_budget.volume_target.chapters_min ?? 0,
          chaptersMax: book.planning_budget.volume_target.chapters_max ?? 0,
        }
      : undefined,
    hardRuleCount: book?.rhythm_plan?.hard_rules?.length ?? 0,
    sourceDocumentCount: book?.source_of_truth?.documents?.length ?? 0,
    sourceDocumentPaths: sortStrings(book?.source_of_truth?.documents?.map((document) => document.relative_path)),
  };
}

function canonicalizeGoldenSnapshot(snapshot: StarterProfileGoldenSnapshot): StarterProfileGoldenSnapshot {
  return {
    workspace: {
      ...snapshot.workspace,
      bundles: sortStrings(snapshot.workspace.bundles),
    },
    book: {
      ...snapshot.book,
      enabledRuleSets: sortStrings(snapshot.book.enabledRuleSets),
      allowedRewriteTriggers: sortStrings(snapshot.book.allowedRewriteTriggers),
      sourceDocumentPaths: sortStrings(snapshot.book.sourceDocumentPaths),
    },
  };
}

function assertGoldenSnapshot(
  profileKey: StarterProfileFixture["profileKey"],
  actual: StarterProfileGoldenSnapshot,
) {
  const expected = canonicalizeGoldenSnapshot(starterProfileGoldenSnapshots[profileKey]);
  const actualNormalized = canonicalizeGoldenSnapshot(actual);
  const actualSerialized = JSON.stringify(actualNormalized, null, 2);
  const expectedSerialized = JSON.stringify(expected, null, 2);
  assert(
    actualSerialized === expectedSerialized,
    `[${profileKey}] golden snapshot drifted.\nExpected:\n${expectedSerialized}\nActual:\n${actualSerialized}`,
  );
}

async function runFixture(
  repositoryWorkspaceRoot: string,
  matrixRoot: string,
  fixture: StarterProfileFixture,
) {
  const smokeRoot = path.join(matrixRoot, fixture.profileKey);
  const smokeDbPath = path.join(smokeRoot, "storage", "db", "aifiction.sqlite");
  const previousWorkspaceRoot = process.env.AIFICTION_WORKSPACE_ROOT;
  const previousDbPath = process.env.AIFICTION_DB_PATH;

  prepareSmokeWorkspace(smokeRoot, repositoryWorkspaceRoot);
  process.env.AIFICTION_WORKSPACE_ROOT = smokeRoot;
  process.env.AIFICTION_DB_PATH = smokeDbPath;

  try {
    await runInitWorkspaceCommand([
      "init",
      "--workspace-name",
      fixture.workspaceName,
      "--profile",
      fixture.profileKey,
    ]);

    const workspaceFilePath = path.join(smokeRoot, "workspace.yml");
    assert(fs.existsSync(workspaceFilePath), `[${fixture.profileKey}] workspace:init must create workspace.yml.`);
    let workspace = YAML.parse(fs.readFileSync(workspaceFilePath, "utf8")) as WorkspaceLikeFile | undefined;
    assert(
      workspace?.workspace_name === fixture.workspaceName,
      `[${fixture.profileKey}] workspace:init must persist workspace name.`,
    );
    assert(
      workspace?.book_starters?.default_profile_key === fixture.profileKey,
      `[${fixture.profileKey}] workspace:init must persist starter profile key.`,
    );
    assert(
      workspace?.plugins?.bundles?.includes("core-default"),
      `[${fixture.profileKey}] workspace:init must keep core-default bundle.`,
    );
    assert(
      workspace?.plugins?.bundles?.includes(fixture.bundleId),
      `[${fixture.profileKey}] workspace:init must merge starter bundle ${fixture.bundleId}.`,
    );

    const workspaceRuntime = configureAifictionPlugins({
      source: "workspace",
      workspaceRoot: smokeRoot,
      reset: true,
    });
    assert(
      workspaceRuntime.loadedPluginIds.includes(fixture.overlayPluginId),
      `[${fixture.profileKey}] workspace runtime must load ${fixture.overlayPluginId}.`,
    );

    await runInitBookCommand([
      "create",
      fixture.title,
      "--profile",
      fixture.profileKey,
      "--slug",
      fixture.slug,
      "--root-dir-name",
      fixture.rootDirName,
    ]);

    const bookFilePath = path.join(smokeRoot, "books", fixture.rootDirName, "book.yml");
    assert(fs.existsSync(bookFilePath), `[${fixture.profileKey}] books:init must create book.yml.`);
    const book = YAML.parse(fs.readFileSync(bookFilePath, "utf8")) as BookLikeFile | undefined;
    workspace = YAML.parse(fs.readFileSync(workspaceFilePath, "utf8")) as WorkspaceLikeFile | undefined;

    assert(
      workspace?.book_index?.some((entry) => entry.book_id === fixture.slug),
      `[${fixture.profileKey}] books:init must register created book in workspace.yml.`,
    );
    assert(
      book?.starter_profile_key === fixture.profileKey,
      `[${fixture.profileKey}] books:init must persist starter_profile_key.`,
    );
    assert(
      book?.publication?.target_platform === fixture.targetPlatform,
      `[${fixture.profileKey}] books:init must persist target platform.`,
    );
    assert(
      book?.publication?.total_target_word_count === fixture.totalTargetWordCount,
      `[${fixture.profileKey}] books:init must persist total target word count.`,
    );
    assert(
      book?.publication?.stop_loss_word_count === fixture.stopLossWordCount,
      `[${fixture.profileKey}] books:init must persist stop-loss word count.`,
    );
    assert(
      book?.publication?.chapter_target_word_count?.min === fixture.chapterTargetWordCount.min &&
        book?.publication?.chapter_target_word_count?.max === fixture.chapterTargetWordCount.max,
      `[${fixture.profileKey}] books:init must persist chapter target word count range.`,
    );
    assert(
      book?.prewrite_gate?.require_full_volume_plan_before_drafting ===
        fixture.expectedRequireFullVolumePlanBeforeDrafting,
      `[${fixture.profileKey}] starter overlay must set require_full_volume_plan_before_drafting correctly.`,
    );
    assert(
      book?.knowledge_state?.enabled_rule_sets?.includes(fixture.expectedRuleSet),
      `[${fixture.profileKey}] starter overlay must enable rule set ${fixture.expectedRuleSet}.`,
    );
    assert(
      book?.execution_controls?.root_cause_first?.allowed_rewrite_triggers?.includes(
        fixture.expectedRewriteTrigger,
      ),
      `[${fixture.profileKey}] starter overlay must enable rewrite trigger ${fixture.expectedRewriteTrigger}.`,
    );
    assert(
      book?.rhythm_plan?.hard_rules?.some((rule) => rule.includes(fixture.expectedHardRuleNeedle)),
      `[${fixture.profileKey}] starter overlay must write hard rule containing ${fixture.expectedHardRuleNeedle}.`,
    );

    if (fixture.expectedVolumeTarget) {
      assert(
        book?.planning_budget?.volume_target?.chapters_min === fixture.expectedVolumeTarget.chaptersMin &&
          book?.planning_budget?.volume_target?.chapters_max === fixture.expectedVolumeTarget.chaptersMax,
        `[${fixture.profileKey}] starter overlay must set planning budget volume target.`,
      );
    }

    for (const excludedStep of fixture.excludedPrewriteSteps ?? []) {
      assert(
        !book?.execution_controls?.planning_first?.required_prewrite_sequence?.includes(excludedStep),
        `[${fixture.profileKey}] starter overlay must exclude prewrite step ${excludedStep}.`,
      );
    }

    for (const document of book?.source_of_truth?.documents ?? []) {
      if (!document.relative_path) {
        continue;
      }
      const absolutePath = path.join(smokeRoot, "books", fixture.rootDirName, document.relative_path);
      assert(
        fs.existsSync(absolutePath),
        `[${fixture.profileKey}] missing placeholder source document: ${document.relative_path}`,
      );
    }

    const protocolService = new WorkspaceProtocolService();
    const summary = await protocolService.getWorkProtocolSummaryBySlug(fixture.slug);
    assert(summary?.bookFileExists, `[${fixture.profileKey}] protocol summary must be readable.`);

    const actualGoldenSnapshot: StarterProfileGoldenSnapshot = {
      workspace: normalizeWorkspaceSnapshot(workspace),
      book: normalizeBookSnapshot(book),
    };
    assertGoldenSnapshot(fixture.profileKey, actualGoldenSnapshot);

    console.log(
      `[AiFiction Starter Matrix] ${fixture.profileKey}: ${fixture.bundleId} / docs=${actualGoldenSnapshot.book.sourceDocumentCount} / book=${fixture.slug} / golden=ok`,
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
  }
}

async function main() {
  const repositoryWorkspaceRoot = resolveWorkspaceRoot();
  const matrixRoot = path.join(
    repositoryWorkspaceRoot,
    "storage",
    "smoke",
    "starter-profile-matrix",
    `run-${Date.now()}`,
  );

  try {
    for (const fixture of starterProfileFixtures) {
      await runFixture(repositoryWorkspaceRoot, matrixRoot, fixture);
    }
  } finally {
    await closeSqliteClient();
    await cleanupSmokeWorkspace(matrixRoot);
  }
}

main()
  .catch((error) => {
    console.error("[AiFiction Starter Matrix] Error:", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeSqliteClient();
  });
