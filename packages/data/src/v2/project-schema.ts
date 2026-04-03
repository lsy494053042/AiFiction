import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { displayColumns, lifecycleColumns } from "../foundation/base-columns";

/**
 * V2 的作品主表。
 * 这层只保存作品最核心的身份、阶段和活跃引用，不把所有业务字段堆在一张表里。
 */
export const novelProjectsV2Table = sqliteTable(
  "novel_projects_v2",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    subtitle: text("subtitle"),
    ownerMode: text("owner_mode").notNull(),
    workflowPhase: text("workflow_phase").notNull(),
    primaryGenre: text("primary_genre").notNull(),
    secondaryGenre: text("secondary_genre"),
    activeProfileId: text("active_profile_id"),
    activeGuardrailProfileId: text("active_guardrail_profile_id"),
    activeOutlineArtifactId: text("active_outline_artifact_id"),
    summary: text("summary"),
    ...lifecycleColumns(),
  },
  (table) => ({
    slugIndex: uniqueIndex("novel_projects_v2_slug_unique").on(table.slug),
    phaseIndex: index("novel_projects_v2_phase_idx").on(table.workflowPhase),
  }),
);

/**
 * 作品业务配置表。
 * 平台、读者、字数目标等偏“经营配置”的内容放在这里，避免主表变胖。
 * 通过 profileKey 允许同一作品并存多套配置，比如不同平台版本或不同试验方案。
 */
export const projectProfilesV2Table = sqliteTable(
  "project_profiles_v2",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => novelProjectsV2Table.id, { onDelete: "cascade" }),
    profileKey: text("profile_key").notNull(),
    label: text("label").notNull(),
    targetPlatform: text("target_platform").notNull(),
    targetAudience: text("target_audience", { mode: "json" }).$type<string[]>().notNull(),
    targetWordCount: integer("target_word_count").notNull(),
    dailyWordTarget: integer("daily_word_target").notNull(),
    updateCadence: text("update_cadence").notNull(),
    commercializationHooks: text("commercialization_hooks", { mode: "json" }).$type<string[]>().notNull(),
    promiseSummary: text("promise_summary").notNull(),
    riskNotes: text("risk_notes", { mode: "json" }).$type<string[]>().notNull(),
    ...lifecycleColumns(),
  },
  (table) => ({
    projectIndex: index("project_profiles_v2_project_id_idx").on(table.projectId),
    profileIndex: uniqueIndex("project_profiles_v2_project_profile_key_unique").on(
      table.projectId,
      table.profileKey,
    ),
  }),
);

/**
 * 守护规则配置表。
 * 风格边界、硬性约束、禁忌表达等集中存放，方便后续切 profile 与版本化。
 */
export const guardrailProfilesV2Table = sqliteTable(
  "guardrail_profiles_v2",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => novelProjectsV2Table.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    profileKey: text("profile_key").notNull(),
    perspective: text("perspective").notNull(),
    pacingLevel: text("pacing_level").notNull(),
    languageDensity: text("language_density").notNull(),
    emotionLevel: text("emotion_level").notNull(),
    bannedPatterns: text("banned_patterns", { mode: "json" }).$type<string[]>().notNull(),
    hardConstraints: text("hard_constraints", { mode: "json" }).$type<string[]>().notNull(),
    styleAnchors: text("style_anchors", { mode: "json" }).$type<string[]>().notNull(),
    ...lifecycleColumns(),
  },
  (table) => ({
    projectIndex: index("guardrail_profiles_v2_project_id_idx").on(table.projectId),
    profileIndex: uniqueIndex("guardrail_profiles_v2_project_profile_key_unique").on(
      table.projectId,
      table.profileKey,
    ),
  }),
);

/**
 * 项目标签表。
 * 这张表故意拆出来，是为了给未来筛选、分组、统计留出口。
 */
export const projectTagsV2Table = sqliteTable(
  "project_tags_v2",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => novelProjectsV2Table.id, { onDelete: "cascade" }),
    ...displayColumns(),
    groupName: text("group_name").notNull(),
    ...lifecycleColumns(),
  },
  (table) => ({
    projectIndex: index("project_tags_v2_project_id_idx").on(table.projectId),
    codeIndex: uniqueIndex("project_tags_v2_project_id_code_unique").on(table.projectId, table.code),
  }),
);

