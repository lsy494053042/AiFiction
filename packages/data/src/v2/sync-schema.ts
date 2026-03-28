import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { type JsonObject, lifecycleColumns } from "../foundation/base-columns";
import { chaptersV2Table } from "./narrative-schema";
import { novelProjectsV2Table } from "./project-schema";
import { artifactVersionsV2Table, artifactsV2Table } from "./runtime-schema";

/**
 * Local file sources for a project.
 * A project can bind multiple sources such as chapters, outlines, and exports.
 */
export const fileSourcesV2Table = sqliteTable(
  "file_sources_v2",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => novelProjectsV2Table.id, { onDelete: "cascade" }),
    sourceKey: text("source_key").notNull(),
    label: text("label").notNull(),
    sourceKind: text("source_kind").notNull(),
    rootPath: text("root_path").notNull(),
    chapterPath: text("chapter_path"),
    outlinePath: text("outline_path"),
    exportPath: text("export_path"),
    scanPolicyJson: text("scan_policy_json", { mode: "json" }).$type<JsonObject>().notNull(),
    isActive: integer("is_active", { mode: "boolean" }).notNull(),
    lastScannedAt: text("last_scanned_at"),
    ...lifecycleColumns(),
  },
  (table) => ({
    projectIndex: index("file_sources_v2_project_id_idx").on(table.projectId),
    activityIndex: index("file_sources_v2_project_active_idx").on(table.projectId, table.isActive),
    sourceKeyIndex: uniqueIndex("file_sources_v2_project_source_key_unique").on(
      table.projectId,
      table.sourceKey,
    ),
  }),
);

/**
 * Snapshot of documents under a bound file source.
 * Used to track checksum, mapped scope, and sync state.
 */
export const sourceDocumentsV2Table = sqliteTable(
  "source_documents_v2",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => novelProjectsV2Table.id, { onDelete: "cascade" }),
    fileSourceId: text("file_source_id")
      .notNull()
      .references(() => fileSourcesV2Table.id, { onDelete: "cascade" }),
    relativePath: text("relative_path").notNull(),
    documentKind: text("document_kind").notNull(),
    checksum: text("checksum").notNull(),
    fileSizeBytes: integer("file_size_bytes"),
    lastModifiedAt: text("last_modified_at").notNull(),
    syncStatus: text("sync_status").notNull(),
    mappedScopeType: text("mapped_scope_type"),
    mappedScopeId: text("mapped_scope_id"),
    currentArtifactId: text("current_artifact_id").references(() => artifactsV2Table.id, {
      onDelete: "set null",
    }),
    ...lifecycleColumns(),
  },
  (table) => ({
    projectIndex: index("source_documents_v2_project_id_idx").on(table.projectId),
    fileSourceIndex: index("source_documents_v2_file_source_id_idx").on(table.fileSourceId),
    syncStatusIndex: index("source_documents_v2_sync_status_idx").on(table.syncStatus),
    relativePathIndex: uniqueIndex("source_documents_v2_file_source_path_unique").on(
      table.fileSourceId,
      table.relativePath,
    ),
  }),
);

/**
 * A single scan / sync run over a file source.
 */
export const syncRunsV2Table = sqliteTable(
  "sync_runs_v2",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => novelProjectsV2Table.id, { onDelete: "cascade" }),
    fileSourceId: text("file_source_id").references(() => fileSourcesV2Table.id, {
      onDelete: "set null",
    }),
    runKind: text("run_kind").notNull(),
    triggerMode: text("trigger_mode").notNull(),
    runStatus: text("run_status").notNull(),
    scannedCount: integer("scanned_count").notNull(),
    changedCount: integer("changed_count").notNull(),
    startedAt: text("started_at").notNull(),
    finishedAt: text("finished_at"),
    errorSummary: text("error_summary"),
    ...lifecycleColumns(),
  },
  (table) => ({
    projectIndex: index("sync_runs_v2_project_id_idx").on(table.projectId),
    fileSourceIndex: index("sync_runs_v2_file_source_id_idx").on(table.fileSourceId),
    statusIndex: index("sync_runs_v2_status_idx").on(table.runStatus),
  }),
);

/**
 * Individual processing items inside a sync run.
 */
export const syncRunItemsV2Table = sqliteTable(
  "sync_run_items_v2",
  {
    id: text("id").primaryKey(),
    syncRunId: text("sync_run_id")
      .notNull()
      .references(() => syncRunsV2Table.id, { onDelete: "cascade" }),
    sourceDocumentId: text("source_document_id").references(() => sourceDocumentsV2Table.id, {
      onDelete: "set null",
    }),
    changeKind: text("change_kind").notNull(),
    processingStatus: text("processing_status").notNull(),
    generatedArtifactId: text("generated_artifact_id").references(() => artifactsV2Table.id, {
      onDelete: "set null",
    }),
    generatedArtifactVersionId: text("generated_artifact_version_id").references(
      () => artifactVersionsV2Table.id,
      { onDelete: "set null" },
    ),
    summary: text("summary"),
    errorMessage: text("error_message"),
    ...lifecycleColumns(),
  },
  (table) => ({
    runIndex: index("sync_run_items_v2_sync_run_id_idx").on(table.syncRunId),
    documentIndex: index("sync_run_items_v2_source_document_id_idx").on(table.sourceDocumentId),
    statusIndex: index("sync_run_items_v2_processing_status_idx").on(table.processingStatus),
  }),
);

