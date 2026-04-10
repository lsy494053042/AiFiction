import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import YAML from "yaml";

import { closeSqliteClient, resolveWorkspaceRoot } from "./client";
import {
  createBook,
  ensurePlaceholderDocuments,
  resolveInitBookStarterProfile,
  resolveWorkspaceBookStarters,
  type InitBookArgs,
} from "./init-book";
import { initWorkspace, type InitWorkspaceArgs } from "./init-workspace";
import { buildPluginDoctorReport } from "./plugin-doctor";
import { normalizeWorkspaceCompatibilityBundles } from "./plugins-cli";
import { assertAifictionPreflight } from "./preflight";
import { WorkspaceProtocolService } from "./protocol";

export interface QuickstartArgs {
  command: "list-profiles" | "create" | "doctor" | "repair";
  title?: string;
  profileKey?: string;
  workspaceName?: string;
  tagline?: string;
  genre?: string;
  subgenre?: string;
  slug?: string;
  rootDirName?: string;
  bookSlug?: string;
  dryRun: boolean;
  verify: boolean;
}

interface QuickstartWorkspaceLikeFile {
  workspace_name?: string;
  active_book_id?: string;
  default_book_id?: string;
  book_index?: Array<{ book_id?: string; title?: string }>;
  plugins?: {
    bundles?: string[];
    strict_mode?: boolean;
  };
  book_starters?: {
    default_profile_key?: string;
    profiles?: Array<{ profile_key?: string; label?: string; plugin_bundles?: string[] }>;
  };
}

interface QuickstartBookLikeFile {
  book_id?: string;
  title?: string;
  starter_profile_key?: string;
  publication?: {
    target_platform?: string;
  };
  source_of_truth?: {
    documents?: Array<{ relative_path?: string }>;
  };
}

function readWorkspaceFile(workspaceRoot: string): QuickstartWorkspaceLikeFile | undefined {
  const workspaceFilePath = path.join(workspaceRoot, "workspace.yml");
  if (!fs.existsSync(workspaceFilePath)) {
    return undefined;
  }

  return YAML.parse(fs.readFileSync(workspaceFilePath, "utf8")) as QuickstartWorkspaceLikeFile | undefined;
}

function readBookFile(bookFilePath: string): QuickstartBookLikeFile | undefined {
  if (!fs.existsSync(bookFilePath)) {
    return undefined;
  }

  return YAML.parse(fs.readFileSync(bookFilePath, "utf8")) as QuickstartBookLikeFile | undefined;
}

function dedupeStrings(values: Array<string | undefined>): string[] {
  return Array.from(
    new Set(values.filter((value): value is string => typeof value === "string" && value.trim().length > 0).map((value) => value.trim())),
  );
}

export function parseQuickstartArgs(argv: string[]): QuickstartArgs {
  let command: QuickstartArgs["command"] = "list-profiles";
  let title: string | undefined;
  let profileKey: string | undefined;
  let workspaceName: string | undefined;
  let tagline: string | undefined;
  let genre: string | undefined;
  let subgenre: string | undefined;
  let slug: string | undefined;
  let rootDirName: string | undefined;
  let bookSlug: string | undefined;
  let dryRun = false;
  let verify = true;

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    if (current === "list-profiles" || current === "create" || current === "doctor" || current === "repair") {
      command = current;
      continue;
    }
    if (current === "--profile" && next) {
      profileKey = next;
      index += 1;
      continue;
    }
    if (current === "--workspace-name" && next) {
      workspaceName = next;
      index += 1;
      continue;
    }
    if (current === "--tagline" && next) {
      tagline = next;
      index += 1;
      continue;
    }
    if (current === "--genre" && next) {
      genre = next;
      index += 1;
      continue;
    }
    if (current === "--subgenre" && next) {
      subgenre = next;
      index += 1;
      continue;
    }
    if (current === "--slug" && next) {
      slug = next;
      index += 1;
      continue;
    }
    if (current === "--root-dir-name" && next) {
      rootDirName = next;
      index += 1;
      continue;
    }
    if (current === "--book" && next) {
      bookSlug = next;
      index += 1;
      continue;
    }
    if (current === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (current === "--no-verify") {
      verify = false;
      continue;
    }
    if (!current.startsWith("--") && !title && command === "create") {
      title = current;
    }
  }

  return {
    command,
    title,
    profileKey,
    workspaceName,
    tagline,
    genre,
    subgenre,
    slug,
    rootDirName,
    bookSlug,
    dryRun,
    verify,
  };
}