/**
 * 方法账批次表。
 * 记录一次写作批次/复盘批次的最小上下文，后续 findings / knowledge items 都挂在这个批次下面。
 */
export const knowledgeBatchesV2Table = sqliteTable(
  "knowledge_batches_v2",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => novelProjectsV2Table.id, { onDelete: "cascade" }),
    batchKey: text("batch_key").notNull(),
    stageLabel: text("stage_label"),
    focusLabel: text("focus_label"),
    chapterFrom: integer("chapter_from"),
    chapterTo: integer("chapter_to"),
    reviewStatus: text("review_status").notNull(),
    sourceReviewFile: text("source_review_file"),
    sourceReviewDataFile: text("source_review_data_file"),
    sourceCandidatesFile: text("source_candidates_file"),
    ...lifecycleColumns(),
  },
  (table) => ({
    projectIndex: index("knowledge_batches_v2_project_id_idx").on(table.projectId),
    batchIndex: uniqueIndex("knowledge_batches_v2_project_batch_key_unique").on(table.projectId, table.batchKey),
  }),
);

/**
 * 方法账 finding 表。
 * 每条 finding 都带来源、严重度、领域和风险理由，用来支撑后续候选经验升级。
 */
export const knowledgeFindingsV2Table = sqliteTable(
  "knowledge_findings_v2",
  {
    id: text("id").primaryKey(),
    batchId: text("batch_id")
      .notNull()
      .references(() => knowledgeBatchesV2Table.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => novelProjectsV2Table.id, { onDelete: "cascade" }),
    sourceType: text("source_type").notNull(),
    feedbackTier: text("feedback_tier").notNull(),
    domain: text("domain").notNull(),
    severity: text("severity").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    sourcePath: text("source_path"),
    sourceDocumentId: text("source_document_id"),
    riskNature: text("risk_nature"),
    riskReasons: text("risk_reasons", { mode: "json" }).$type<string[]>().notNull(),
    evidencePaths: text("evidence_paths", { mode: "json" }).$type<string[]>().notNull(),
    ...lifecycleColumns(),
  },
  (table) => ({
    batchIndex: index("knowledge_findings_v2_batch_id_idx").on(table.batchId),
    projectIndex: index("knowledge_findings_v2_project_id_idx").on(table.projectId),
    severityIndex: index("knowledge_findings_v2_project_severity_idx").on(table.projectId, table.severity),
  }),
);

/**
 * 方法账知识条目表。
 * 这里只存结构化知识对象本身，不存大段说明文；说明文继续通过 Markdown 渲染层提供。
 */
export const knowledgeItemsV2Table = sqliteTable(
  "knowledge_items_v2",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").references(() => novelProjectsV2Table.id, { onDelete: "cascade" }),
    batchId: text("batch_id").references(() => knowledgeBatchesV2Table.id, { onDelete: "cascade" }),
    sourceFindingId: text("source_finding_id").references(() => knowledgeFindingsV2Table.id, { onDelete: "set null" }),
    scope: text("scope").notNull(),
    domain: text("domain").notNull(),
    priority: text("priority").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    rationale: text("rationale").notNull(),
    prompt: text("prompt"),
    validationCount: integer("validation_count").notNull(),
    profileAffinity: text("profile_affinity", { mode: "json" }).$type<string[]>().notNull(),
    evidencePaths: text("evidence_paths", { mode: "json" }).$type<string[]>().notNull(),
    ...lifecycleColumns(),
  },
  (table) => ({
    projectIndex: index("knowledge_items_v2_project_id_idx").on(table.projectId),
    batchIndex: index("knowledge_items_v2_batch_id_idx").on(table.batchId),
    statusIndex: index("knowledge_items_v2_scope_status_idx").on(table.scope, table.status),
  }),
);

/**
 * 方法账 profile 表。
 * 把“全局 profile / 本书 profile”显式结构化，避免 profile 只停留在协议字符串层。
 */
