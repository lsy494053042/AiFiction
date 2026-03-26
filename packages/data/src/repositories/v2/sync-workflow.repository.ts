import { randomUUID } from "node:crypto";

import { and, desc, eq } from "drizzle-orm";

import { type SqliteClient, getSqliteClient } from "../../client";
import { ensureSqliteV2Bootstrap } from "../../v2/bootstrap";
import {
  assetUpdatesV2Table,
  reviewQueueV2Table,
  sourceRefsV2Table,
  syncRunItemsV2Table,
  syncRunsV2Table,
} from "../../v2";
import { buildLifecycleValues, nowIsoString } from "./repository-base";

export interface SyncReviewQueueRecord {
  id: string;
  projectId: string;
  syncRunId?: string;
  sourceDocumentId?: string;
  assetUpdateId?: string;
  sourceType: string;
  sourceId?: string;
  reviewKind: string;
  severity: string;
  status: string;
  summary: string;
  detailJson: Record<string, unknown>;
  decisionNote?: string;
  decidedAt?: string;
  updatedAt: string;
}

export interface SyncAssetUpdateRecord {
  id: string;
  projectId: string;
  syncRunId?: string;
  sourceDocumentId?: string;
  assetType: string;
  assetId?: string;
  updateKind: string;
  confidenceLevel: string;
  proposedPayloadJson: Record<string, unknown>;
  appliedStatus: string;
  appliedAt?: string;
  updatedAt: string;
}

/**
 * SQLite 下的同步工作流仓储。
 * 负责目录扫描运行记录、建议更新、审查项与来源引用等运行态数据。
 */
export class SqliteSyncWorkflowRepository {
  constructor(private readonly client: SqliteClient = getSqliteClient()) {}

  async startSyncRun(input: {
    projectId: string;
    fileSourceId?: string;
    runKind: string;
    triggerMode: string;
  }): Promise<string> {
    await ensureSqliteV2Bootstrap(this.client);

    const timestamp = nowIsoString();
    const runId = randomUUID();

    await this.client.db.insert(syncRunsV2Table).values({
      id: runId,
      projectId: input.projectId,
      fileSourceId: input.fileSourceId ?? null,
      runKind: input.runKind,
      triggerMode: input.triggerMode,
      runStatus: "running",
      scannedCount: 0,
      changedCount: 0,
      startedAt: timestamp,
      finishedAt: null,
      errorSummary: null,
      ...buildLifecycleValues({
        status: "running",
        timestamp,
        metaJson: { source: "sync-workflow-repository" },
        extraJson: {},
      }),
    });

    return runId;
  }

  async finishSyncRun(input: {
    runId: string;
    runStatus: string;
    scannedCount: number;
    changedCount: number;
    errorSummary?: string;
  }): Promise<void> {
    await ensureSqliteV2Bootstrap(this.client);

    const timestamp = nowIsoString();
    const [existingRun] = await this.client.db
      .select({ createdAt: syncRunsV2Table.createdAt, version: syncRunsV2Table.version })
      .from(syncRunsV2Table)
      .where(eq(syncRunsV2Table.id, input.runId))
      .limit(1);

    if (!existingRun) {
      return;
    }

    await this.client.db
      .update(syncRunsV2Table)
      .set({
        runStatus: input.runStatus,
        scannedCount: input.scannedCount,
        changedCount: input.changedCount,
        finishedAt: timestamp,
        errorSummary: input.errorSummary ?? null,
        ...buildLifecycleValues({
          existing: existingRun,
          status: input.runStatus,
          timestamp,
          metaJson: { source: "sync-workflow-repository" },
          extraJson: {},
        }),
      })
      .where(eq(syncRunsV2Table.id, input.runId));
  }

