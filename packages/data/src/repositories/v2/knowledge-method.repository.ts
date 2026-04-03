import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";

import { type SqliteClient, getSqliteClient } from "../../client";
import { ensureSqliteV2Bootstrap } from "../../v2/bootstrap";
import {
  knowledgeApplicationsV2Table,
  knowledgeBatchesV2Table,
  knowledgeFindingsV2Table,
  knowledgeGatesV2Table,
  knowledgeItemsV2Table,
  knowledgeProfileRulesV2Table,
  knowledgeProfilesV2Table,
} from "../../v2";
import { buildLifecycleValues, nowIsoString } from "./repository-base";

export interface KnowledgeBatchRecord {
  id: string;
  projectId: string;
  batchKey: string;
  stageLabel?: string;
  focusLabel?: string;
  chapterFrom?: number;
  chapterTo?: number;
  reviewStatus: string;
  sourceReviewFile?: string;
  sourceReviewDataFile?: string;
  sourceCandidatesFile?: string;
  updatedAt: string;
}

export interface KnowledgeFindingRecord {
  id: string;
  batchId: string;
  projectId: string;
  sourceType: string;
  feedbackTier: string;
  domain: string;
  severity: string;
  title: string;
  summary: string;
  sourcePath?: string;
  sourceDocumentId?: string;
  riskNature?: string;
  riskReasons: string[];
  evidencePaths: string[];
  updatedAt: string;
}

export interface KnowledgeItemRecord {
  id: string;
  projectId?: string;
  batchId?: string;
  sourceFindingId?: string;
  scope: string;
  status: string;
  domain: string;
  priority: string;
  title: string;
  summary: string;
  rationale: string;
  prompt?: string;
  validationCount: number;
  profileAffinity: string[];
  evidencePaths: string[];
  updatedAt: string;
}

export interface KnowledgeApplicationRecord {
  id: string;
  knowledgeItemId: string;
  projectId: string;
  batchId: string;
  packKind: string;
  applicationResult: string;
  note?: string;
  updatedAt: string;
}

export interface KnowledgeGateRecord {
  id: string;
  projectId: string;
  batchId: string;
  gateCode: string;
  gateStatus: string;
  note?: string;
  updatedAt: string;
}

export interface KnowledgeProfileRecord {
  id: string;
  ownerKey: string;
  projectId?: string;
  scope: string;
  profileKey: string;
  label: string;
  description?: string;
  status: string;
  updatedAt: string;
}

export interface KnowledgeProfileRuleRecord {
  id: string;
  profileId: string;
  knowledgeItemId: string;
  bindingStatus: string;
  bindingReason?: string;
  updatedAt: string;
}

export interface PersistBatchKnowledgeInput {
  projectId: string;
  batchId: string;
  batchKey: string;
  stageLabel?: string;
  focusLabel?: string;
  chapterFrom?: number;
  chapterTo?: number;
  reviewStatus: string;
  sourceReviewFile?: string;
  sourceReviewDataFile?: string;
  sourceCandidatesFile?: string;
  findings: Array<{
    id: string;
    sourceType: string;
    feedbackTier: string;
    domain: string;
    severity: string;
    title: string;
    summary: string;
    sourcePath?: string;
    sourceDocumentId?: string;
    riskNature?: string;
    riskReasons: string[];
    evidencePaths: string[];
  }>;
  items: Array<{
    id: string;
    scope: string;
    status: string;
    domain: string;
    priority: string;
    title: string;
    summary: string;
    rationale: string;
    prompt?: string;
    validationCount: number;
    profileAffinity: string[];
    evidencePaths: string[];
    sourceFindingIds: string[];
  }>;
}

export interface ReplaceKnowledgeGatesInput {
  projectId: string;
  batchId: string;
  gates: Array<{
    gateCode: string;
    gateStatus: string;
    note?: string;
  }>;
}

export interface RecordKnowledgeApplicationsInput {
  projectId: string;
  batchId: string;
  packKind: string;
  itemIds: string[];
  note?: string;
}