/**
 * Proposed structured asset updates extracted from changed content.
 */
export const assetUpdatesV2Table = sqliteTable(
  "asset_updates_v2",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => novelProjectsV2Table.id, { onDelete: "cascade" }),
    syncRunId: text("sync_run_id").references(() => syncRunsV2Table.id, {
      onDelete: "set null",
    }),
    sourceDocumentId: text("source_document_id").references(() => sourceDocumentsV2Table.id, {
      onDelete: "set null",
    }),
    assetType: text("asset_type").notNull(),
    assetId: text("asset_id"),
    updateKind: text("update_kind").notNull(),
    confidenceLevel: text("confidence_level").notNull(),
    proposedPayloadJson: text("proposed_payload_json", { mode: "json" })
      .$type<JsonObject>()
      .notNull(),
    appliedStatus: text("applied_status").notNull(),
    appliedAt: text("applied_at"),
    ...lifecycleColumns(),
  },
  (table) => ({
    projectIndex: index("asset_updates_v2_project_id_idx").on(table.projectId),
    syncRunIndex: index("asset_updates_v2_sync_run_id_idx").on(table.syncRunId),
    assetIndex: index("asset_updates_v2_asset_idx").on(table.assetType, table.assetId),
    appliedStatusIndex: index("asset_updates_v2_applied_status_idx").on(table.appliedStatus),
  }),
);

/**
 * Review queue items waiting for a decision.
 */
export const reviewQueueV2Table = sqliteTable(
  "review_queue_v2",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => novelProjectsV2Table.id, { onDelete: "cascade" }),
    syncRunId: text("sync_run_id").references(() => syncRunsV2Table.id, {
      onDelete: "set null",
    }),
    sourceDocumentId: text("source_document_id").references(() => sourceDocumentsV2Table.id, {
      onDelete: "set null",
    }),
    assetUpdateId: text("asset_update_id").references(() => assetUpdatesV2Table.id, {
      onDelete: "set null",
    }),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id"),
    reviewKind: text("review_kind").notNull(),
    severity: text("severity").notNull(),
    summary: text("summary").notNull(),
    detailJson: text("detail_json", { mode: "json" }).$type<JsonObject>().notNull(),
    decisionNote: text("decision_note"),
    decidedAt: text("decided_at"),
    ...lifecycleColumns(),
  },
  (table) => ({
    projectIndex: index("review_queue_v2_project_id_idx").on(table.projectId),
    runIndex: index("review_queue_v2_sync_run_id_idx").on(table.syncRunId),
    statusIndex: index("review_queue_v2_status_idx").on(table.status),
    severityIndex: index("review_queue_v2_severity_idx").on(table.severity),
  }),
);

/**
 * Persisted chapter-level follow-up task state.
 * Currently used for formal review tasks and designed to extend to more task kinds later.
 */
export const followUpTaskStatesV2Table = sqliteTable(
  "follow_up_task_states_v2",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => novelProjectsV2Table.id, { onDelete: "cascade" }),
    chapterId: text("chapter_id")
      .notNull()
      .references(() => chaptersV2Table.id, { onDelete: "cascade" }),
    taskKind: text("task_kind").notNull(),
    taskFingerprint: text("task_fingerprint").notNull(),
    taskStatus: text("task_status").notNull(),
    taskOutcome: text("task_outcome"),
    outcomeSummary: text("outcome_summary"),
    decisionNote: text("decision_note"),
    decidedAt: text("decided_at"),
    ...lifecycleColumns(),
  },
  (table) => ({
    projectIndex: index("follow_up_task_states_v2_project_id_idx").on(table.projectId),
    chapterIndex: index("follow_up_task_states_v2_chapter_id_idx").on(table.chapterId),
    statusIndex: index("follow_up_task_states_v2_status_idx").on(table.taskStatus),
    uniqueTaskIndex: uniqueIndex("follow_up_task_states_v2_project_chapter_kind_unique").on(
      table.projectId,
      table.chapterId,
      table.taskKind,
    ),
  }),
);

/**
 * References from structured facts back to source documents and artifacts.
 */
export const sourceRefsV2Table = sqliteTable(
  "source_refs_v2",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => novelProjectsV2Table.id, { onDelete: "cascade" }),
    assetType: text("asset_type").notNull(),
    assetId: text("asset_id").notNull(),
    sourceDocumentId: text("source_document_id").references(() => sourceDocumentsV2Table.id, {
      onDelete: "set null",
    }),
    artifactVersionId: text("artifact_version_id").references(() => artifactVersionsV2Table.id, {
      onDelete: "set null",
    }),
    referenceKind: text("reference_kind").notNull(),
    locator: text("locator").notNull(),
    evidenceQuote: text("evidence_quote"),
    ...lifecycleColumns(),
  },
  (table) => ({
    projectIndex: index("source_refs_v2_project_id_idx").on(table.projectId),
    assetIndex: index("source_refs_v2_asset_idx").on(table.assetType, table.assetId),
    documentIndex: index("source_refs_v2_source_document_id_idx").on(table.sourceDocumentId),
    artifactVersionIndex: index("source_refs_v2_artifact_version_id_idx").on(table.artifactVersionId),
  }),
);
