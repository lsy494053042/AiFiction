import { asc, eq } from "drizzle-orm";

import { type SqliteClient, getSqliteClient } from "../../client";
import { ensureSqliteV2Bootstrap } from "../../v2/bootstrap";
import { fileSourcesV2Table, sourceDocumentsV2Table } from "../../v2";
import { buildLifecycleValues, nowIsoString } from "./repository-base";

export interface SyncFileSourceRecord {
  id: string;
  projectId: string;
  sourceKey: string;
  label: string;
  sourceKind: string;
  rootPath: string;
  chapterPath?: string;
  outlinePath?: string;
  exportPath?: string;
  scanPolicyJson: Record<string, unknown>;
  isActive: boolean;
  lastScannedAt?: string;
  status: string;
}

export interface SyncSourceDocumentRecord {
  id: string;
  projectId: string;
  fileSourceId: string;
  relativePath: string;
  documentKind: string;
  checksum: string;
  fileSizeBytes?: number;
  lastModifiedAt: string;
  syncStatus: string;
  mappedScopeType?: string;
  mappedScopeId?: string;
  currentArtifactId?: string;
  status: string;
}

/**
 * SQLite 下的同步源仓储。
 * 负责作品与本地目录的绑定关系，以及目录中文件索引的落库。
 */
export class SqliteSyncSourceRepository {
  constructor(private readonly client: SqliteClient = getSqliteClient()) {}

  async saveFileSource(input: SyncFileSourceRecord): Promise<void> {
    await ensureSqliteV2Bootstrap(this.client);

    const timestamp = nowIsoString();
    const [existingRow] = await this.client.db
      .select({ createdAt: fileSourcesV2Table.createdAt, version: fileSourcesV2Table.version })
      .from(fileSourcesV2Table)
      .where(eq(fileSourcesV2Table.id, input.id))
      .limit(1);

    await this.client.db
      .insert(fileSourcesV2Table)
      .values({
        id: input.id,
        projectId: input.projectId,
        sourceKey: input.sourceKey,
        label: input.label,
        sourceKind: input.sourceKind,
        rootPath: input.rootPath,
        chapterPath: input.chapterPath ?? null,
        outlinePath: input.outlinePath ?? null,
        exportPath: input.exportPath ?? null,
        scanPolicyJson: input.scanPolicyJson,
        isActive: input.isActive,
        lastScannedAt: input.lastScannedAt ?? null,
        ...buildLifecycleValues({
          existing: existingRow,
          status: input.status,
          timestamp,
          metaJson: { source: "sync-source-repository" },
          extraJson: {},
        }),
      })
      .onConflictDoUpdate({
        target: fileSourcesV2Table.id,
        set: {
          projectId: input.projectId,
          sourceKey: input.sourceKey,
          label: input.label,
          sourceKind: input.sourceKind,
          rootPath: input.rootPath,
          chapterPath: input.chapterPath ?? null,
          outlinePath: input.outlinePath ?? null,
          exportPath: input.exportPath ?? null,
          scanPolicyJson: input.scanPolicyJson,
          isActive: input.isActive,
          lastScannedAt: input.lastScannedAt ?? null,
          ...buildLifecycleValues({
            existing: existingRow,
            status: input.status,
            timestamp,
            metaJson: { source: "sync-source-repository" },
            extraJson: {},
          }),
        },
      });
  }

  async listFileSources(projectId: string): Promise<SyncFileSourceRecord[]> {
    await ensureSqliteV2Bootstrap(this.client);

    const rows = await this.client.db
      .select()
      .from(fileSourcesV2Table)
      .where(eq(fileSourcesV2Table.projectId, projectId))
      .orderBy(asc(fileSourcesV2Table.label));

    return rows.map((row) => ({
      id: row.id,
      projectId: row.projectId,
      sourceKey: row.sourceKey,
      label: row.label,
      sourceKind: row.sourceKind,
      rootPath: row.rootPath,
      chapterPath: row.chapterPath ?? undefined,
      outlinePath: row.outlinePath ?? undefined,
      exportPath: row.exportPath ?? undefined,
      scanPolicyJson: row.scanPolicyJson as Record<string, unknown>,
      isActive: row.isActive,
      lastScannedAt: row.lastScannedAt ?? undefined,
      status: row.status,
    }));
  }