export interface EnsureKnowledgeProfilesInput {
  projectId: string;
  globalProfileKey?: string;
  globalProfileLabel?: string;
  bookProfileKey?: string;
  bookProfileLabel?: string;
}

export interface EnsureKnowledgeProfilesResult {
  globalProfile?: KnowledgeProfileRecord;
  bookProfile?: KnowledgeProfileRecord;
}

export interface BindKnowledgeProfileRulesInput {
  bindings: Array<{
    profileId: string;
    knowledgeItemId: string;
    bindingStatus?: string;
    bindingReason?: string;
  }>;
}

export interface PromoteKnowledgeItemsInput {
  decisions: Array<{
    knowledgeItemId: string;
    nextStatus: string;
    nextScope?: string;
    incrementValidationCount?: number;
    note?: string;
  }>;
}

export interface UpdateKnowledgeApplicationResultsInput {
  projectId: string;
  batchId: string;
  results: Array<{
    knowledgeItemId: string;
    packKind: string;
    applicationResult: string;
    note?: string;
  }>;
}

/**
 * 方法账仓储。
 * 负责把批次复盘、finding、候选经验落到 V2 数据层，并给后续写作包提供稳定读取入口。
 */
export class SqliteKnowledgeMethodRepository {
  constructor(private readonly client: SqliteClient = getSqliteClient()) {}

  async saveBatchKnowledge(input: PersistBatchKnowledgeInput): Promise<void> {
    await ensureSqliteV2Bootstrap(this.client);

    const timestamp = nowIsoString();
    const [existingBatch] = await this.client.db
      .select({ createdAt: knowledgeBatchesV2Table.createdAt, version: knowledgeBatchesV2Table.version })
      .from(knowledgeBatchesV2Table)
      .where(eq(knowledgeBatchesV2Table.id, input.batchId))
      .limit(1);

    await this.client.db.transaction(async (tx) => {
      await tx
        .insert(knowledgeBatchesV2Table)
        .values({
          id: input.batchId,
          projectId: input.projectId,
          batchKey: input.batchKey,
          stageLabel: input.stageLabel ?? null,
          focusLabel: input.focusLabel ?? null,
          chapterFrom: input.chapterFrom ?? null,
          chapterTo: input.chapterTo ?? null,
          reviewStatus: input.reviewStatus,
          sourceReviewFile: input.sourceReviewFile ?? null,
          sourceReviewDataFile: input.sourceReviewDataFile ?? null,
          sourceCandidatesFile: input.sourceCandidatesFile ?? null,
          ...buildLifecycleValues({
            existing: existingBatch,
            status: input.reviewStatus,
            timestamp,
            metaJson: { source: "knowledge-method-repository" },
            extraJson: {},
          }),
        })
        .onConflictDoUpdate({
          target: knowledgeBatchesV2Table.id,
          set: {
            projectId: input.projectId,
            batchKey: input.batchKey,
            stageLabel: input.stageLabel ?? null,
            focusLabel: input.focusLabel ?? null,
            chapterFrom: input.chapterFrom ?? null,
            chapterTo: input.chapterTo ?? null,
            reviewStatus: input.reviewStatus,
            sourceReviewFile: input.sourceReviewFile ?? null,
            sourceReviewDataFile: input.sourceReviewDataFile ?? null,
            sourceCandidatesFile: input.sourceCandidatesFile ?? null,
            ...buildLifecycleValues({
              existing: existingBatch,
              status: input.reviewStatus,
              timestamp,
              metaJson: { source: "knowledge-method-repository" },
              extraJson: {},
            }),
          },
        });

      await tx.delete(knowledgeItemsV2Table).where(eq(knowledgeItemsV2Table.batchId, input.batchId));
      await tx.delete(knowledgeFindingsV2Table).where(eq(knowledgeFindingsV2Table.batchId, input.batchId));

      if (input.findings.length) {
        await tx.insert(knowledgeFindingsV2Table).values(
          input.findings.map((finding) => ({
            id: finding.id,
            batchId: input.batchId,
            projectId: input.projectId,
            sourceType: finding.sourceType,
            feedbackTier: finding.feedbackTier,
            domain: finding.domain,
            severity: finding.severity,
            title: finding.title,
            summary: finding.summary,
            sourcePath: finding.sourcePath ?? null,
            sourceDocumentId: finding.sourceDocumentId ?? null,
            riskNature: finding.riskNature ?? null,
            riskReasons: finding.riskReasons,
            evidencePaths: finding.evidencePaths,
            ...buildLifecycleValues({
              status: "active",
              timestamp,
              metaJson: { source: "knowledge-method-repository" },
              extraJson: {},
            }),
          })),
        );
      }

      if (input.items.length) {
        await tx.insert(knowledgeItemsV2Table).values(
          input.items.map((item) => ({
            id: item.id,
            projectId: input.projectId,
            batchId: input.batchId,
            sourceFindingId: item.sourceFindingIds[0] ?? null,
            scope: item.scope,
            domain: item.domain,
            priority: item.priority,
            title: item.title,
            summary: item.summary,
            rationale: item.rationale,
            prompt: item.prompt ?? null,
            validationCount: item.validationCount,
            profileAffinity: item.profileAffinity,
            evidencePaths: item.evidencePaths,
            ...buildLifecycleValues({
              status: item.status,
              timestamp,
              metaJson: { source: "knowledge-method-repository" },
              extraJson: {
                sourceFindingIds: item.sourceFindingIds,
              },
            }),
          })),
        );
      }
    });
  }

