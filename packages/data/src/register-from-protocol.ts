import fs from "node:fs";
import path from "node:path";

import YAML from "yaml";

import { closeSqliteClient, resolveWorkspaceRoot } from "./client";
import { assertAifictionPreflight } from "./preflight";
import { SqliteProjectCatalogRepository } from "./repositories/v2";
import { NovelProjectSyncService } from "./sync";
import { NovelWorkbenchMutationService } from "./workbench";

interface WorkspaceBookIndexItem {
  book_id?: string;
  title?: string;
  root_path?: string;
  book_file?: string;
}

interface WorkspaceProtocolFile {
  active_book_id?: string;
  default_book_id?: string;
  book_index?: WorkspaceBookIndexItem[];
}

interface BookPublicationProtocol {
  target_platform?: string;
  total_target_word_count?: number;
  stop_loss_word_count?: number;
  chapter_target_word_count?: {
    min?: number;
    max?: number;
    locked?: boolean;
  };
  daily_word_target?: number;
  update_cadence?: string;
}

interface BookEvaluationPolicyProtocol {
  use_workspace_stop_loss_rule?: boolean;
  override_stop_loss_word_count?: number;
}

interface BookSourceDocumentProtocol {
  doc_kind?: string;
  template_key?: string;
  relative_path?: string;
}

interface BookProtocolFile {
  book_id?: string;
  title?: string;
  genre?: string;
  platform?: string;
  status?: string;
  publication?: BookPublicationProtocol;
  evaluation_policy?: BookEvaluationPolicyProtocol;
  paths?: {
    root_dir?: string;
    settings_dir?: string;
    outlines_dir?: string;
    chapters_dir?: string;
    artifacts_dir?: string;
  };
  source_of_truth?: {
    project_brief?: string;
    documents?: BookSourceDocumentProtocol[];
  };
  current_focus?: {
    hard_constraints?: string[];
  };
  hard_constraints?: string[];
}

function parseArgs(argv: string[]) {
  const output: { slug?: string } = {};

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    if (current === "--slug") {
      output.slug = next;
      index += 1;
    }
  }

  return output;
}

function readYamlFile<T>(absolutePath: string): T {
  return YAML.parse(fs.readFileSync(absolutePath, "utf8")) as T;
}

function extractTagline(markdownAbsolutePath?: string): string | undefined {
  if (!markdownAbsolutePath || !fs.existsSync(markdownAbsolutePath)) {
    return undefined;
  }

  const lines = fs
    .readFileSync(markdownAbsolutePath, "utf8")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (line.startsWith("#")) {
      continue;
    }
    if (line.startsWith("-") || /^\d+\./.test(line)) {
      continue;
    }
    return line;
  }

  return undefined;
}

function resolveSourceDocumentPath(
  bookRootPath: string,
  sourceOfTruth: BookProtocolFile["source_of_truth"] | undefined,
  docKind: string,
  fallbackRelativePath?: string,
): string | undefined {
  const registeredPath = sourceOfTruth?.documents?.find((document) => document.doc_kind === docKind)?.relative_path;
  const relativePath = registeredPath ?? fallbackRelativePath;
  if (!relativePath) {
    return undefined;
  }
  return path.resolve(bookRootPath, relativePath);
}

function resolveBookSelection(workspace: WorkspaceProtocolFile, requestedSlug?: string): WorkspaceBookIndexItem {
  const targetSlug =
    requestedSlug ??
    workspace.active_book_id ??
    workspace.default_book_id ??
    workspace.book_index?.[0]?.book_id;

  if (!targetSlug) {
    throw new Error("workspace.yml 里没有 active/default 作品，也没有找到 book_index。");
  }

  const entry = workspace.book_index?.find((item) => item.book_id === targetSlug);
  if (!entry) {
    throw new Error(`workspace.yml 中找不到作品 ${targetSlug} 的索引项。`);
  }

  return entry;
}

function resolveHardConstraints(book: BookProtocolFile, existingConstraints: string[] = []): string[] {
  if (book.hard_constraints?.length) {
    return book.hard_constraints;
  }
  if (book.current_focus?.hard_constraints?.length) {
    return book.current_focus.hard_constraints;
  }
  return existingConstraints;
}