  async saveSyncRunItem(input: {
    id?: string;
    syncRunId: string;
    sourceDocumentId?: string;
    changeKind: string;
    processingStatus: string;
    generatedArtifactId?: string;
    generatedArtifactVersionId?: string;
    summary?: string;
    errorMessage?: string;
  }): Promise<string> {
    await ensureSqliteV2Bootstrap(this.client);

    const timestamp = nowIsoString();
    const itemId = input.id ?? randomUUID();
    const [existingRow] = await this.client.db
      .select({ createdAt: syncRunItemsV2Table.createdAt, version: syncRunItemsV2Table.version })
      .from(syncRunItemsV2Table)
      .where(eq(syncRunItemsV2Table.id, itemId))
      .limit(1);

    await this.client.db
      .insert(syncRunItemsV2Table)
      .values({
        id: itemId,
        syncRunId: input.syncRunId,
        sourceDocumentId: input.sourceDocumentId ?? null,
        changeKind: input.changeKind,
        processingStatus: input.processingStatus,
        generatedArtifactId: input.generatedArtifactId ?? null,
        generatedArtifactVersionId: input.generatedArtifactVersionId ?? null,
        summary: input.summary ?? null,
        errorMessage: input.errorMessage ?? null,
        ...buildLifecycleValues({
          existing: existingRow,
          status: input.processingStatus,
          timestamp,
          metaJson: { source: "sync-workflow-repository" },
          extraJson: {},
        }),
      })
      .onConflictDoUpdate({
        target: syncRunItemsV2Table.id,
        set: {
          syncRunId: input.syncRunId,
          sourceDocumentId: input.sourceDocumentId ?? null,
          changeKind: input.changeKind,
          processingStatus: input.processingStatus,
          generatedArtifactId: input.generatedArtifactId ?? null,
          generatedArtifactVersionId: input.generatedArtifactVersionId ?? null,
          summary: input.summary ?? null,
          errorMessage: input.errorMessage ?? null,
          ...buildLifecycleValues({
            existing: existingRow,
            status: input.processingStatus,
            timestamp,
            metaJson: { source: "sync-workflow-repository" },
            extraJson: {},
          }),
        },
      });

    return itemId;
  }

  async listReviewQueue(projectId: string, status?: string): Promise<SyncReviewQueueRecord[]> {
    await ensureSqliteV2Bootstrap(this.client);

    const rows = status
      ? await this.client.db
          .select()
          .from(reviewQueueV2Table)
          .where(and(eq(reviewQueueV2Table.projectId, projectId), eq(reviewQueueV2Table.status, status)))
          .orderBy(desc(reviewQueueV2Table.updatedAt))
      : await this.client.db
          .select()
          .from(reviewQueueV2Table)
          .where(eq(reviewQueueV2Table.projectId, projectId))
          .orderBy(desc(reviewQueueV2Table.updatedAt));

    return rows.map((row) => this.mapReviewRow(row));
  }

  async getReviewItemById(reviewId: string): Promise<SyncReviewQueueRecord | null> {
    await ensureSqliteV2Bootstrap(this.client);

    const rows = await this.client.db.select().from(reviewQueueV2Table).where(eq(reviewQueueV2Table.id, reviewId)).limit(1);
    const row = rows[0];
    return row ? this.mapReviewRow(row) : null;
  }

  /**
   * 读取建议更新记录。
   * 这层主要给 smoke、后续审查页和自动回写流程复用。
   */
  async listAssetUpdates(input: {
    projectId: string;
    sourceDocumentId?: string;
    assetType?: string;
    appliedStatus?: string;
  }): Promise<SyncAssetUpdateRecord[]> {
    await ensureSqliteV2Bootstrap(this.client);

    const filters = [eq(assetUpdatesV2Table.projectId, input.projectId)];
    if (input.sourceDocumentId) {
      filters.push(eq(assetUpdatesV2Table.sourceDocumentId, input.sourceDocumentId));
    }
    if (input.assetType) {
      filters.push(eq(assetUpdatesV2Table.assetType, input.assetType));
    }
    if (input.appliedStatus) {
      filters.push(eq(assetUpdatesV2Table.appliedStatus, input.appliedStatus));
    }

    const rows = await this.client.db
      .select()
      .from(assetUpdatesV2Table)
      .where(and(...filters))
      .orderBy(desc(assetUpdatesV2Table.updatedAt));

    return rows.map((row) => this.mapAssetUpdateRow(row));
  }

