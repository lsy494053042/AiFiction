import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import YAML from "yaml";

import { closeSqliteClient, resolveWorkspaceRoot } from "./client";
import { assertAifictionPreflight } from "./preflight";
import { configureAifictionPlugins, ensureWorkspaceAifictionPluginsRegistered, getAifictionPluginRegistry } from "./plugins";
import {
  WorkspaceProtocolService,
  type WorkspaceBookStartersProtocol,
  type WorkspaceStarterProfileProtocol,
} from "./protocol";
import { defaultWorkspaceBookStarters, mergeWorkspaceBookStarters } from "./protocol/starter-profiles";
import { NovelProjectSyncService } from "./sync";
import { NovelWorkbenchMutationService } from "./workbench";

export interface InitBookArgs {
  command: "list-profiles" | "create";
  title?: string;
  profileKey?: string;
  tagline?: string;
  genre?: string;
  subgenre?: string;
  slug?: string;
  rootDirName?: string;
  dryRun: boolean;
}

export function parseInitBookArgs(argv: string[]): InitBookArgs {
  let command: InitBookArgs["command"] = "list-profiles";
  let title: string | undefined;
  let profileKey: string | undefined;
  let tagline: string | undefined;
  let genre: string | undefined;
  let subgenre: string | undefined;
  let slug: string | undefined;
  let rootDirName: string | undefined;
  let dryRun = false;

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    if (current === "list-profiles" || current === "create") {
      command = current;
      continue;
    }
    if (current === "--profile" && next) {
      profileKey = next;
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
    if (current === "--dry-run") {
      dryRun = true;
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
    tagline,
    genre,
    subgenre,
    slug,
    rootDirName,
    dryRun,
  };
}

export function resolveWorkspaceBookStarters(): WorkspaceBookStartersProtocol {
  try {
    const workspaceRoot = resolveWorkspaceRoot();
    ensureWorkspaceAifictionPluginsRegistered(workspaceRoot);

    const workspaceFilePath = path.join(workspaceRoot, "workspace.yml");
    const workspace = fs.existsSync(workspaceFilePath)
      ? (YAML.parse(fs.readFileSync(workspaceFilePath, "utf8")) as { book_starters?: WorkspaceBookStartersProtocol } | undefined)
      : undefined;
    const registry = getAifictionPluginRegistry();

    return mergeWorkspaceBookStarters({
      registeredDefaultProfileKey:
        registry.getPreferredDefaultStarterProfile()?.profile.profile_key ?? defaultWorkspaceBookStarters.default_profile_key,
      registeredProfiles: registry.listStarterProfiles().map((item) => item.profile),
      workspaceStarters: workspace?.book_starters,
    });
  } catch {
    return defaultWorkspaceBookStarters;
  }
}

export function resolveInitBookStarterProfile(
  starters: WorkspaceBookStartersProtocol,
  requestedProfileKey?: string,
): WorkspaceStarterProfileProtocol {
  const profileKey = requestedProfileKey ?? starters.default_profile_key ?? defaultWorkspaceBookStarters.default_profile_key;
  const profile = starters.profiles?.find((item) => item.profile_key === profileKey);
  if (!profile) {
    throw new Error(`找不到 starter profile: ${profileKey}`);
  }
  return profile;
}

export function placeholderMarkdown(
  title: string,
  starterProfile: WorkspaceStarterProfileProtocol,
  docKind: string,
): string {
  switch (docKind) {
    case "project-brief":
      return [
        `# ${title} 作品定位`,
        "",
        `- 启动 profile：${starterProfile.label ?? starterProfile.profile_key ?? "未命名"}`,
        `- 目标平台：${starterProfile.target_platform ?? "待定"}`,
        `- 目标字数：${starterProfile.total_target_word_count ?? "待定"}`,
        `- 止损线：${starterProfile.stop_loss_word_count ?? "待定"}`,
        "",
        "## 一句话概念",
        "待补。",
        "",
        "## 题材卖点",
        "- 待补",
        "",
        "## 核心爽点",
        "- 待补",
        "",
        "## 明确禁区",
        "- 待补",
      ].join("\n");
    case "world-setting":
      return [
        `# ${title} 世界设定`,
        "",
        "## 世界结构",
        "- 待补",
        "",
        "## 核心规则",
        "- 待补",
        "",
        "## 力量/异常/机制",
        "- 待补",
      ].join("\n");
    case "character-setting":
      return [
        `# ${title} 角色设定`,
        "",
        "## 主角/核心中枢",
        "- 待补",
        "",
        "## 核心群像",
        "- 待补",
        "",
        "## 角色锚点",
        "- 待补",
      ].join("\n");
    case "organization-setting":
      return [
        `# ${title} 组织生态设定`,
        "",
        "## 组织结构",
        "- 待补",
        "",
        "## 部门与分层",
        "- 待补",
        "",
        "## 交易/协作/小社会",
        "- 待补",
      ].join("\n");
    case "outline-master":
      return [
        `# ${title} 全书大纲`,
        "",
        `- 启动 profile：${starterProfile.label ?? starterProfile.profile_key ?? "未命名"}`,
        "",
        "## 长线主线",
        "- 待补",
        "",
        "## 分卷/阶段",
        "- 待补",
      ].join("\n");
    case "outline-active-volume":
      return [
        `# ${title} 卷一大纲`,
        "",
        "## 本卷目标",
        "- 待补",
        "",
        "## 本卷阶段拆分",
        "- 待补",
        "",
        "## 全章定位",
        "- 待补",
      ].join("\n");
    default:
      return `# ${title}\n\n待补。\n`;
  }
}

export function ensurePlaceholderDocuments(
  bookRootPath: string,
  bookProtocol: NonNullable<Awaited<ReturnType<WorkspaceProtocolService["getWorkProtocolSummaryBySlug"]>>>["book"],
  starterProfile: WorkspaceStarterProfileProtocol,
  title: string,
) {
  if (!bookProtocol?.source_of_truth?.documents?.length) {
    return;
  }

  for (const document of bookProtocol.source_of_truth.documents) {
    if (!document.relative_path) {
      continue;
    }
    const absolutePath = path.join(bookRootPath, document.relative_path);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    if (!fs.existsSync(absolutePath)) {
      fs.writeFileSync(
        absolutePath,
        `${placeholderMarkdown(title, starterProfile, document.doc_kind ?? "supporting-note")}\n`,
        "utf8",
      );
    }
  }
}

function applyStarterProfileWorkspacePlugins(workspaceFilePath: string, starterProfile: WorkspaceStarterProfileProtocol) {
  if (!fs.existsSync(workspaceFilePath)) {
    return;
  }

  const pluginBundles = starterProfile.plugin_bundles ?? [];
  if (!pluginBundles.length) {
    return;
  }

  const workspace = (YAML.parse(fs.readFileSync(workspaceFilePath, "utf8")) ?? {}) as Record<string, any>;
  const currentBundles = Array.isArray(workspace.plugins?.bundles) ? workspace.plugins.bundles : [];

  workspace.plugins = {
    ...workspace.plugins,
    api_version: workspace.plugins?.api_version ?? "1",
    bundles: Array.from(new Set([...currentBundles, ...pluginBundles])),
    enabled: Array.isArray(workspace.plugins?.enabled) ? workspace.plugins.enabled : [],
    disabled: Array.isArray(workspace.plugins?.disabled) ? workspace.plugins.disabled : [],
    strict_mode: workspace.plugins?.strict_mode ?? false,
  };

  fs.writeFileSync(workspaceFilePath, YAML.stringify(workspace), "utf8");
}

export async function createBook(args: InitBookArgs) {
  if (!args.title) {
    throw new Error("create 命令需要提供作品标题。");
  }

  const workspaceRoot = resolveWorkspaceRoot();
  const protocolService = new WorkspaceProtocolService();
  const starters = resolveWorkspaceBookStarters();
  const starterProfile = resolveInitBookStarterProfile(starters, args.profileKey);
  const title = args.title.trim();
  const rootDirName = (args.rootDirName ?? title).trim();
  const tagline = args.tagline ?? `${title}：待补作品卖点`;
  const genre = args.genre ?? starterProfile.genre ?? "未分类";
  const subgenre = args.subgenre ?? starterProfile.subgenre;
  const targetPlatform = starterProfile.target_platform ?? "未配置";
  const targetWordCount = starterProfile.total_target_word_count ?? 300000;
  const dailyWordTarget = starterProfile.daily_word_target ?? 3000;
  const updateCadence = starterProfile.update_cadence ?? "未配置";
  const pluginBundles = starterProfile.plugin_bundles ?? [];
  const bookRootPath = path.join(workspaceRoot, "books", rootDirName);

  if (args.dryRun) {
    console.log(
      JSON.stringify(
        {
          command: "create",
          title,
          profile: starterProfile.profile_key,
          rootDirName,
          targetPlatform,
          targetWordCount,
          dailyWordTarget,
          updateCadence,
          pluginBundles,
          bookRootPath,
        },
        null,
        2,
      ),
    );
    return;
  }

  const mutationService = new NovelWorkbenchMutationService();
  const syncService = new NovelProjectSyncService();
  const work = await mutationService.createWork({
    title,
    slug: args.slug,
    tagline,
    genre,
    subgenre,
    targetPlatform,
    targetWordCount,
    dailyWordTarget,
    updateCadence,
    hardConstraints: starterProfile.hard_constraints,
  });

  await syncService.bindProjectFileSource({
    projectId: work.id,
    sourceKey: "primary-manuscript",
    label: `${work.title} Primary Manuscript`,
    rootPath: bookRootPath,
    chapterPath: "02-正文",
    outlinePath: "01-大纲",
    exportPath: "03-中间产物",
    scanPolicy: {
      includeExtensions: [".md", ".txt"],
      excludeDirectories: [".git", "node_modules", "dist"],
    },
  });

  const bootstrapped = await protocolService.bootstrapWorkProtocolBySlug(work.slug);
  if (!bootstrapped?.book) {
    throw new Error("作品协议初始化失败。");
  }

  applyStarterProfileWorkspacePlugins(path.join(workspaceRoot, "workspace.yml"), starterProfile);

  const bookFilePath = bootstrapped.bookFilePath;
  const book = (YAML.parse(fs.readFileSync(bookFilePath, "utf8")) ?? {}) as Record<string, any>;
  book.starter_profile_key = starterProfile.profile_key;
  book.genre = genre;
  book.platform = targetPlatform;
  book.publication = {
    ...book.publication,
    target_platform: targetPlatform,
    target_platform_locked: true,
    total_target_word_count: targetWordCount,
    total_target_word_count_locked: true,
    stop_loss_word_count: starterProfile.stop_loss_word_count,
    stop_loss_word_count_locked: Boolean(starterProfile.stop_loss_word_count),
    chapter_target_word_count: {
      min: starterProfile.chapter_target_word_count?.min ?? book.publication?.chapter_target_word_count?.min ?? 2000,
      max: starterProfile.chapter_target_word_count?.max ?? book.publication?.chapter_target_word_count?.max ?? 2500,
      locked: true,
    },
    daily_word_target: dailyWordTarget,
    update_cadence: updateCadence,
  };
  book.evaluation_policy = {
    ...book.evaluation_policy,
    override_stop_loss_word_count: starterProfile.stop_loss_word_count,
  };
  book.current_focus = {
    ...book.current_focus,
    task_type: starterProfile.focus_task_type ?? book.current_focus?.task_type,
    task_label: starterProfile.focus_task_label ?? book.current_focus?.task_label,
    goal: starterProfile.focus_goal ?? book.current_focus?.goal,
    summary: starterProfile.focus_summary ?? book.current_focus?.summary,
  };
  book.hard_constraints = starterProfile.hard_constraints?.length ? starterProfile.hard_constraints : book.hard_constraints;
  book.planning_budget = {
    ...book.planning_budget,
    chapter_target_chars: {
      min: starterProfile.chapter_target_word_count?.min ?? book.planning_budget?.chapter_target_chars?.min ?? 2000,
      max: starterProfile.chapter_target_word_count?.max ?? book.planning_budget?.chapter_target_chars?.max ?? 2500,
    },
  };
  book.prewrite_gate = {
    ...book.prewrite_gate,
    current_platform_locked: true,
    current_total_target_locked: true,
    current_stop_loss_locked: Boolean(starterProfile.stop_loss_word_count),
    current_chapter_target_locked: true,
  };

  fs.writeFileSync(bookFilePath, YAML.stringify(book), "utf8");

  configureAifictionPlugins({
    source: "workspace",
    workspaceRoot,
    reset: true,
  });

  const finalized = await protocolService.bootstrapWorkProtocolBySlug(work.slug);
  if (!finalized?.book) {
    throw new Error("作品协议二次引导失败。");
  }

  fs.mkdirSync(bookRootPath, { recursive: true });
  fs.mkdirSync(path.join(bookRootPath, "00-设定"), { recursive: true });
  fs.mkdirSync(path.join(bookRootPath, "01-大纲"), { recursive: true });
  fs.mkdirSync(path.join(bookRootPath, "02-正文"), { recursive: true });
  fs.mkdirSync(path.join(bookRootPath, "03-中间产物", "context-packs"), { recursive: true });
  ensurePlaceholderDocuments(bookRootPath, finalized.book, starterProfile, title);

  console.log(`[AiFiction Init Book] Created: ${work.title} (${work.slug})`);
  console.log(`[AiFiction Init Book] Profile: ${starterProfile.profile_key}`);
  console.log(`[AiFiction Init Book] Root: ${bookRootPath}`);
  console.log(`[AiFiction Init Book] Bundles: ${pluginBundles.join(", ") || "(none)"}`);
  console.log(`[AiFiction Init Book] Book file: ${bookFilePath}`);
}

async function main() {
  await runInitBookCommand(process.argv.slice(2));
}

export async function runInitBookCommand(argv = process.argv.slice(2)) {
  const args = parseInitBookArgs(argv);
  assertAifictionPreflight({
    commandLabel: `books:init:${args.command}`,
    mode: args.command === "list-profiles" ? "bootstrap" : "workspace",
  });
  const starters = resolveWorkspaceBookStarters();

  if (args.command === "list-profiles") {
    console.log(JSON.stringify(starters, null, 2));
    return;
  }

  await createBook(args);
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
      console.error("[AiFiction Init Book] Error:", error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    })
    .finally(async () => {
      await closeSqliteClient();
    });
}