function resolveQuickstartPreflight(args: QuickstartArgs) {
  if (args.command === "create" || args.command === "list-profiles") {
    return {
      commandLabel: `quickstart:${args.command}`,
      mode: "bootstrap" as const,
    };
  }

  return {
    commandLabel: `quickstart:${args.command}`,
    mode: args.bookSlug ? ("book" as const) : ("workspace" as const),
    requestedBookSlug: args.bookSlug,
  };
}

function buildCreateDryRunSummary(args: QuickstartArgs) {
  if (!args.title) {
    throw new Error("create 命令需要提供作品标题。");
  }

  const workspaceRoot = resolveWorkspaceRoot();
  const starters = resolveWorkspaceBookStarters();
  const starterProfile = resolveInitBookStarterProfile(starters, args.profileKey);
  const title = args.title.trim();
  const rootDirName = (args.rootDirName ?? title).trim();
  const bookRootPath = path.join(workspaceRoot, "books", rootDirName);

  return {
    command: "create",
    workspaceRoot,
    workspaceName: args.workspaceName ?? "AiFiction 工作区",
    profile: starterProfile.profile_key,
    bundleIds: ["core-default", ...(starterProfile.plugin_bundles ?? [])],
    title,
    slug: args.slug ?? "(auto)",
    rootDirName,
    bookRootPath,
    verifyAfterCreate: args.verify,
    targetPlatform: starterProfile.target_platform ?? "未配置",
    totalTargetWordCount: starterProfile.total_target_word_count ?? 0,
    stopLossWordCount: starterProfile.stop_loss_word_count ?? 0,
    chapterTargetWordCount: starterProfile.chapter_target_word_count ?? {},
  };
}

function printQuickstartStarterProfiles() {
  const starters = resolveWorkspaceBookStarters();
  const profiles = starters.profiles ?? [];

  console.log("[AiFiction Quickstart] Starter profiles");
  console.log(`- Default: ${starters.default_profile_key}`);
  if (!profiles.length) {
    console.log("- (none)");
    return;
  }

  for (const profile of profiles) {
    const bundles = profile.plugin_bundles?.join(", ") || "(none)";
    console.log(`- ${profile.profile_key}: ${profile.label ?? "(no label)"} / bundles=${bundles}`);
  }
}

function collectTargetBookSlugs(workspace: QuickstartWorkspaceLikeFile | undefined, requestedBookSlug?: string): string[] {
  return dedupeStrings([
    requestedBookSlug,
    workspace?.active_book_id,
    workspace?.default_book_id,
    ...(workspace?.book_index?.map((entry) => entry.book_id) ?? []),
  ]);
}

