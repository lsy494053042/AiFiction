import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const coreDocPaths = [
  "README.md",
  "docs/operations/workbench-operations-manual.md",
  "docs/architecture/system-design.md",
  "docs/project/project-progress.md",
  "docs/architecture/default-architecture-convergence.md",
] as const;

function copyFileFromRepository(repositoryWorkspaceRoot: string, smokeRoot: string, relativePath: string) {
  const sourcePath = path.join(repositoryWorkspaceRoot, relativePath);
  const targetPath = path.join(smokeRoot, relativePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
}

export interface PrepareSmokeWorkspaceOptions {
  smokeRoot: string;
  repositoryWorkspaceRoot: string;
  packageName?: string;
  includeDrizzle?: boolean;
}

export function prepareAifictionSmokeWorkspace(options: PrepareSmokeWorkspaceOptions) {
  const {
    smokeRoot,
    repositoryWorkspaceRoot,
    packageName = `aifiction-${path.basename(smokeRoot)}`,
    includeDrizzle = true,
  } = options;

  fs.mkdirSync(smokeRoot, { recursive: true });
  fs.writeFileSync(
    path.join(smokeRoot, "package.json"),
    JSON.stringify(
      {
        name: packageName,
        private: true,
        workspaces: [],
      },
      null,
      2,
    ),
    "utf8",
  );

  for (const relativePath of coreDocPaths) {
    copyFileFromRepository(repositoryWorkspaceRoot, smokeRoot, relativePath);
  }

  if (!includeDrizzle) {
    return;
  }

  fs.mkdirSync(path.join(smokeRoot, "packages", "data"), { recursive: true });
  fs.cpSync(
    path.join(repositoryWorkspaceRoot, "packages", "data", "drizzle"),
    path.join(smokeRoot, "packages", "data", "drizzle"),
    { recursive: true },
  );
}

export function scheduleDeferredCleanup(targetPath: string) {
  const cleanupScript = `
    const fs = require("node:fs");
    const targetPath = ${JSON.stringify(targetPath)};
    setTimeout(() => {
      try {
        fs.rmSync(targetPath, {
          recursive: true,
          force: true,
          maxRetries: 20,
          retryDelay: 200,
        });
      } catch {}
    }, 1500);
  `;

  const child = spawn(process.execPath, ["-e", cleanupScript], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
}

function isRetryableCleanupError(error: unknown): error is NodeJS.ErrnoException {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as NodeJS.ErrnoException;
  if (typeof candidate.code !== "string") {
    return false;
  }

  return ["EBUSY", "EPERM", "ENOTEMPTY", "EMFILE"].includes(candidate.code);
}

export interface CleanupSmokeWorkspaceOptions {
  initialDelayMs?: number;
  maxAttempts?: number;
  retryDelayMs?: number;
  scheduleDeferred?: boolean;
}

export interface CleanupSmokeWorkspaceResult {
  status: "removed" | "missing" | "deferred";
  attempts: number;
  lastErrorMessage?: string;
}

export async function cleanupSmokeWorkspace(
  targetPath: string,
  options: CleanupSmokeWorkspaceOptions = {},
): Promise<CleanupSmokeWorkspaceResult> {
  const {
    initialDelayMs = 1000,
    maxAttempts = 20,
    retryDelayMs = 250,
    scheduleDeferred = true,
  } = options;

  if (!fs.existsSync(targetPath)) {
    return {
      status: "missing",
      attempts: 0,
    };
  }

  if (initialDelayMs > 0) {
    await delay(initialDelayMs);
  }

  let lastErrorMessage: string | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      fs.rmSync(targetPath, {
        recursive: true,
        force: true,
      });

      return {
        status: "removed",
        attempts: attempt,
      };
    } catch (error) {
      if (!isRetryableCleanupError(error)) {
        throw error;
      }

      lastErrorMessage = error.message;
      if (attempt < maxAttempts) {
        await delay(retryDelayMs * attempt);
      }
    }
  }

  if (scheduleDeferred) {
    scheduleDeferredCleanup(targetPath);
    return {
      status: "deferred",
      attempts: maxAttempts,
      lastErrorMessage,
    };
  }

  throw new Error(lastErrorMessage ?? `Unable to remove smoke workspace: ${targetPath}`);
}
