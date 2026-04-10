import fs from "node:fs";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";

import { schema } from "./schema";
import { v2Schema } from "./v2";

export const sqliteSchema = {
  ...schema,
  ...v2Schema,
};

export interface SqliteClient {
  sqlite: Client;
  db: LibSQLDatabase<typeof sqliteSchema>;
  databasePath: string;
  connectionUrl: string;
}

let cachedClient: SqliteClient | null = null;

function readJsonFile(filePath: string): unknown {
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(raw);
}

function isWorkspaceRoot(candidate: string): boolean {
  const packageJsonPath = path.join(candidate, "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    return false;
  }

  try {
    const packageJson = readJsonFile(packageJsonPath) as {
      workspaces?: string[];
    };
    return Array.isArray(packageJson.workspaces);
  } catch {
    return false;
  }
}

function findWorkspaceRootFrom(startDirectory: string): string | null {
  let currentDirectory = path.resolve(startDirectory);

  while (true) {
    if (isWorkspaceRoot(currentDirectory)) {
      return currentDirectory;
    }

    const parentDirectory = path.dirname(currentDirectory);
    if (parentDirectory === currentDirectory) {
      return null;
    }

    currentDirectory = parentDirectory;
  }
}

/**
 * 从当前执行目录向上查找 monorepo 根目录。
 * 这样无论命令从根目录还是 workspace 目录触发，都能定位到同一个数据库文件。
 * 同时优先兼容 npm workspace 下的 INIT_CWD 和显式工作区根目录环境变量。
 */
export function resolveWorkspaceRoot(startDirectory = process.cwd()): string {
  const candidates = [
    process.env.AIFICTION_WORKSPACE_ROOT,
    process.env.INIT_CWD,
    startDirectory,
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => path.resolve(value));

  for (const candidate of candidates) {
    const resolved = findWorkspaceRootFrom(candidate);
    if (resolved) {
      return resolved;
    }
  }

  throw new Error("Unable to locate the AiFiction workspace root.");
}

/**
 * 解析 SQLite 文件路径。
 * 首版默认把数据库文件放到 storage/db/aifiction.sqlite，便于备份和迁移。
 */
export function resolveSqlitePath(customPath?: string): string {
  if (customPath) {
    return path.resolve(customPath);
  }

  if (process.env.AIFICTION_DB_PATH) {
    return path.resolve(process.env.AIFICTION_DB_PATH);
  }

  return path.join(resolveWorkspaceRoot(), "storage", "db", "aifiction.sqlite");
}

function toFileUrl(databasePath: string): string {
  return `file:${databasePath.replace(/\\/g, "/")}`;
}

/**
 * 创建底层 SQLite 客户端和 Drizzle ORM 句柄。
 * V1 与 V2 表结构都会挂到同一个 db 句柄上，便于并行演进。
 */
export function createSqliteClient(customPath?: string): SqliteClient {
  const databasePath = resolveSqlitePath(customPath);
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });

  const connectionUrl = toFileUrl(databasePath);
  const sqlite = createClient({
    url: connectionUrl,
  });

  return {
    sqlite,
    db: drizzle(sqlite, { schema: sqliteSchema }),
    databasePath,
    connectionUrl,
  };
}

/**
 * 返回进程级单例客户端。
 * 这样 Worker、CLI 或后续 API Route 都不会重复打开连接。
 */
export function getSqliteClient(customPath?: string): SqliteClient {
  if (!cachedClient || customPath) {
    cachedClient = createSqliteClient(customPath);
  }

  return cachedClient;
}

export async function closeSqliteClient(): Promise<void> {
  if (!cachedClient) {
    return;
  }

  const client = cachedClient;
  cachedClient = null;
  await Promise.resolve(client.sqlite.close());
  // Give Windows a brief settle window so temp smoke workspaces can release file handles.
  await delay(150);
}