async function buildDoctorSummary(workspaceRoot: string, requestedBookSlug?: string) {
  const workspace = readWorkspaceFile(workspaceRoot);
  const starters = resolveWorkspaceBookStarters();
  const pluginDoctor = buildPluginDoctorReport(workspaceRoot);
  const protocolService = new WorkspaceProtocolService();
  const targetBookSlugs = collectTargetBookSlugs(workspace, requestedBookSlug);
  const bookSummaries = [];

  for (const bookSlug of targetBookSlugs) {
    const summary = await protocolService.getWorkProtocolSummaryBySlug(bookSlug);
    if (!summary) {
      bookSummaries.push({
        workSlug: bookSlug,
        protocolStatus: "missing",
        missingReasons: ["作品未注册到当前工作区。"],
      });
      continue;
    }

    bookSummaries.push({
      workSlug: summary.workSlug,
      workTitle: summary.workTitle,
      protocolStatus: summary.protocolStatus,
      activeStage: summary.activeStage,
      bookFileExists: summary.bookFileExists,
      sourceRootPath: summary.sourceRootPath,
      missingReasons: summary.missingReasons,
    });
  }

  const recommendations = dedupeStrings([
    ...pluginDoctor.recommendations,
    ...(bookSummaries.some((book) => book.protocolStatus !== "ready") ? ["Run: npm.cmd run quickstart -- repair"] : []),
    ...(bookSummaries.length === 0 ? ["Run: npm.cmd run quickstart -- create 作品名 --profile qidian-male-longform"] : []),
    ...(bookSummaries.length > 0 && bookSummaries.every((book) => book.protocolStatus === "ready")
      ? ["Run: npm.cmd run db:protocol-smoke"]
      : []),
  ]);

  return {
    workspaceRoot,
    workspaceName: workspace?.workspace_name ?? "未初始化",
    defaultStarterProfile: workspace?.book_starters?.default_profile_key ?? starters.default_profile_key,
    starterProfiles: (workspace?.book_starters?.profiles ?? starters.profiles ?? []).map((profile) => ({
      profileKey: profile.profile_key,
      label: profile.label,
      bundles: profile.plugin_bundles ?? [],
    })),
    bundles: workspace?.plugins?.bundles ?? [],
    strictMode: workspace?.plugins?.strict_mode ?? false,
    pluginDoctor: {
      hasBlockingIssues: pluginDoctor.runtime.hasBlockingIssues,
      loadedPluginIds: pluginDoctor.runtime.loadedPluginIds,
      blockingRecords: pluginDoctor.runtime.blockingRecords.map(
        (record) => `${record.pluginId}:${record.reason ?? record.status}`,
      ),
      snapshotCount: pluginDoctor.snapshots.count,
    },
    books: bookSummaries,
    recommendations,
  };
}

function printDoctorSummary(summary: Awaited<ReturnType<typeof buildDoctorSummary>>) {
  console.log("[AiFiction Quickstart] Doctor:");
  console.log(`- Workspace: ${summary.workspaceRoot}`);
  console.log(`- Workspace name: ${summary.workspaceName}`);
  console.log(`- Default starter profile: ${summary.defaultStarterProfile}`);
  console.log(`- Bundles: ${summary.bundles.join(", ") || "(none)"}`);
  console.log(`- Strict mode: ${summary.strictMode ? "on" : "off"}`);
  console.log(
    `- Plugins: loaded=${summary.pluginDoctor.loadedPluginIds.length} / blocking=${summary.pluginDoctor.blockingRecords.length} / snapshots=${summary.pluginDoctor.snapshotCount}`,
  );

  if (summary.pluginDoctor.blockingRecords.length) {
    console.log("- Blocking plugin records:");
    for (const record of summary.pluginDoctor.blockingRecords) {
      console.log(`  - ${record}`);
    }
  }

  if (summary.books.length) {
    console.log("- Books:");
    for (const book of summary.books) {
      const titleSegment = book.workTitle ? ` / title=${book.workTitle}` : "";
      const stageSegment = book.activeStage ? ` / stage=${book.activeStage}` : "";
      const rootSegment = book.sourceRootPath ? ` / root=${book.sourceRootPath}` : "";
      console.log(`  - ${book.workSlug}: protocol=${book.protocolStatus}${titleSegment}${stageSegment}${rootSegment}`);
      if (book.missingReasons?.length) {
        for (const reason of book.missingReasons) {
          console.log(`    missing: ${reason}`);
        }
      }
    }
  } else {
    console.log("- Books: (none)");
  }

  if (summary.recommendations.length) {
    console.log("- Next:");
    for (const recommendation of summary.recommendations) {
      console.log(`  - ${recommendation}`);
    }
  }
}