  async getAssetUpdateById(updateId: string): Promise<SyncAssetUpdateRecord | null> {
    await ensureSqliteV2Bootstrap(this.client);

    const rows = await this.client.db.select().from(assetUpdatesV2Table).where(eq(assetUpdatesV2Table.id, updateId)).limit(1);
    const row = rows[0];
    return row ? this.mapAssetUpdateRow(row) : null;
  }

  async saveAssetUpdate(input: {
    id?: string;
    projectId: string;
    syncRunId?: string;
    sourceDocumentId?: string;
    assetType: string;
    assetId?: string;
    updateKind: string;
    confidenceLevel: string;
    proposedPayloadJson: Record<string, unknown>;
    appliedStatus: string;
    appliedAt?: string;
  }): Promise<string> {
    await ensureSqliteV2Bootstrap(this.client);

    const timestamp = nowIsoString();
    const updateId = input.id ?? randomUUID();
    const [existingRow] = await this.client.db
      .select({ createdAt: assetUpdatesV2Table.createdAt, version: assetUpdatesV2Table.version })
      .from(assetUpdatesV2Table)
      .where(eq(assetUpdatesV2Table.id, updateId))
      .limit(1);

    await this.client.db
      .insert(assetUpdatesV2Table)
      .values({
        id: updateId,
        projectId: input.projectId,
        syncRunId: input.syncRunId ?? null,
        sourceDocumentId: input.sourceDocumentId ?? null,
        assetType: input.assetType,
        assetId: input.assetId ?? null,
        updateKind: input.updateKind,
        confidenceLevel: input.confidenceLevel,
        proposedPayloadJson: input.proposedPayloadJson,
        appliedStatus: input.appliedStatus,
        appliedAt: input.appliedAt ?? null,
        ...buildLifecycleValues({
          existing: existingRow,
          status: input.appliedStatus,
          timestamp,
          metaJson: { source: "sync-workflow-repository" },
          extraJson: {},
        }),
      })
      .onConflictDoUpdate({
        target: assetUpdatesV2Table.id,
        set: {
          projectId: input.projectId,
          syncRunId: input.syncRunId ?? null,
          sourceDocumentId: input.sourceDocumentId ?? null,
          assetType: input.assetType,
          assetId: input.assetId ?? null,
          updateKind: input.updateKind,
          confidenceLevel: input.confidenceLevel,
          proposedPayloadJson: input.proposedPayloadJson,
          appliedStatus: input.appliedStatus,
          appliedAt: input.appliedAt ?? null,
          ...buildLifecycleValues({
            existing: existingRow,
            status: input.appliedStatus,
            timestamp,
            metaJson: { source: "sync-workflow-repository" },
            extraJson: {},
          }),
        },
      });

    return updateId;
  }

  async enqueueReviewItem(input: Omit<SyncReviewQueueRecord, "id" | "updatedAt"> & { id?: string }): Promise<string> {
    await ensureSqliteV2Bootstrap(this.client);

    const timestamp = nowIsoString();
    const reviewId = input.id ?? randomUUID();
    const [existingRow] = await this.client.db
      .select({ createdAt: reviewQueueV2Table.createdAt, version: reviewQueueV2Table.version })
      .from(reviewQueueV2Table)
      .where(eq(reviewQueueV2Table.id, reviewId))
      .limit(1);

    await this.client.db
      .insert(reviewQueueV2Table)
      .values({
        id: reviewId,
        projectId: input.projectId,
        syncRunId: input.syncRunId ?? null,
        sourceDocumentId: input.sourceDocumentId ?? null,
        assetUpdateId: input.assetUpdateId ?? null,
        sourceType: input.sourceType,
        sourceId: input.sourceId ?? null,
        reviewKind: input.reviewKind,
        severity: input.severity,
        summary: input.summary,
        detailJson: input.detailJson,
        decisionNote: input.decisionNote ?? null,
        decidedAt: input.decidedAt ?? null,
        ...buildLifecycleValues({
          existing: existingRow,
          status: input.status,
          timestamp,
          metaJson: { source: "sync-workflow-repository" },
          extraJson: {},
        }),
      })
      .onConflictDoUpdate({
        target: reviewQueueV2Table.id,
        set: {
          projectId: input.projectId,
          syncRunId: input.syncRunId ?? null,
          sourceDocumentId: input.sourceDocumentId ?? null,
          assetUpdateId: input.assetUpdateId ?? null,
          sourceType: input.sourceType,
          sourceId: input.sourceId ?? null,
          reviewKind: input.reviewKind,
          severity: input.severity,
          summary: input.summary,
          detailJson: input.detailJson,
          decisionNote: input.decisionNote ?? null,
          decidedAt: input.decidedAt ?? null,
          ...buildLifecycleValues({
            existing: existingRow,
            status: input.status,
            timestamp,
            metaJson: { source: "sync-workflow-repository" },
            extraJson: {},
          }),
        },
      });

    return reviewId;
  }