  async listKnowledgeItemsForWritingPack(input: {
    projectId: string;
    limit?: number;
    includeStatuses?: string[];
  }): Promise<KnowledgeItemRecord[]> {
    await ensureSqliteV2Bootstrap(this.client);

    const includeStatuses = input.includeStatuses?.length
      ? input.includeStatuses
      : ["candidate", "active", "book_only", "validated_global"];
    const query = this.client.db
      .select()
      .from(knowledgeItemsV2Table)
      .where(
        and(
          inArray(knowledgeItemsV2Table.status, includeStatuses),
          or(
            eq(knowledgeItemsV2Table.projectId, input.projectId),
            and(eq(knowledgeItemsV2Table.scope, "global"), isNull(knowledgeItemsV2Table.projectId)),
          ),
        ),
      )
      .orderBy(desc(knowledgeItemsV2Table.updatedAt));

    const rows = input.limit ? await query.limit(input.limit) : await query;
    return rows.map((row) => ({
      id: row.id,
      projectId: row.projectId ?? undefined,
      batchId: row.batchId ?? undefined,
      sourceFindingId: row.sourceFindingId ?? undefined,
      scope: row.scope,
      status: row.status,
      domain: row.domain,
      priority: row.priority,
      title: row.title,
      summary: row.summary,
      rationale: row.rationale,
      prompt: row.prompt ?? undefined,
      validationCount: row.validationCount,
      profileAffinity: row.profileAffinity,
      evidencePaths: row.evidencePaths,
      updatedAt: row.updatedAt,
    }));
  }

  async listBatchKnowledgeItems(batchId: string): Promise<KnowledgeItemRecord[]> {
    await ensureSqliteV2Bootstrap(this.client);

    const rows = await this.client.db
      .select()
      .from(knowledgeItemsV2Table)
      .where(eq(knowledgeItemsV2Table.batchId, batchId))
      .orderBy(desc(knowledgeItemsV2Table.updatedAt));

    return rows.map((row) => this.mapKnowledgeItemRow(row));
  }