async function repairBooks(workspaceRoot: string, requestedBookSlug?: string) {
  const workspace = readWorkspaceFile(workspaceRoot);
  const targetBookSlugs = collectTargetBookSlugs(workspace, requestedBookSlug);
  const protocolService = new WorkspaceProtocolService();
  const starters = resolveWorkspaceBookStarters();
  const repairedBooks: Array<{ workSlug: string; status: string; sourceDocumentCount: number }> = [];

  for (const bookSlug of targetBookSlugs) {
    const summary = await protocolService.bootstrapWorkProtocolBySlug(bookSlug);
    if (!summary?.book) {
      repairedBooks.push({
        workSlug: bookSlug,
        status: "missing",
        sourceDocumentCount: 0,
      });
      continue;
    }

    const starterProfile = resolveInitBookStarterProfile(
      starters,
      summary.book.starter_profile_key ?? starters.default_profile_key,
    );
    ensurePlaceholderDocuments(summary.bookRootPath, summary.book, starterProfile, summary.workTitle);
    repairedBooks.push({
      workSlug: summary.workSlug,
      status: summary.protocolStatus,
      sourceDocumentCount: summary.book.source_of_truth?.documents?.length ?? 0,
    });
  }

  return repairedBooks;
}

export async function quickstartCreate(args: QuickstartArgs) {
  if (!args.title) {
    throw new Error("create 命令需要提供作品标题。");
  }

  if (args.dryRun) {
    const summary = buildCreateDryRunSummary(args);
    console.log("[AiFiction Quickstart] Dry run");
    console.log(`- Workspace: ${summary.workspaceRoot}`);
    console.log(`- Workspace name: ${summary.workspaceName}`);
    console.log(`- Profile: ${summary.profile}`);
    console.log(`- Bundles: ${summary.bundleIds.join(", ")}`);
    console.log(`- Title: ${summary.title}`);
    console.log(`- Slug: ${summary.slug}`);
    console.log(`- Book root: ${summary.bookRootPath}`);
    console.log(`- Platform: ${summary.targetPlatform}`);
    console.log(`- Target words: ${summary.totalTargetWordCount}`);
    console.log(`- Stop-loss words: ${summary.stopLossWordCount}`);
    console.log(
      `- Chapter target words: ${summary.chapterTargetWordCount.min ?? "?"}-${summary.chapterTargetWordCount.max ?? "?"}`,
    );
    return;
  }

  const title = args.title.trim();
  const rootDirName = (args.rootDirName ?? title).trim();
  const workspaceRoot = resolveWorkspaceRoot();

  const workspaceArgs: InitWorkspaceArgs = {
    command: "init",
    workspaceName: args.workspaceName,
    bundleIds: [],
    defaultProfileKey: args.profileKey,
    dryRun: false,
  };
  await initWorkspace(workspaceArgs);

  const bookArgs: InitBookArgs = {
    command: "create",
    title,
    profileKey: args.profileKey,
    tagline: args.tagline,
    genre: args.genre,
    subgenre: args.subgenre,
    slug: args.slug,
    rootDirName: args.rootDirName,
    dryRun: false,
  };
  await createBook(bookArgs);

  const bookFilePath = path.join(workspaceRoot, "books", rootDirName, "book.yml");
  const book = readBookFile(bookFilePath);
  const workSlug = book?.book_id ?? args.slug;
  const protocolService = new WorkspaceProtocolService();
  const summary = args.verify && workSlug ? await protocolService.getWorkProtocolSummaryBySlug(workSlug) : null;
  const sourceDocumentPaths =
    book?.source_of_truth?.documents
      ?.map((document) => document.relative_path)
      .filter((value): value is string => typeof value === "string" && value.length > 0) ?? [];

  console.log(`[AiFiction Quickstart] Title: ${book?.title ?? title}`);
  console.log(`[AiFiction Quickstart] Profile: ${book?.starter_profile_key ?? args.profileKey ?? "(default)"}`);
  console.log(`[AiFiction Quickstart] Workspace: ${path.join(workspaceRoot, "workspace.yml")}`);
  console.log(`[AiFiction Quickstart] Book: ${bookFilePath}`);
  if (summary) {
    console.log(`[AiFiction Quickstart] Protocol: ${summary.protocolStatus}`);
  }
  if (sourceDocumentPaths.length) {
    console.log(`[AiFiction Quickstart] Source docs: ${sourceDocumentPaths.join(", ")}`);
  }
  console.log("[AiFiction Quickstart] Next: edit source docs, then run npm.cmd run quickstart -- doctor");
}

