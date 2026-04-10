import fs from "node:fs";
import path from "node:path";

import YAML from "yaml";

import { closeSqliteClient, resolveWorkspaceRoot } from "./client";
import { migrationCompatFixtures, type MigrationCompatFixture } from "./migration-compat-fixtures";
import { migrationCompatGoldenSnapshots, type MigrationCompatGoldenSnapshot } from "./migration-compat-golden";
import { runInitBookCommand } from "./init-book";
import { runInitWorkspaceCommand } from "./init-workspace";
import { WorkspaceProtocolService } from "./protocol";
import { cleanupSmokeWorkspace, prepareAifictionSmokeWorkspace } from "./smoke-workspace";

interface WorkspaceLikeFile {
  workspace_name?: string;
  plugins?: {
    bundles?: string[];
  };
  book_starters?: {
    default_profile_key?: string;
    profiles?: Array<{ profile_key?: string }>;
  };
}

interface BookLikeFile {
  starter_profile_key?: string;
  source_of_truth?: {
    project_brief?: string;
    world_settings?: string;
    character_settings?: string;
    master_outline?: string;
    active_volume_outline?: string;
    documents?: Array<{
      doc_kind?: string;
      template_key?: string;
      relative_path?: string;
      scope?: string;
      is_source_of_truth?: boolean;
      priority?: number;
      sync_policy?: string;
    }>;
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

function normalizeWorkspaceSnapshot(workspace: WorkspaceLikeFile | undefined): MigrationCompatGoldenSnapshot["workspace"] {
  return {
    bundles: sortStrings(workspace?.plugins?.bundles),
    defaultStarterProfile: workspace?.book_starters?.default_profile_key ?? "",
    starterProfileCount: workspace?.book_starters?.profiles?.length ?? 0,
    pluginsPresent: Boolean(workspace?.plugins),
  };
}

function normalizeBookSnapshot(book: BookLikeFile | undefined): MigrationCompatGoldenSnapshot["book"] {
  return {
    starterProfileKey: book?.starter_profile_key ?? "",
    legacyFieldPaths: {
      projectBrief: book?.source_of_truth?.project_brief ?? "",
      worldSettings: book?.source_of_truth?.world_settings ?? "",
      characterSettings: book?.source_of_truth?.character_settings ?? "",
      masterOutline: book?.source_of_truth?.master_outline ?? "",
      activeVolumeOutline: book?.source_of_truth?.active_volume_outline ?? "",
    },
    sourceDocumentCount: book?.source_of_truth?.documents?.length ?? 0,
    sourceDocumentMappings: sortStrings(
      book?.source_of_truth?.documents?.map(
        (document) => `${document.doc_kind ?? "unknown"}:${document.relative_path ?? ""}`,
      ),
    ),
  };
}

function canonicalizeGoldenSnapshot(snapshot: MigrationCompatGoldenSnapshot): MigrationCompatGoldenSnapshot {
  return {
    workspace: {
      ...snapshot.workspace,
      bundles: sortStrings(snapshot.workspace.bundles),
    },
    book: {
      ...snapshot.book,
      sourceDocumentMappings: sortStrings(snapshot.book.sourceDocumentMappings),
    },
  };
}

function assertGoldenSnapshot(
  fixtureKey: MigrationCompatFixture["fixtureKey"],
  actual: MigrationCompatGoldenSnapshot,
) {
  const expected = canonicalizeGoldenSnapshot(migrationCompatGoldenSnapshots[fixtureKey]);
  const actualNormalized = canonicalizeGoldenSnapshot(actual);
  const actualSerialized = JSON.stringify(actualNormalized, null, 2);
  const expectedSerialized = JSON.stringify(expected, null, 2);

  assert(
    actualSerialized === expectedSerialized,
    `[${fixtureKey}] migration compatibility golden snapshot drifted.\nExpected:\n${expectedSerialized}\nActual:\n${actualSerialized}`,
  );
}

function writePlaceholder(rootPath: string, relativePath: string, title: string) {
  const absolutePath = path.join(rootPath, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  if (!fs.existsSync(absolutePath)) {
    fs.writeFileSync(absolutePath, `# ${title}\n`, "utf8");
  }
}

function mutateLegacyWorkspaceBootstrap(workspaceFilePath: string) {
  const workspace = YAML.parse(fs.readFileSync(workspaceFilePath, "utf8")) as WorkspaceLikeFile | undefined;
  assert(workspace, "legacy-workspace-bootstrap mutation requires an existing workspace.yml.");
  delete workspace.plugins;
  delete workspace.book_starters;
  fs.writeFileSync(workspaceFilePath, YAML.stringify(workspace), "utf8");
}

function mutateLegacySourceOfTruthLegacyOnly(bookFilePath: string, bookRoot: string) {
  const book = YAML.parse(fs.readFileSync(bookFilePath, "utf8")) as BookLikeFile | undefined;
  assert(book, "legacy-source-of-truth mutation requires an existing book.yml.");
  book.source_of_truth = {
    project_brief: "00-设定/旧版作品定位.md",
    world_settings: "00-设定/旧版世界设定.md",
    character_settings: "00-设定/旧版角色设定.md",
    master_outline: "01-大纲/旧版全书大纲.md",
    active_volume_outline: "01-大纲/旧版卷一大纲.md",
  };
  writePlaceholder(bookRoot, "00-设定/旧版作品定位.md", "旧版作品定位");
  writePlaceholder(bookRoot, "00-设定/旧版世界设定.md", "旧版世界设定");
  writePlaceholder(bookRoot, "00-设定/旧版角色设定.md", "旧版角色设定");
  writePlaceholder(bookRoot, "01-大纲/旧版全书大纲.md", "旧版全书大纲");
  writePlaceholder(bookRoot, "01-大纲/旧版卷一大纲.md", "旧版卷一大纲");
  fs.writeFileSync(bookFilePath, YAML.stringify(book), "utf8");
}

function mutateLegacySourceOfTruthMixedRegistry(bookFilePath: string, bookRoot: string) {
  const book = YAML.parse(fs.readFileSync(bookFilePath, "utf8")) as BookLikeFile | undefined;
  assert(book, "legacy-source-of-truth mixed mutation requires an existing book.yml.");
  book.source_of_truth = {
    project_brief: "00-设定/旧版作品定位.md",
    world_settings: "00-设定/旧版世界设定.md",
    character_settings: "00-设定/旧版角色设定.md",
    master_outline: "01-大纲/旧版全书大纲.md",
    active_volume_outline: "01-大纲/旧版卷一大纲.md",
    documents: [
      {
        doc_kind: "project-brief",
        template_key: "project-brief",
        relative_path: "00-设定/迁移后作品定位.md",
        scope: "project",
        is_source_of_truth: true,
        priority: 120,
        sync_policy: "manual",
      },
      {
        doc_kind: "organization-setting",
        template_key: "organization-ecology",
        relative_path: "00-设定/组织与交易生态.md",
        scope: "organization",
        is_source_of_truth: true,
        priority: 75,
        sync_policy: "manual",
      },
      {
        doc_kind: "research-note",
        template_key: "research-note",
        relative_path: "00-设定/科研体系.md",
        scope: "research",
        is_source_of_truth: false,
        priority: 30,
        sync_policy: "manual",
      },
    ],
  };
  writePlaceholder(bookRoot, "00-设定/旧版作品定位.md", "旧版作品定位");
  writePlaceholder(bookRoot, "00-设定/旧版世界设定.md", "旧版世界设定");
  writePlaceholder(bookRoot, "00-设定/旧版角色设定.md", "旧版角色设定");
  writePlaceholder(bookRoot, "01-大纲/旧版全书大纲.md", "旧版全书大纲");
  writePlaceholder(bookRoot, "01-大纲/旧版卷一大纲.md", "旧版卷一大纲");
  writePlaceholder(bookRoot, "00-设定/迁移后作品定位.md", "迁移后作品定位");
  writePlaceholder(bookRoot, "00-设定/组织与交易生态.md", "组织与交易生态");
  writePlaceholder(bookRoot, "00-设定/科研体系.md", "科研体系");
  fs.writeFileSync(bookFilePath, YAML.stringify(book), "utf8");
}

function applyFixtureMutation(
  fixture: MigrationCompatFixture,
  workspaceFilePath: string,
  bookFilePath: string,
  bookRoot: string,
) {
  switch (fixture.fixtureKey) {
    case "legacy-workspace-bootstrap":
      mutateLegacyWorkspaceBootstrap(workspaceFilePath);
      return;
    case "legacy-source-of-truth-legacy-only":
      mutateLegacySourceOfTruthLegacyOnly(bookFilePath, bookRoot);
      return;
    case "legacy-source-of-truth-mixed-registry":
      mutateLegacySourceOfTruthMixedRegistry(bookFilePath, bookRoot);
      return;
  }
}

async function runFixture(
  repositoryWorkspaceRoot: string,
  matrixRoot: string,
  fixture: MigrationCompatFixture,
) {
  const smokeRoot = path.join(matrixRoot, fixture.fixtureKey);
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

    const workspaceFilePath = path.join(smokeRoot, "workspace.yml");
    const bookRoot = path.join(smokeRoot, "books", fixture.rootDirName);
    const bookFilePath = path.join(bookRoot, "book.yml");

    assert(fs.existsSync(workspaceFilePath), `[${fixture.fixtureKey}] workspace.yml must exist before mutation.`);
    assert(fs.existsSync(bookFilePath), `[${fixture.fixtureKey}] book.yml must exist before mutation.`);

    applyFixtureMutation(fixture, workspaceFilePath, bookFilePath, bookRoot);

    const protocolService = new WorkspaceProtocolService();
    const summary = await protocolService.bootstrapWorkProtocolBySlug(fixture.slug);
    assert(summary?.workspaceFileExists, `[${fixture.fixtureKey}] bootstrap must keep workspace protocol readable.`);
    assert(summary?.bookFileExists, `[${fixture.fixtureKey}] bootstrap must keep book protocol readable.`);

    const workspace = YAML.parse(fs.readFileSync(workspaceFilePath, "utf8")) as WorkspaceLikeFile | undefined;
    const book = YAML.parse(fs.readFileSync(bookFilePath, "utf8")) as BookLikeFile | undefined;
    const actualGoldenSnapshot: MigrationCompatGoldenSnapshot = {
      workspace: normalizeWorkspaceSnapshot(workspace),
      book: normalizeBookSnapshot(book),
    };

    assertGoldenSnapshot(fixture.fixtureKey, actualGoldenSnapshot);

    console.log(
      `[AiFiction Migration Compat] ${fixture.fixtureKey}: bundles=${actualGoldenSnapshot.workspace.bundles.join(
        ",",
      )} / docs=${actualGoldenSnapshot.book.sourceDocumentCount} / starterProfiles=${
        actualGoldenSnapshot.workspace.starterProfileCount
      } / golden=ok`,
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
    "migration-compat-matrix",
    `run-${Date.now()}`,
  );

  try {
    for (const fixture of migrationCompatFixtures) {
      await runFixture(repositoryWorkspaceRoot, matrixRoot, fixture);
    }
  } finally {
    await closeSqliteClient();
    await cleanupSmokeWorkspace(matrixRoot);
  }
}

main()
  .catch((error) => {
    console.error("[AiFiction Migration Compat] Error:", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeSqliteClient();
  });