  async ensureKnowledgeProfiles(
    input: EnsureKnowledgeProfilesInput,
  ): Promise<EnsureKnowledgeProfilesResult> {
    await ensureSqliteV2Bootstrap(this.client);

    const timestamp = nowIsoString();
    const output: EnsureKnowledgeProfilesResult = {};

    if (input.globalProfileKey) {
      output.globalProfile = await this.upsertKnowledgeProfile({
        ownerKey: "workspace",
        projectId: undefined,
        scope: "global",
        profileKey: input.globalProfileKey,
        label: input.globalProfileLabel ?? input.globalProfileKey,
        description: "Workspace-level validated knowledge profile.",
        timestamp,
      });
    }

    if (input.bookProfileKey) {
      output.bookProfile = await this.upsertKnowledgeProfile({
        ownerKey: input.projectId,
        projectId: input.projectId,
        scope: "book",
        profileKey: input.bookProfileKey,
        label: input.bookProfileLabel ?? input.bookProfileKey,
        description: "Book-level active knowledge profile.",
        timestamp,
      });
    }

    return output;
  }

  async bindKnowledgeProfileRules(input: BindKnowledgeProfileRulesInput): Promise<void> {
    await ensureSqliteV2Bootstrap(this.client);

    if (!input.bindings.length) {
      return;
    }

    const timestamp = nowIsoString();
    await this.client.db.transaction(async (tx) => {
      for (const binding of input.bindings) {
        const [existing] = await tx
          .select({ createdAt: knowledgeProfileRulesV2Table.createdAt, version: knowledgeProfileRulesV2Table.version })
          .from(knowledgeProfileRulesV2Table)
          .where(
            and(
              eq(knowledgeProfileRulesV2Table.profileId, binding.profileId),
              eq(knowledgeProfileRulesV2Table.knowledgeItemId, binding.knowledgeItemId),
            ),
          )
          .limit(1);

        await tx
          .insert(knowledgeProfileRulesV2Table)
          .values({
            id: `${binding.profileId}-${binding.knowledgeItemId}`,
            profileId: binding.profileId,
            knowledgeItemId: binding.knowledgeItemId,
            bindingStatus: binding.bindingStatus ?? "active",
            bindingReason: binding.bindingReason ?? null,
            ...buildLifecycleValues({
              existing,
              status: binding.bindingStatus ?? "active",
              timestamp,
              metaJson: { source: "knowledge-method-repository" },
              extraJson: {},
            }),
          })
          .onConflictDoUpdate({
            target: [knowledgeProfileRulesV2Table.profileId, knowledgeProfileRulesV2Table.knowledgeItemId],
            set: {
              bindingStatus: binding.bindingStatus ?? "active",
              bindingReason: binding.bindingReason ?? null,
              ...buildLifecycleValues({
                existing,
                status: binding.bindingStatus ?? "active",
                timestamp,
                metaJson: { source: "knowledge-method-repository" },
                extraJson: {},
              }),
            },
          });
      }
    });
  }

  async promoteKnowledgeItems(input: PromoteKnowledgeItemsInput): Promise<void> {
    await ensureSqliteV2Bootstrap(this.client);

    if (!input.decisions.length) {
      return;
    }

    const timestamp = nowIsoString();
    await this.client.db.transaction(async (tx) => {
      for (const decision of input.decisions) {
        const [existing] = await tx
          .select({
            createdAt: knowledgeItemsV2Table.createdAt,
            version: knowledgeItemsV2Table.version,
            validationCount: knowledgeItemsV2Table.validationCount,
          })
          .from(knowledgeItemsV2Table)
          .where(eq(knowledgeItemsV2Table.id, decision.knowledgeItemId))
          .limit(1);

        if (!existing) {
          continue;
        }

        await tx
          .update(knowledgeItemsV2Table)
          .set({
            scope: decision.nextScope ?? undefined,
            validationCount: existing.validationCount + (decision.incrementValidationCount ?? 0),
            ...buildLifecycleValues({
              existing,
              status: decision.nextStatus,
              timestamp,
              metaJson: { source: "knowledge-method-repository" },
              extraJson: decision.note ? { promotionNote: decision.note } : {},
            }),
          })
          .where(eq(knowledgeItemsV2Table.id, decision.knowledgeItemId));
      }
    });
  }

