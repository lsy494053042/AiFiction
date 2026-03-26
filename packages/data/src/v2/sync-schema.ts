import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { type JsonObject, lifecycleColumns } from "../foundation/base-columns";
import { novelProjectsV2Table } from "./project-schema";
import { artifactVersionsV2Table, artifactsV2Table } from "./runtime-schema";

/**
 * 閺堫剙婀撮弬鍥︽濠ф劘銆冮妴? * 娑撯偓闁劋缍旈崫浣稿讲娴犮儳绮︾€规艾顦跨紒鍕拱閸︽壆娲拌ぐ鏇礉娓氬顩у锝嗘瀮閻╊喖缍嶉妴浣筋啎鐎规氨娲拌ぐ鏇熷灗鐎电厧鍤惄顔肩秿閵? */
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
 * 閺夈儲绨弬鍥︽鐞涖劊鈧? * 鐠佹澘缍嶉惄顔肩秿閹殿偅寮块惇瀣煂閻ㄥ嫬鍙挎担鎾存瀮娴犺绱濇禒銉ュ挤鐎瑰啫缍嬮崜宥嗘Ё鐏忓嫬鍩岄崫顏嗩潚娑撴艾濮熺€电钖勯妴? */
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
 * 閸氬本顒炴潻鎰攽鐞涖劊鈧? * 鐠佹澘缍嶆稉鈧▎锛勬窗瑜版洘澹傞幓蹇斿灗娑撯偓濞嗏€愁杻闁插繐鎮撳銉ф畱妞よ泛鐪扮紒鎾寸亯閵? */
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
 * 閸氬本顒炴潻鎰攽妞ょ銆冮妴? * 閻劋绨仦鏇炵磻閺屾劖顐奸崥灞绢劄闁插本鐦℃稉顏呮瀮娴犲墎娈戞径鍕倞缂佹挻鐏夐敍灞肩┒娴滃孩甯撻柨娆庣瑢閸ョ偞鏂侀妴? */
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
 * 鐠у嫪楠囬弴瀛樻煀瀵ら缚顔呯悰銊ｂ偓? * 鏉╂瑥鐪伴幍鎸庡复閼奉亜濮╅幎钘夊絿閸氬海娈戝楦款唴閺囧瓨鏌婄紒鎾寸亯閿涘苯鎮楃紒顓犳暠閼奉亜濮╂惔鏃傛暏閹存牕顓搁弻銉╂Е閸掓绉风拹骞库偓? */
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
 * 鐎光剝鐓￠梼鐔峰灙鐞涖劊鈧? * 娴ｅ海鐤嗘穱鈥冲缂佹挻鐏夐妴浣虹波閺嬪嫬鍟跨粣浣瑰灗妤傛﹢顥撻梽鈺傛纯閺備即鍏樻潻娑樺弳鏉╂瑩鍣风粵澶婄窡婢跺嫮鎮婇妴? */
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
 * 閺夈儲绨鏇犳暏鐞涖劊鈧? * 閹跺﹦绮ㄩ弸鍕娴滃鐤勬稉搴″斧婵鐝烽懞鍌樷偓浣稿斧婵楠囬悧鈺冨閺堫剙缂撶粩瀣▔瀵繗鎷峰┃顖氬彠缁眹鈧? */
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