async function main() {
  const workspaceRoot = resolveWorkspaceRoot();
  const args = parseArgs(process.argv.slice(2));
  assertAifictionPreflight({
    commandLabel: "db:register-from-protocol",
    workspaceRoot,
    mode: args.slug ? "book" : "workspace",
    requestedBookSlug: args.slug,
  });
  const workspaceFilePath = path.join(workspaceRoot, "workspace.yml");
  const workspace = readYamlFile<WorkspaceProtocolFile>(workspaceFilePath);
  const bookIndexEntry = resolveBookSelection(workspace, args.slug);

  if (!bookIndexEntry.book_id || !bookIndexEntry.root_path) {
    throw new Error("book_index 条目缺少 book_id 或 root_path。");
  }

  const bookRootPath = path.resolve(workspaceRoot, bookIndexEntry.root_path);
  const bookFilePath = bookIndexEntry.book_file
    ? path.resolve(workspaceRoot, bookIndexEntry.book_file)
    : path.join(bookRootPath, "book.yml");
  const book = readYamlFile<BookProtocolFile>(bookFilePath);

  const mutationService = new NovelWorkbenchMutationService();
  const projectRepository = new SqliteProjectCatalogRepository();
  const syncService = new NovelProjectSyncService();

  const existingProject = await projectRepository.getProjectBySlug(bookIndexEntry.book_id);
  const title = book.title ?? bookIndexEntry.title ?? bookIndexEntry.book_id;
  const projectBriefPath = resolveSourceDocumentPath(
    bookRootPath,
    book.source_of_truth,
    "project-brief",
    book.source_of_truth?.project_brief,
  );
  const tagline =
    extractTagline(
      projectBriefPath
        ? projectBriefPath
        : undefined,
    ) ?? `${title} 的写作项目`;
  const genre = book.genre ?? existingProject?.genre ?? "未分类";
  const targetPlatform =
    book.publication?.target_platform ?? book.platform ?? existingProject?.targetPlatform ?? "未配置";
  const targetWordCount =
    book.publication?.total_target_word_count ?? existingProject?.targetWordCount ?? 1_000_000;
  const dailyWordTarget =
    book.publication?.daily_word_target ?? existingProject?.dailyWordTarget ?? 2_000;
  const updateCadence =
    book.publication?.update_cadence ?? existingProject?.updateCadence ?? "日更";
  const hardConstraints = resolveHardConstraints(book, existingProject?.hardConstraints ?? []);

  const work = existingProject
    ? await mutationService.updateWork({
        workId: existingProject.id,
        title,
        slug: bookIndexEntry.book_id,
        tagline,
        genre,
        targetPlatform,
        targetWordCount,
        dailyWordTarget,
        updateCadence,
        hardConstraints,
      })
    : await mutationService.createWork({
        title,
        slug: bookIndexEntry.book_id,
        tagline,
        genre,
        targetPlatform,
        targetWordCount,
        dailyWordTarget,
        updateCadence,
        hardConstraints,
      });

  const rootPath = path.resolve(bookRootPath, book.paths?.root_dir ?? ".");
  const outlinePath = book.paths?.outlines_dir ? path.resolve(rootPath, book.paths.outlines_dir) : undefined;
  const chapterPath = book.paths?.chapters_dir ? path.resolve(rootPath, book.paths.chapters_dir) : undefined;
  const exportPath = book.paths?.artifacts_dir ? path.resolve(rootPath, book.paths.artifacts_dir) : undefined;

  const fileSource = await syncService.bindProjectFileSource({
    projectId: work.id,
    sourceKey: "primary-manuscript",
    label: `${work.title} 本地目录`,
    rootPath,
    chapterPath,
    outlinePath,
    exportPath,
  });

  const scanSummary = await syncService.scanFileSource(fileSource.id, "register-from-protocol");
  const repairableProjectionPaths = await syncService.listRepairableRegisteredDocumentPaths(fileSource.id);
  await closeSqliteClient();

  let repairedProjectionCount = 0;
  for (const relativePath of repairableProjectionPaths) {
    const repairService = new NovelProjectSyncService();
    const repaired = await repairService.repairRegisteredDocumentProjectionByPath(fileSource.id, relativePath);
    if (repaired) {
      repairedProjectionCount += 1;
    }
    await closeSqliteClient();
  }

  const summarySyncService = new NovelProjectSyncService();
  const remainingReviewCount = await summarySyncService.listProjectReviewQueue(work.id, "pending").then((rows) => rows.length);

  console.log(`[AiFiction Register] Work: ${work.title} (${work.slug} / ${work.id})`);
  console.log(`[AiFiction Register] Source: ${fileSource.id}`);
  console.log(`[AiFiction Register] Root: ${fileSource.rootPath}`);
  console.log(`[AiFiction Register] Platform: ${targetPlatform}`);
  console.log(`[AiFiction Register] Target words: ${targetWordCount}`);
  console.log(
    `[AiFiction Register] Stop-loss words: ${book.publication?.stop_loss_word_count ?? book.evaluation_policy?.override_stop_loss_word_count ?? "n/a"}`,
  );
  console.log(`[AiFiction Register] Scanned: ${scanSummary.scannedCount}`);
  console.log(`[AiFiction Register] Changed: ${scanSummary.changedCount}`);
  console.log(`[AiFiction Register] Created: ${scanSummary.createdCount}`);
  console.log(`[AiFiction Register] Modified: ${scanSummary.modifiedCount}`);
  console.log(`[AiFiction Register] Repaired registered projections: ${repairedProjectionCount}`);
  console.log(`[AiFiction Register] Remaining review items: ${remainingReviewCount}`);
}

main()
  .catch((error) => {
    console.error("[AiFiction Register] Failed.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeSqliteClient();
  });