  async replaceKnowledgeGates(input: ReplaceKnowledgeGatesInput): Promise<void> {
    await ensureSqliteV2Bootstrap(this.client);

    const timestamp = nowIsoString();
    await this.client.db.transaction(async (tx) => {
      await tx.delete(knowledgeGatesV2Table).where(eq(knowledgeGatesV2Table.batchId, input.batchId));

      if (!input.gates.length) {
        return;
      }

      await tx.insert(knowledgeGatesV2Table).values(
        input.gates.map((gate) => ({
          id: `${input.batchId}-${gate.gateCode}`,
          projectId: input.projectId,
          batchId: input.batchId,
          gateCode: gate.gateCode,
          gateStatus: gate.gateStatus,
          note: gate.note ?? null,
          ...buildLifecycleValues({
            status: "active",
            timestamp,
            metaJson: { source: "knowledge-method-repository" },
            extraJson: {},
          }),
        })),
      );
    });
  }

  async recordKnowledgeApplications(input: RecordKnowledgeApplicationsInput): Promise<void> {
    await ensureSqliteV2Bootstrap(this.client);

    if (!input.itemIds.length) {
      return;
    }

    const timestamp = nowIsoString();
    await this.client.db.transaction(async (tx) => {
      const [persistedBatch] = await tx
        .select({ id: knowledgeBatchesV2Table.id })
        .from(knowledgeBatchesV2Table)
        .where(eq(knowledgeBatchesV2Table.id, input.batchId))
        .limit(1);

      if (!persistedBatch) {
        return;
      }

      const persistedItems = await tx
        .select({ id: knowledgeItemsV2Table.id })
        .from(knowledgeItemsV2Table)
        .where(inArray(knowledgeItemsV2Table.id, input.itemIds));

      const persistedItemIds = persistedItems.map((row) => row.id);
      if (!persistedItemIds.length) {
        return;
      }

      const existingRows = await tx
        .select({
          id: knowledgeApplicationsV2Table.id,
          knowledgeItemId: knowledgeApplicationsV2Table.knowledgeItemId,
          applicationResult: knowledgeApplicationsV2Table.applicationResult,
          note: knowledgeApplicationsV2Table.note,
          createdAt: knowledgeApplicationsV2Table.createdAt,
          version: knowledgeApplicationsV2Table.version,
        })
        .from(knowledgeApplicationsV2Table)
        .where(
          and(
            eq(knowledgeApplicationsV2Table.batchId, input.batchId),
            eq(knowledgeApplicationsV2Table.packKind, input.packKind),
          ),
        );

      const existingByItemId = new Map(existingRows.map((row) => [row.knowledgeItemId, row]));
      const activeItemIds = new Set(persistedItemIds);

      const staleRows = existingRows.filter((row) => !activeItemIds.has(row.knowledgeItemId));
      if (staleRows.length) {
        for (const staleRow of staleRows) {
          await tx
            .update(knowledgeApplicationsV2Table)
            .set({
              note: staleRow.note ?? "Archived because the knowledge item is no longer active in the current pack.",
              ...buildLifecycleValues({
                existing: staleRow,
                status: "archived",
                timestamp,
                metaJson: { source: "knowledge-method-repository" },
                extraJson: {},
              }),
            })
            .where(eq(knowledgeApplicationsV2Table.id, staleRow.id));
        }
      }

      for (const itemId of persistedItemIds) {
        const existing = existingByItemId.get(itemId);
        await tx
          .insert(knowledgeApplicationsV2Table)
          .values({
            id: `${input.batchId}-${input.packKind}-${itemId}`,
            knowledgeItemId: itemId,
            projectId: input.projectId,
            batchId: input.batchId,
            packKind: input.packKind,
            applicationResult: existing?.applicationResult ?? "applied",
            note: existing?.note ?? input.note ?? null,
            ...buildLifecycleValues({
              existing,
              status: "active",
              timestamp,
              metaJson: { source: "knowledge-method-repository" },
              extraJson: {},
            }),
          })
          .onConflictDoUpdate({
            target: [
              knowledgeApplicationsV2Table.batchId,
              knowledgeApplicationsV2Table.knowledgeItemId,
              knowledgeApplicationsV2Table.packKind,
            ],
            set: {
              projectId: input.projectId,
              applicationResult: existing?.applicationResult ?? "applied",
              note: existing?.note ?? input.note ?? null,
              ...buildLifecycleValues({
                existing,
                status: "active",
                timestamp,
                metaJson: { source: "knowledge-method-repository" },
                extraJson: {},
              }),
            },
          });
      }
    });
  }

