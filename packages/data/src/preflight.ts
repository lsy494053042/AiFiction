import fs from "node:fs";
import path from "node:path";

import YAML from "yaml";

import { resolveWorkspaceRoot } from "./client";

export type AifictionPreflightMode = "bootstrap" | "workspace" | "book";

interface WorkspaceLikeFile {
  active_book_id?: string;
  default_book_id?: string;
  book_index?: Array<{
    book_id?: string;
    title?: string;
    root_path?: string;
    book_file?: string;
  }>;
}

export interface AifictionPreflightOptions {
  commandLabel: string;
  workspaceRoot?: string;
  mode: AifictionPreflightMode;
  requestedBookSlug?: string;
}

export interface AifictionPreflightSummary {
  commandLabel: string;
  workspaceRoot: string;
  mode: AifictionPreflightMode;
  coreDocs: Array<{
    label: string;
    relativePath: string;
    exists: boolean;
  }>;
  workspaceFileExists: boolean;
  targetBookSlug?: string;
  targetBookFileExists?: boolean;
  backlogSectionPresent: boolean;
  errors: string[];
}

const coreDocDefinitions = [
  { label: "README", relativePath: "README.md" },
  { label: "Operations Manual", relativePath: "docs/operations/workbench-operations-manual.md" },
  { label: "System Design", relativePath: "docs/architecture/system-design.md" },
  { label: "Project Progress", relativePath: "docs/project/project-progress.md" },
  { label: "Default Architecture Convergence", relativePath: "docs/architecture/default-architecture-convergence.md" },
] as const;

function readWorkspaceFile(workspaceRoot: string): WorkspaceLikeFile | undefined {
  const workspaceFilePath = path.join(workspaceRoot, "workspace.yml");
  if (!fs.existsSync(workspaceFilePath)) {
    return undefined;
  }

  return YAML.parse(fs.readFileSync(workspaceFilePath, "utf8")) as WorkspaceLikeFile | undefined;
}

function resolveTargetBookSlug(workspace: WorkspaceLikeFile | undefined, requestedBookSlug?: string): string | undefined {
  const candidates = [
    requestedBookSlug,
    workspace?.active_book_id,
    workspace?.default_book_id,
    ...(workspace?.book_index?.map((entry) => entry.book_id) ?? []),
  ];

  return candidates.find((value) => typeof value === "string" && value.trim().length > 0)?.trim();
}

function resolveTargetBookFilePath(
  workspaceRoot: string,
  workspace: WorkspaceLikeFile | undefined,
  targetBookSlug?: string,
): string | undefined {
  if (!targetBookSlug) {
    return undefined;
  }

  const matchedEntry = workspace?.book_index?.find((entry) => entry.book_id?.trim() === targetBookSlug);
  const linkedBookFile = matchedEntry?.book_file?.trim();
  if (linkedBookFile) {
    return path.resolve(workspaceRoot, linkedBookFile);
  }

  const linkedRootPath = matchedEntry?.root_path?.trim();
  if (linkedRootPath) {
    return path.resolve(workspaceRoot, linkedRootPath, "book.yml");
  }

  return undefined;
}

function readProjectProgressFacts(workspaceRoot: string) {
  const progressPath = path.join(workspaceRoot, "docs", "project", "project-progress.md");
  if (!fs.existsSync(progressPath)) {
    return {
      backlogSectionPresent: false,
    };
  }

  const content = fs.readFileSync(progressPath, "utf8");
  return {
    backlogSectionPresent: content.includes("## 关账后遗留与补充"),
  };
}

export function runAifictionPreflight(options: AifictionPreflightOptions): AifictionPreflightSummary {
  const workspaceRoot = options.workspaceRoot ? path.resolve(options.workspaceRoot) : resolveWorkspaceRoot();
  const coreDocs = coreDocDefinitions.map((definition) => ({
    ...definition,
    exists: fs.existsSync(path.join(workspaceRoot, definition.relativePath)),
  }));
  const workspaceFilePath = path.join(workspaceRoot, "workspace.yml");
  const workspaceFileExists = fs.existsSync(workspaceFilePath);
  const workspace = workspaceFileExists ? readWorkspaceFile(workspaceRoot) : undefined;
  const targetBookSlug = resolveTargetBookSlug(workspace, options.requestedBookSlug);
  const targetBookFilePath = resolveTargetBookFilePath(workspaceRoot, workspace, targetBookSlug);
  const targetBookFileExists = targetBookFilePath ? fs.existsSync(targetBookFilePath) : undefined;
  const progressFacts = readProjectProgressFacts(workspaceRoot);
  const errors: string[] = [];

  for (const doc of coreDocs) {
    if (!doc.exists) {
      errors.push(`Missing core doc: ${doc.relativePath}`);
    }
  }

  if (options.mode !== "bootstrap" && !workspaceFileExists) {
    errors.push("Missing workspace.yml.");
  }

  if (options.mode === "book") {
    if (!targetBookSlug) {
      errors.push("Unable to resolve current book slug from workspace.yml.");
    } else if (!targetBookFileExists) {
      errors.push(`Missing book.yml for current book: ${targetBookSlug}`);
    }
  }

  if (!progressFacts.backlogSectionPresent) {
    errors.push("Missing backlog section in docs/project/project-progress.md: ## 关账后遗留与补充");
  }

  return {
    commandLabel: options.commandLabel,
    workspaceRoot,
    mode: options.mode,
    coreDocs,
    workspaceFileExists,
    targetBookSlug,
    targetBookFileExists,
    backlogSectionPresent: progressFacts.backlogSectionPresent,
    errors,
  };
}

export function assertAifictionPreflight(options: AifictionPreflightOptions): AifictionPreflightSummary {
  const summary = runAifictionPreflight(options);
  if (summary.errors.length) {
    throw new Error(`[AiFiction Preflight] ${options.commandLabel} blocked.\n- ${summary.errors.join("\n- ")}`);
  }

  return summary;
}

export function formatAifictionPreflightSummary(summary: AifictionPreflightSummary): string {
  return [
    `[AiFiction Preflight] ${summary.commandLabel}`,
    `- mode=${summary.mode}`,
    `- workspace=${summary.workspaceRoot}`,
    `- coreDocs=${summary.coreDocs.filter((doc) => doc.exists).length}/${summary.coreDocs.length}`,
    `- workspaceFile=${summary.workspaceFileExists ? "ok" : "missing"}`,
    `- targetBook=${summary.targetBookSlug ?? "-"}`,
    `- backlogSection=${summary.backlogSectionPresent ? "yes" : "no"}`,
  ].join("\n");
}