export const knowledgeProfilesV2Table = sqliteTable(
  "knowledge_profiles_v2",
  {
    id: text("id").primaryKey(),
    ownerKey: text("owner_key").notNull(),
    projectId: text("project_id").references(() => novelProjectsV2Table.id, { onDelete: "cascade" }),
    scope: text("scope").notNull(),
    profileKey: text("profile_key").notNull(),
    label: text("label").notNull(),
    description: text("description"),
    ...lifecycleColumns(),
  },
  (table) => ({
    ownerIndex: index("knowledge_profiles_v2_owner_idx").on(table.ownerKey),
    projectIndex: index("knowledge_profiles_v2_project_id_idx").on(table.projectId),
    profileIndex: uniqueIndex("knowledge_profiles_v2_owner_profile_key_unique").on(
      table.ownerKey,
      table.profileKey,
    ),
  }),
);

/**
 * 方法账 profile-rule 绑定表。
 * 把“哪些知识项被正式启用到哪个 profile”显式记录下来，后续写作包优先从这里取 active workset。
 */
export const knowledgeProfileRulesV2Table = sqliteTable(
  "knowledge_profile_rules_v2",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => knowledgeProfilesV2Table.id, { onDelete: "cascade" }),
    knowledgeItemId: text("knowledge_item_id")
      .notNull()
      .references(() => knowledgeItemsV2Table.id, { onDelete: "cascade" }),
    bindingStatus: text("binding_status").notNull(),
    bindingReason: text("binding_reason"),
    ...lifecycleColumns(),
  },
  (table) => ({
    profileIndex: index("knowledge_profile_rules_v2_profile_id_idx").on(table.profileId),
    itemIndex: index("knowledge_profile_rules_v2_item_id_idx").on(table.knowledgeItemId),
    uniqueBindingIndex: uniqueIndex("knowledge_profile_rules_v2_profile_item_unique").on(
      table.profileId,
      table.knowledgeItemId,
    ),
  }),
);

/**
 * 方法账应用记录表。
 * 记录某条知识是否已经进入某一批次的写作包/运行时上下文，后续才能判断它到底有没有被真正用起来。
 */
export const knowledgeApplicationsV2Table = sqliteTable(
  "knowledge_applications_v2",
  {
    id: text("id").primaryKey(),
    knowledgeItemId: text("knowledge_item_id")
      .notNull()
      .references(() => knowledgeItemsV2Table.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => novelProjectsV2Table.id, { onDelete: "cascade" }),
    batchId: text("batch_id")
      .notNull()
      .references(() => knowledgeBatchesV2Table.id, { onDelete: "cascade" }),
    packKind: text("pack_kind").notNull(),
    applicationResult: text("application_result").notNull(),
    note: text("note"),
    ...lifecycleColumns(),
  },
  (table) => ({
    itemIndex: index("knowledge_applications_v2_item_id_idx").on(table.knowledgeItemId),
    batchIndex: index("knowledge_applications_v2_batch_id_idx").on(table.batchId),
    projectIndex: index("knowledge_applications_v2_project_id_idx").on(table.projectId),
    uniqueApplicationIndex: uniqueIndex("knowledge_applications_v2_batch_item_pack_unique").on(
      table.batchId,
      table.knowledgeItemId,
      table.packKind,
    ),
  }),
);

/**
 * 方法账 gate 记录表。
 * 记录当前批次是否通过元语言检查、承接检查、开篇复盘等 gate，避免 gate 只存在于协议字段中。
 */
export const knowledgeGatesV2Table = sqliteTable(
  "knowledge_gates_v2",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => novelProjectsV2Table.id, { onDelete: "cascade" }),
    batchId: text("batch_id")
      .notNull()
      .references(() => knowledgeBatchesV2Table.id, { onDelete: "cascade" }),
    gateCode: text("gate_code").notNull(),
    gateStatus: text("gate_status").notNull(),
    note: text("note"),
    ...lifecycleColumns(),
  },
  (table) => ({
    batchIndex: index("knowledge_gates_v2_batch_id_idx").on(table.batchId),
    projectIndex: index("knowledge_gates_v2_project_id_idx").on(table.projectId),
    uniqueGateIndex: uniqueIndex("knowledge_gates_v2_batch_gate_unique").on(table.batchId, table.gateCode),
  }),
);