  async updateKnowledgeApplicationResults(
    input: UpdateKnowledgeApplicationResultsInput,
  ): Promise<void> {
    await ensureSqliteV2Bootstrap(this.client);

    if (!input.results.length) {
      return;
    }

    const timestamp = nowIsoString();
    await this.client.db.transaction(async (tx) => {
      for (const result of input.results) {
        const [existing] = await tx
          .select({
            id: knowledgeApplicationsV2Table.id,
            createdAt: knowledgeApplicationsV2Table.createdAt,
            version: knowledgeApplicationsV2Table.version,
          })
          .from(knowledgeApplicationsV2Table)
          .where(
            and(
              eq(knowledgeApplicationsV2Table.batchId, input.batchId),
              eq(knowledgeApplicationsV2Table.knowledgeItemId, result.knowledgeItemId),
              eq(knowledgeApplicationsV2Table.packKind, result.packKind),
            ),
          )
          .limit(1);

        if (!existing) {
          await tx.insert(knowledgeApplicationsV2Table).values({
            id: `${input.batchId}-${result.packKind}-${result.knowledgeItemId}`,
            knowledgeItemId: result.knowledgeItemId,
            projectId: input.projectId,
            batchId: input.batchId,
            packKind: result.packKind,
            applicationResult: result.applicationResult,
            note: result.note ?? null,
            ...buildLifecycleValues({
              status: "active",
              timestamp,
              metaJson: { source: "knowledge-method-repository" },
              extraJson: {},
            }),
          });
          continue;
        }

        await tx
          .update(knowledgeApplicationsV2Table)
          .set({
            applicationResult: result.applicationResult,
            note: result.note ?? null,
            ...buildLifecycleValues({
              existing,
              status: "active",
              timestamp,
              metaJson: { source: "knowledge-method-repository" },
              extraJson: {},
            }),
          })
          .where(eq(knowledgeApplicationsV2Table.id, existing.id));
      }
    });
  }

  async listKnowledgeItemsForActiveProfiles(input: {
    projectId: string;
    globalProfileKey?: string;
    bookProfileKey?: string;
    limit?: number;
  }): Promise<KnowledgeItemRecord[]> {
    await ensureSqliteV2Bootstrap(this.client);

    const filters = [];
    if (input.globalProfileKey) {
      filters.push(
        and(
          eq(knowledgeProfilesV2Table.ownerKey, "workspace"),
          eq(knowledgeProfilesV2Table.profileKey, input.globalProfileKey),
          eq(knowledgeProfilesV2Table.scope, "global"),
        ),
      );
    }
    if (input.bookProfileKey) {
      filters.push(
        and(
          eq(knowledgeProfilesV2Table.ownerKey, input.projectId),
          eq(knowledgeProfilesV2Table.profileKey, input.bookProfileKey),
          eq(knowledgeProfilesV2Table.scope, "book"),
        ),
      );
    }

    if (!filters.length) {
      return [];
    }

    const query = this.client.db
      .select({ item: knowledgeItemsV2Table })
      .from(knowledgeProfileRulesV2Table)
      .innerJoin(
        knowledgeProfilesV2Table,
        eq(knowledgeProfileRulesV2Table.profileId, knowledgeProfilesV2Table.id),
      )
      .innerJoin(
        knowledgeItemsV2Table,
        eq(knowledgeProfileRulesV2Table.knowledgeItemId, knowledgeItemsV2Table.id),
      )
      .where(
        and(
          eq(knowledgeProfileRulesV2Table.bindingStatus, "active"),
          eq(knowledgeProfilesV2Table.status, "active"),
          inArray(knowledgeItemsV2Table.status, ["active", "book_only", "validated_global"]),
          or(...filters),
        ),
      )
      .orderBy(desc(knowledgeItemsV2Table.updatedAt));

    const rows = input.limit ? await query.limit(input.limit) : await query;
    const seen = new Set<string>();
    const items: KnowledgeItemRecord[] = [];
    for (const row of rows) {
      if (seen.has(row.item.id)) {
        continue;
      }
      seen.add(row.item.id);
      items.push(this.mapKnowledgeItemRow(row.item));
    }
    return items;
  }