  async getFileSourceById(id: string): Promise<SyncFileSourceRecord | null> {
    await ensureSqliteV2Bootstrap(this.client);

    const rows = await this.client.db.select().from(fileSourcesV2Table).where(eq(fileSourcesV2Table.id, id)).limit(1);
    const row = rows[0];

    return row
      ? {
          id: row.id,
          projectId: row.projectId,
          sourceKey: row.sourceKey,
          label: row.label,
          sourceKind: row.sourceKind,
          rootPath: row.rootPath,
          chapterPath: row.chapterPath ?? undefined,
          outlinePath: row.outlinePath ?? undefined,
          exportPath: row.exportPath ?? undefined,
          scanPolicyJson: row.scanPolicyJson as Record<string, unknown>,
          isActive: row.isActive,
          lastScannedAt: row.lastScannedAt ?? undefined,
          status: row.status,
        }
      : null;
  }

  async saveSourceDocument(input: SyncSourceDocumentRecord): Promise<void> {
    await ensureSqliteV2Bootstrap(this.client);

    const timestamp = nowIsoString();
    const [existingRow] = await this.client.db
      .select({ createdAt: sourceDocumentsV2Table.createdAt, version: sourceDocumentsV2Table.version })
      .from(sourceDocumentsV2Table)
      .where(eq(sourceDocumentsV2Table.id, input.id))
      .limit(1);

    await this.client.db
      .insert(sourceDocumentsV2Table)
      .values({
        id: input.id,
        projectId: input.projectId,
        fileSourceId: input.fileSourceId,
        relativePath: input.relativePath,
        documentKind: input.documentKind,
        checksum: input.checksum,
        fileSizeBytes: input.fileSizeBytes ?? null,
        lastModifiedAt: input.lastModifiedAt,
        syncStatus: input.syncStatus,
        mappedScopeType: input.mappedScopeType ?? null,
        mappedScopeId: input.mappedScopeId ?? null,
        currentArtifactId: input.currentArtifactId ?? null,
        ...buildLifecycleValues({
          existing: existingRow,
          status: input.status,
          timestamp,
          metaJson: { source: "sync-source-repository" },
          extraJson: {},
        }),
      })
      .onConflictDoUpdate({
        target: sourceDocumentsV2Table.id,
        set: {
          projectId: input.projectId,
          fileSourceId: input.fileSourceId,
          relativePath: input.relativePath,
          documentKind: input.documentKind,
          checksum: input.checksum,
          fileSizeBytes: input.fileSizeBytes ?? null,
          lastModifiedAt: input.lastModifiedAt,
          syncStatus: input.syncStatus,
          mappedScopeType: input.mappedScopeType ?? null,
          mappedScopeId: input.mappedScopeId ?? null,
          currentArtifactId: input.currentArtifactId ?? null,
          ...buildLifecycleValues({
            existing: existingRow,
            status: input.status,
            timestamp,
            metaJson: { source: "sync-source-repository" },
            extraJson: {},
          }),
        },
      });
  }

  async getSourceDocumentById(id: string): Promise<SyncSourceDocumentRecord | null> {
    await ensureSqliteV2Bootstrap(this.client);

    const rows = await this.client.db
      .select()
      .from(sourceDocumentsV2Table)
      .where(eq(sourceDocumentsV2Table.id, id))
      .limit(1);
    const row = rows[0];

    return row
      ? {
          id: row.id,
          projectId: row.projectId,
          fileSourceId: row.fileSourceId,
          relativePath: row.relativePath,
          documentKind: row.documentKind,
          checksum: row.checksum,
          fileSizeBytes: row.fileSizeBytes ?? undefined,
          lastModifiedAt: row.lastModifiedAt,
          syncStatus: row.syncStatus,
          mappedScopeType: row.mappedScopeType ?? undefined,
          mappedScopeId: row.mappedScopeId ?? undefined,
          currentArtifactId: row.currentArtifactId ?? undefined,
          status: row.status,
        }
      : null;
  }

  async listSourceDocuments(fileSourceId: string): Promise<SyncSourceDocumentRecord[]> {
    await ensureSqliteV2Bootstrap(this.client);

    const rows = await this.client.db
      .select()
      .from(sourceDocumentsV2Table)
      .where(eq(sourceDocumentsV2Table.fileSourceId, fileSourceId))
      .orderBy(asc(sourceDocumentsV2Table.relativePath));

    return rows.map((row) => ({
      id: row.id,
      projectId: row.projectId,
      fileSourceId: row.fileSourceId,
      relativePath: row.relativePath,
      documentKind: row.documentKind,
      checksum: row.checksum,
      fileSizeBytes: row.fileSizeBytes ?? undefined,
      lastModifiedAt: row.lastModifiedAt,
      syncStatus: row.syncStatus,
      mappedScopeType: row.mappedScopeType ?? undefined,
      mappedScopeId: row.mappedScopeId ?? undefined,
      currentArtifactId: row.currentArtifactId ?? undefined,
      status: row.status,
    }));
  }
}