  async saveSourceRef(input: {
    id?: string;
    projectId: string;
    assetType: string;
    assetId: string;
    sourceDocumentId?: string;
    artifactVersionId?: string;
    referenceKind: string;
    locator: string;
    evidenceQuote?: string;
  }): Promise<string> {
    await ensureSqliteV2Bootstrap(this.client);

    const timestamp = nowIsoString();
    const sourceRefId = input.id ?? randomUUID();
    const [existingRow] = await this.client.db
      .select({ createdAt: sourceRefsV2Table.createdAt, version: sourceRefsV2Table.version })
      .from(sourceRefsV2Table)
      .where(eq(sourceRefsV2Table.id, sourceRefId))
      .limit(1);

    await this.client.db
      .insert(sourceRefsV2Table)
      .values({
        id: sourceRefId,
        projectId: input.projectId,
        assetType: input.assetType,
        assetId: input.assetId,
        sourceDocumentId: input.sourceDocumentId ?? null,
        artifactVersionId: input.artifactVersionId ?? null,
        referenceKind: input.referenceKind,
        locator: input.locator,
        evidenceQuote: input.evidenceQuote ?? null,
        ...buildLifecycleValues({
          existing: existingRow,
          status: "active",
          timestamp,
          metaJson: { source: "sync-workflow-repository" },
          extraJson: {},
        }),
      })
      .onConflictDoUpdate({
        target: sourceRefsV2Table.id,
        set: {
          projectId: input.projectId,
          assetType: input.assetType,
          assetId: input.assetId,
          sourceDocumentId: input.sourceDocumentId ?? null,
          artifactVersionId: input.artifactVersionId ?? null,
          referenceKind: input.referenceKind,
          locator: input.locator,
          evidenceQuote: input.evidenceQuote ?? null,
          ...buildLifecycleValues({
            existing: existingRow,
            status: "active",
            timestamp,
            metaJson: { source: "sync-workflow-repository" },
            extraJson: {},
          }),
        },
      });

    return sourceRefId;
  }

  private mapReviewRow(row: typeof reviewQueueV2Table.$inferSelect): SyncReviewQueueRecord {
    return {
      id: row.id,
      projectId: row.projectId,
      syncRunId: row.syncRunId ?? undefined,
      sourceDocumentId: row.sourceDocumentId ?? undefined,
      assetUpdateId: row.assetUpdateId ?? undefined,
      sourceType: row.sourceType,
      sourceId: row.sourceId ?? undefined,
      reviewKind: row.reviewKind,
      severity: row.severity,
      status: row.status,
      summary: row.summary,
      detailJson: row.detailJson as Record<string, unknown>,
      decisionNote: row.decisionNote ?? undefined,
      decidedAt: row.decidedAt ?? undefined,
      updatedAt: row.updatedAt,
    };
  }

  private mapAssetUpdateRow(row: typeof assetUpdatesV2Table.$inferSelect): SyncAssetUpdateRecord {
    return {
      id: row.id,
      projectId: row.projectId,
      syncRunId: row.syncRunId ?? undefined,
      sourceDocumentId: row.sourceDocumentId ?? undefined,
      assetType: row.assetType,
      assetId: row.assetId ?? undefined,
      updateKind: row.updateKind,
      confidenceLevel: row.confidenceLevel,
      proposedPayloadJson: row.proposedPayloadJson as Record<string, unknown>,
      appliedStatus: row.appliedStatus,
      appliedAt: row.appliedAt ?? undefined,
      updatedAt: row.updatedAt,
    };
  }
}