  async listBatchFindings(batchId: string): Promise<KnowledgeFindingRecord[]> {
    await ensureSqliteV2Bootstrap(this.client);

    const rows = await this.client.db
      .select()
      .from(knowledgeFindingsV2Table)
      .where(eq(knowledgeFindingsV2Table.batchId, batchId))
      .orderBy(desc(knowledgeFindingsV2Table.updatedAt));

    return rows.map((row) => ({
      id: row.id,
      batchId: row.batchId,
      projectId: row.projectId,
      sourceType: row.sourceType,
      feedbackTier: row.feedbackTier,
      domain: row.domain,
      severity: row.severity,
      title: row.title,
      summary: row.summary,
      sourcePath: row.sourcePath ?? undefined,
      sourceDocumentId: row.sourceDocumentId ?? undefined,
      riskNature: row.riskNature ?? undefined,
      riskReasons: row.riskReasons,
      evidencePaths: row.evidencePaths,
      updatedAt: row.updatedAt,
    }));
  }

  async listBatchKnowledgeApplications(batchId: string): Promise<KnowledgeApplicationRecord[]> {
    await ensureSqliteV2Bootstrap(this.client);

    const rows = await this.client.db
      .select()
      .from(knowledgeApplicationsV2Table)
      .where(eq(knowledgeApplicationsV2Table.batchId, batchId))
      .orderBy(desc(knowledgeApplicationsV2Table.updatedAt));

    return rows.map((row) => ({
      id: row.id,
      knowledgeItemId: row.knowledgeItemId,
      projectId: row.projectId,
      batchId: row.batchId,
      packKind: row.packKind,
      applicationResult: row.applicationResult,
      note: row.note ?? undefined,
      updatedAt: row.updatedAt,
    }));
  }

  async listBatchKnowledgeGates(batchId: string): Promise<KnowledgeGateRecord[]> {
    await ensureSqliteV2Bootstrap(this.client);

    const rows = await this.client.db
      .select()
      .from(knowledgeGatesV2Table)
      .where(eq(knowledgeGatesV2Table.batchId, batchId))
      .orderBy(desc(knowledgeGatesV2Table.updatedAt));

    return rows.map((row) => ({
      id: row.id,
      projectId: row.projectId,
      batchId: row.batchId,
      gateCode: row.gateCode,
      gateStatus: row.gateStatus,
      note: row.note ?? undefined,
      updatedAt: row.updatedAt,
    }));
  }

  async listKnowledgeProfiles(input: {
    ownerKey?: string;
    projectId?: string;
    scope?: string;
  } = {}): Promise<KnowledgeProfileRecord[]> {
    await ensureSqliteV2Bootstrap(this.client);

    const conditions = [];
    if (input.ownerKey) {
      conditions.push(eq(knowledgeProfilesV2Table.ownerKey, input.ownerKey));
    }
    if (input.projectId) {
      conditions.push(eq(knowledgeProfilesV2Table.projectId, input.projectId));
    }
    if (input.scope) {
      conditions.push(eq(knowledgeProfilesV2Table.scope, input.scope));
    }

    const rows = await this.client.db
      .select()
      .from(knowledgeProfilesV2Table)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(knowledgeProfilesV2Table.updatedAt));

