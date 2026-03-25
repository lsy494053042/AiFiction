import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { SqliteClient } from "../client";
import { getSqliteClient, resolveWorkspaceRoot } from "../client";
import { ensureSqliteBootstrap } from "../bootstrap";

const drizzleMigrationsTable = "__drizzle_migrations";
const statementBreakpoint = "--> statement-breakpoint";

interface JournalEntry {
  idx: number;
  when: number;
  tag: string;
}

interface JournalFile {
  entries: JournalEntry[];
}

function resolveDrizzleDirectory(): string {
  return path.join(resolveWorkspaceRoot(), "packages", "data", "drizzle");
}

function resolveJournalPath(): string {
  return path.join(resolveDrizzleDirectory(), "meta", "_journal.json");
}

function normalizeMigrationStatement(statement: string): string {
  const trimmedStatement = statement.trim();
  if (!trimmedStatement) {
    return "";
  }

  if (/^CREATE TABLE /i.test(trimmedStatement)) {
    return trimmedStatement.replace(/^CREATE TABLE /i, "CREATE TABLE IF NOT EXISTS ");
  }

  if (/^CREATE UNIQUE INDEX /i.test(trimmedStatement)) {
    return trimmedStatement.replace(/^CREATE UNIQUE INDEX /i, "CREATE UNIQUE INDEX IF NOT EXISTS ");
  }

  if (/^CREATE INDEX /i.test(trimmedStatement)) {
    return trimmedStatement.replace(/^CREATE INDEX /i, "CREATE INDEX IF NOT EXISTS ");
  }

  return trimmedStatement;
}

async function ensureDrizzleMigrationTable(client: SqliteClient): Promise<void> {
  await client.sqlite.execute(`CREATE TABLE IF NOT EXISTS ${drizzleMigrationsTable} (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    hash TEXT NOT NULL,
    created_at NUMERIC
  )`);
}

async function hasAppliedMigration(client: SqliteClient, when: number): Promise<boolean> {
  const result = await client.sqlite.execute({
    sql: `SELECT created_at FROM ${drizzleMigrationsTable} WHERE created_at = ? LIMIT 1`,
    args: [when],
  });

  return result.rows.length > 0;
}

async function markMigrationApplied(
  client: SqliteClient,
  when: number,
  hash: string,
): Promise<void> {
  await client.sqlite.execute({
    sql: `INSERT INTO ${drizzleMigrationsTable} (hash, created_at) VALUES (?, ?)`,
    args: [hash, when],
  });
}

function readJournalEntries(): JournalEntry[] {
  const journalPath = resolveJournalPath();
  const journal = JSON.parse(fs.readFileSync(journalPath, "utf8")) as JournalFile;
  return [...journal.entries].sort((left, right) => left.idx - right.idx);
}

function readMigrationStatements(tag: string): { sql: string; hash: string; statements: string[] } {
  const migrationPath = path.join(resolveDrizzleDirectory(), `${tag}.sql`);
  const sql = fs.readFileSync(migrationPath, "utf8");
  const hash = createHash("sha256").update(sql).digest("hex");
  const statements = sql
    .split(statementBreakpoint)
    .map((statement) => normalizeMigrationStatement(statement))
    .filter(Boolean);

  return {
    sql,
    hash,
    statements,
  };
}

/**
 * 确保 V2 的基线迁移已经作用到本地 SQLite。
 * 当前先复用 drizzle 产物做一个可重入的本地引导层，避免再手写第二套 V2 SQL。
 */
export async function ensureSqliteV2Bootstrap(client = getSqliteClient()): Promise<string> {
  await ensureSqliteBootstrap();
  await ensureDrizzleMigrationTable(client);

  for (const entry of readJournalEntries()) {
    if (await hasAppliedMigration(client, entry.when)) {
      continue;
    }

    const migration = readMigrationStatements(entry.tag);

    for (const statement of migration.statements) {
      await client.sqlite.execute(statement);
    }

    await markMigrationApplied(client, entry.when, migration.hash);
  }

  return client.databasePath;
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  ensureSqliteV2Bootstrap()
    .then((databasePath) => {
      console.log(`[AiFiction Data] SQLite V2 bootstrap finished: ${databasePath}`);
    })
    .catch((error) => {
      console.error("[AiFiction Data] SQLite V2 bootstrap failed.");
      console.error(error);
      process.exitCode = 1;
    });
}