export async function quickstartDoctor(args: QuickstartArgs) {
  const workspaceRoot = resolveWorkspaceRoot();
  const summary = await buildDoctorSummary(workspaceRoot, args.bookSlug);
  printDoctorSummary(summary);
}

export async function quickstartRepair(args: QuickstartArgs) {
  const workspaceRoot = resolveWorkspaceRoot();
  const workspace = readWorkspaceFile(workspaceRoot);
  if (!workspace) {
    throw new Error("repair 需要先有 workspace.yml。可以先运行 quickstart create 或 workspace:init。");
  }

  if (args.dryRun) {
    console.log("[AiFiction Quickstart] Repair dry run");
    console.log(`- Workspace: ${workspaceRoot}`);
    console.log(`- Target books: ${collectTargetBookSlugs(workspace, args.bookSlug).join(", ") || "(none)"}`);
    console.log("- Actions:");
    console.log("  - normalize compatibility bundles");
    console.log("  - bootstrap work protocols");
    console.log("  - recreate missing source docs");
    console.log("  - print unified doctor summary");
    return;
  }

  const normalization = normalizeWorkspaceCompatibilityBundles(workspaceRoot, { silent: true });
  const previousBundles = normalization.previousConfig.bundles ?? [];
  const nextBundles = normalization.nextConfig.bundles ?? [];
  const repairedBooks = await repairBooks(workspaceRoot, args.bookSlug);
  console.log("[AiFiction Quickstart] Repair:");
  console.log(`- Workspace: ${workspaceRoot}`);
  if (previousBundles.join("|") !== nextBundles.join("|")) {
    console.log(
      `- Bundles normalized: ${previousBundles.join(", ") || "(none)"} -> ${nextBundles.join(", ") || "(none)"}`,
    );
  } else {
    console.log(`- Bundles normalized: no changes (${nextBundles.join(", ") || "(none)"})`);
  }
  if (repairedBooks.length) {
    console.log("- Books:");
    for (const book of repairedBooks) {
      console.log(`  - ${book.workSlug}: protocol=${book.status} / source-docs=${book.sourceDocumentCount}`);
    }
  } else {
    console.log("- Books: (none)");
  }
  const summary = await buildDoctorSummary(workspaceRoot, args.bookSlug);
  printDoctorSummary(summary);
}

async function main() {
  await runQuickstartCommand(process.argv.slice(2));
}

export async function runQuickstartCommand(argv = process.argv.slice(2)) {
  const args = parseQuickstartArgs(argv);
  assertAifictionPreflight(resolveQuickstartPreflight(args));
  if (args.command === "list-profiles") {
    printQuickstartStarterProfiles();
    return;
  }

  if (args.command === "create") {
    await quickstartCreate(args);
    return;
  }

  if (args.command === "doctor") {
    await quickstartDoctor(args);
    return;
  }

  await quickstartRepair(args);
}

function isDirectExecution() {
  const entryPath = process.argv[1];
  if (!entryPath) {
    return false;
  }

  return import.meta.url === pathToFileURL(entryPath).href;
}

if (isDirectExecution()) {
  main()
    .catch((error) => {
      console.error("[AiFiction Quickstart] Error:", error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    })
    .finally(async () => {
      await closeSqliteClient();
    });
}
