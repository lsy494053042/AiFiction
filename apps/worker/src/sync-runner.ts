import path from "node:path";

import { getSqliteClient, NovelProjectSyncService, resolveWorkspaceRoot, SqliteProjectCatalogRepository } from "@aifiction/data";

interface SyncRunnerOptions {
  project?: string;
  sourceId?: string;
  sourceKey?: string;
  root?: string;
  chapters?: string;
  outline?: string;
  exports?: string;
  trigger?: string;
  listProjects?: boolean;
  listSources?: boolean;
}

function parseArgs(argv: string[]): SyncRunnerOptions {
  const options: SyncRunnerOptions = {};

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const nextValue = argv[index + 1];

    switch (argument) {
      case "--project":
        options.project = nextValue;
        index += 1;
        break;
      case "--source-id":
        options.sourceId = nextValue;
        index += 1;
        break;
      case "--source-key":
        options.sourceKey = nextValue;
        index += 1;
        break;
      case "--root":
        options.root = nextValue;
        index += 1;
        break;
      case "--chapters":
        options.chapters = nextValue;
        index += 1;
        break;
      case "--outline":
        options.outline = nextValue;
        index += 1;
        break;
      case "--exports":
        options.exports = nextValue;
        index += 1;
        break;
      case "--trigger":
        options.trigger = nextValue;
        index += 1;
        break;
      case "--list-projects":
        options.listProjects = true;
        break;
      case "--list-sources":
        options.listSources = true;
        break;
      default:
        break;
    }
  }

  return options;
}

function printUsage() {
  console.log("[AiFiction Sync Worker] Usage:");
  console.log("  npm run worker:sync -- --list-projects");
  console.log("  npm run worker:sync -- --project demo-work-v2 --list-sources");
  console.log(
    "  npm run worker:sync -- --project demo-work-v2 --root storage/sync-smoke/demo-work-v2 --chapters chapters --outline outline",
  );
  console.log("  npm run worker:sync -- --source-id <file-source-id>");
}

async function resolveProjectId(
  projectRepository: SqliteProjectCatalogRepository,
  identity: string,
): Promise<string | null> {
  const trimmedIdentity = identity.trim();
  if (!trimmedIdentity) {
    return null;
  }

  const projects = await projectRepository.listProjects({ limit: 200 });
  const matchedById = projects.find((project) => project.id === trimmedIdentity);
  if (matchedById) {
    return matchedById.id;
  }

  const matchedBySlug = await projectRepository.getProjectBySlug(trimmedIdentity);
  return matchedBySlug?.id ?? null;
}

function resolveRootPath(inputPath?: string): string | undefined {
  if (!inputPath?.trim()) {
    return undefined;
  }

  // 相对路径统一按工作区根目录解析，避免在不同 workspace 下跑偏。
  const workspaceRoot = resolveWorkspaceRoot();
  return path.isAbsolute(inputPath) ? inputPath : path.resolve(workspaceRoot, inputPath);
}

function printScanSummary(summary: Awaited<ReturnType<NovelProjectSyncService["scanFileSource"]>>) {
  console.log(`[AiFiction Sync Worker] Scan completed: ${summary.fileSource.label}`);
  console.log(`- Source ID: ${summary.fileSource.id}`);
  console.log(`- Root Path: ${summary.fileSource.rootPath}`);
  console.log(`- Scanned: ${summary.scannedCount}`);
  console.log(`- Changed: ${summary.changedCount}`);
  console.log(`- Created: ${summary.createdCount}`);
  console.log(`- Modified: ${summary.modifiedCount}`);
  console.log(`- Missing: ${summary.missingCount}`);
  console.log(`- Unchanged: ${summary.unchangedCount}`);
  console.log(`- Auto-routed reviews: ${summary.autoRoute.scannedReviewCount}`);
  console.log(`- Auto-approved: ${summary.autoRoute.approvedReviewCount}`);
  console.log(`- Remaining review items: ${summary.autoRoute.remainingReviewCount}`);
  console.log(`- Conflict items: ${summary.autoRoute.conflictReviewCount}`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const client = getSqliteClient();
  const projectRepository = new SqliteProjectCatalogRepository(client);
  const syncService = new NovelProjectSyncService(client);

  if (options.listProjects) {
    const projects = await projectRepository.listProjects({ limit: 100 });
    console.log(`[AiFiction Sync Worker] Projects: ${projects.length}`);
    for (const project of projects) {
      console.log(`- ${project.title} (${project.slug} / ${project.id})`);
    }
    return;
  }

  if (!options.project && !options.sourceId) {
    printUsage();
    return;
  }

  if (options.sourceId) {
    const scanSummary = await syncService.scanFileSource(options.sourceId, options.trigger?.trim() || "worker-cli");
    printScanSummary(scanSummary);
    return;
  }

  const projectId = await resolveProjectId(projectRepository, options.project!);
  if (!projectId) {
    throw new Error(`Project not found: ${options.project}`);
  }

  if (options.listSources) {
    const sources = await syncService.listProjectFileSources(projectId);
    console.log(`[AiFiction Sync Worker] File sources: ${sources.length}`);
    for (const source of sources) {
      console.log(`- ${source.label}`);
      console.log(`  id=${source.id}`);
      console.log(`  root=${source.rootPath}`);
      console.log(`  chapters=${source.chapterPath ?? "-"}`);
      console.log(`  outline=${source.outlinePath ?? "-"}`);
      console.log(`  exports=${source.exportPath ?? "-"}`);
      console.log(`  lastScannedAt=${source.lastScannedAt ?? "-"}`);
    }
    return;
  }

  if (!options.root) {
    throw new Error("Missing --root. A root path is required to bind or update a local source.");
  }

  // 目录绑定走 upsert，后续重复调用会更新同一 sourceKey 的路径配置。
  const fileSource = await syncService.bindProjectFileSource({
    projectId,
    sourceKey: options.sourceKey,
    rootPath: resolveRootPath(options.root)!,
    chapterPath: options.chapters,
    outlinePath: options.outline,
    exportPath: options.exports,
  });

  const scanSummary = await syncService.scanFileSource(fileSource.id, options.trigger?.trim() || "worker-cli");
  printScanSummary(scanSummary);
}

main().catch((error) => {
  console.error("[AiFiction Sync Worker] Execution failed.");
  console.error(error);
  process.exitCode = 1;
});