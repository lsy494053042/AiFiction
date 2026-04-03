import fs from "node:fs";
import path from "node:path";

import YAML from "yaml";

import { resolveWorkspaceRoot } from "./client";
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

interface BookProtocolFile {
  book_id?: string;
  title?: string;
  genre?: string;
  platform?: string;
  status?: string;
  paths?: {
    root_dir?: string;
    settings_dir?: string;
    outlines_dir?: string;
    chapters_dir?: string;
    artifacts_dir?: string;
  };
  source_of_truth?: {
    project_brief?: string;
  };
  current_focus?: {
    hard_constraints?: string[];
  };
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

function resolveBookSelection(workspace: WorkspaceProtocolFile, requestedSlug?: string): WorkspaceBookIndexItem {
  const targetSlug = requestedSlug ?? workspace.active_book_id ?? workspace.default_book_id ?? workspace.book_index?.[0]?.book_id;
  if (!targetSlug) {
    throw new Error("workspace.yml 里没有 active/default 作品，也没有找到 book_index。");
  }

  const entry = workspace.book_index?.find((item) => item.book_id === targetSlug);
  if (!entry) {
    throw new Error(`workspace.yml 中找不到作品 ${targetSlug} 的索引项。`);
  }

  return entry;
}

async function main() {
  const workspaceRoot = resolveWorkspaceRoot();
  const args = parseArgs(process.argv.slice(2));
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
  const tagline = extractTagline(
    book.source_of_truth?.project_brief ? path.resolve(bookRootPath, book.source_of_truth.project_brief) : undefined,
  ) ?? `${book.title ?? bookIndexEntry.title ?? bookIndexEntry.book_id} 的写作项目`;

  const work =
    existingProject ??
    (await mutationService.createWork({
      title: book.title ?? bookIndexEntry.title ?? bookIndexEntry.book_id,
      slug: bookIndexEntry.book_id,
      tagline,
      genre: book.genre ?? "未分类",
      targetPlatform: book.platform ?? "未配置",
      targetWordCount: 1_000_000,
      dailyWordTarget: 2_000,
      updateCadence: "日更",
      hardConstraints: book.current_focus?.hard_constraints ?? [],
    }));

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

  console.log(`[AiFiction Register] Work: ${work.title} (${work.slug} / ${work.id})`);
  console.log(`[AiFiction Register] Source: ${fileSource.id}`);
  console.log(`[AiFiction Register] Root: ${fileSource.rootPath}`);
  console.log(`[AiFiction Register] Scanned: ${scanSummary.scannedCount}`);
  console.log(`[AiFiction Register] Changed: ${scanSummary.changedCount}`);
  console.log(`[AiFiction Register] Created: ${scanSummary.createdCount}`);
  console.log(`[AiFiction Register] Modified: ${scanSummary.modifiedCount}`);
  console.log(`[AiFiction Register] Remaining review items: ${scanSummary.autoRoute.remainingReviewCount}`);
}

main().catch((error) => {
  console.error("[AiFiction Register] Failed.");
  console.error(error);
  process.exitCode = 1;
});