    return rows.map((row) => ({
      id: row.id,
      ownerKey: row.ownerKey,
      projectId: row.projectId ?? undefined,
      scope: row.scope,
      profileKey: row.profileKey,
      label: row.label,
      description: row.description ?? undefined,
      status: row.status,
      updatedAt: row.updatedAt,
    }));
  }

  async listKnowledgeProfileRules(profileId: string): Promise<KnowledgeProfileRuleRecord[]> {
    await ensureSqliteV2Bootstrap(this.client);

    const rows = await this.client.db
      .select()
      .from(knowledgeProfileRulesV2Table)
      .where(eq(knowledgeProfileRulesV2Table.profileId, profileId))
      .orderBy(desc(knowledgeProfileRulesV2Table.updatedAt));

    return rows.map((row) => ({
      id: row.id,
      profileId: row.profileId,
      knowledgeItemId: row.knowledgeItemId,
      bindingStatus: row.bindingStatus,
      bindingReason: row.bindingReason ?? undefined,
      updatedAt: row.updatedAt,
    }));
  }

  private async upsertKnowledgeProfile(input: {
    ownerKey: string;
    projectId?: string;
    scope: string;
    profileKey: string;
    label: string;
    description?: string;
    timestamp: string;
  }): Promise<KnowledgeProfileRecord> {
    const [existing] = await this.client.db
      .select({
        id: knowledgeProfilesV2Table.id,
        createdAt: knowledgeProfilesV2Table.createdAt,
        version: knowledgeProfilesV2Table.version,
      })
      .from(knowledgeProfilesV2Table)
      .where(
        and(
          eq(knowledgeProfilesV2Table.ownerKey, input.ownerKey),
          eq(knowledgeProfilesV2Table.profileKey, input.profileKey),
        ),
      )
      .limit(1);

    const id = existing?.id ?? `${input.ownerKey}-${input.profileKey}`;
    await this.client.db
      .insert(knowledgeProfilesV2Table)
      .values({
        id,
        ownerKey: input.ownerKey,
        projectId: input.projectId ?? null,
        scope: input.scope,
        profileKey: input.profileKey,
        label: input.label,
        description: input.description ?? null,
        ...buildLifecycleValues({
          existing,
          status: "active",
          timestamp: input.timestamp,
          metaJson: { source: "knowledge-method-repository" },
          extraJson: {},
        }),
      })
      .onConflictDoUpdate({
        target: [knowledgeProfilesV2Table.ownerKey, knowledgeProfilesV2Table.profileKey],
        set: {
          projectId: input.projectId ?? null,
          scope: input.scope,
          label: input.label,
          description: input.description ?? null,
          ...buildLifecycleValues({
            existing,
            status: "active",
            timestamp: input.timestamp,
            metaJson: { source: "knowledge-method-repository" },
            extraJson: {},
          }),
        },
      });

    return {
      id,
      ownerKey: input.ownerKey,
      projectId: input.projectId,
      scope: input.scope,
      profileKey: input.profileKey,
      label: input.label,
      description: input.description,
      status: "active",
      updatedAt: input.timestamp,
    };
  }

  private mapKnowledgeItemRow(row: typeof knowledgeItemsV2Table.$inferSelect): KnowledgeItemRecord {
    return {
      id: row.id,
      projectId: row.projectId ?? undefined,
      batchId: row.batchId ?? undefined,
      sourceFindingId: row.sourceFindingId ?? undefined,
      scope: row.scope,
      status: row.status,
      domain: row.domain,
      priority: row.priority,
      title: row.title,
      summary: row.summary,
      rationale: row.rationale,
      prompt: row.prompt ?? undefined,
      validationCount: row.validationCount,
      profileAffinity: row.profileAffinity,
      evidencePaths: row.evidencePaths,
      updatedAt: row.updatedAt,
    };
  }
}
