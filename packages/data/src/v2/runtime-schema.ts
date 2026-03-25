import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { lifecycleColumns, orderingColumns } from "../foundation/base-columns";
import { novelProjectsV2Table } from "./project-schema";

/**
 * Artifact 主表。
 * 用来承载“逻辑产物”的身份，版本内容再落到 artifact_versions_v2。
 */
export const artifactsV2Table = sqliteTable(
  "artifacts_v2",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => novelProjectsV2Table.id, { onDelete: "cascade" }),
    artifactKey: text("artifact_key").notNull(),
    artifactKind: text("artifact_kind").notNull(),
    scopeType: text("scope_type").notNull(),
    scopeId: text("scope_id").notNull(),
    currentVersionId: text("current_version_id"),
    ...lifecycleColumns(),
  },
  (table) => ({
    projectIndex: index("artifacts_v2_project_id_idx").on(table.projectId),
    artifactIndex: uniqueIndex("artifacts_v2_project_scope_key_unique").on(
      table.projectId,
      table.scopeType,
      table.scopeId,
      table.artifactKey,
    ),
  }),
);

/**
 * Artifact 版本表。
 * 正文、章卡、审校报告、改写稿、摘要等都统一进入这层，而不是分散多张内容表。
 */
export const artifactVersionsV2Table = sqliteTable(
  "artifact_versions_v2",
  {
    id: text("id").primaryKey(),
    artifactId: text("artifact_id")
      .notNull()
      .references(() => artifactsV2Table.id, { onDelete: "cascade" }),
    versionLabel: text("version_label").notNull(),
    parentVersionId: text("parent_version_id"),
    contentFormat: text("content_format").notNull(),
    contentText: text("content_text"),
    contentJson: text("content_json", { mode: "json" }),
    sourceRunStepId: text("source_run_step_id"),
    ...lifecycleColumns(),
  },
  (table) => ({
    artifactIndex: index("artifact_versions_v2_artifact_id_idx").on(table.artifactId),
    versionIndex: uniqueIndex("artifact_versions_v2_artifact_version_unique").on(
      table.artifactId,
      table.versionLabel,
    ),
  }),
);

/**
 * 流水线运行表。
 * 一次工作流的顶层记录，只概括本次运行的大状态。
 */
export const pipelineRunsV2Table = sqliteTable(
  "pipeline_runs_v2",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => novelProjectsV2Table.id, { onDelete: "cascade" }),
    scopeType: text("scope_type").notNull(),
    scopeId: text("scope_id").notNull(),
    workflowName: text("workflow_name").notNull(),
    workflowVersion: text("workflow_version").notNull(),
    executionMode: text("execution_mode").notNull(),
    providerName: text("provider_name"),
    modelName: text("model_name"),
    estimatedTokenCost: integer("estimated_token_cost").notNull(),
    startedAt: text("started_at").notNull(),
    finishedAt: text("finished_at"),
    ...lifecycleColumns(),
  },
  (table) => ({
    projectIndex: index("pipeline_runs_v2_project_id_idx").on(table.projectId),
    workflowIndex: index("pipeline_runs_v2_workflow_idx").on(table.workflowName, table.workflowVersion),
  }),
);

/**
 * 流水线步骤表。
 * 为将来 agent、LangGraph、重试、人工打回、节点回放预留的关键结构。
 */
export const pipelineRunStepsV2Table = sqliteTable(
  "pipeline_run_steps_v2",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => pipelineRunsV2Table.id, { onDelete: "cascade" }),
    stepKey: text("step_key").notNull(),
    stepType: text("step_type").notNull(),
    providerName: text("provider_name"),
    modelName: text("model_name"),
    inputArtifactId: text("input_artifact_id"),
    outputArtifactId: text("output_artifact_id"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    startedAt: text("started_at").notNull(),
    finishedAt: text("finished_at"),
    ...orderingColumns(),
    ...lifecycleColumns(),
  },
  (table) => ({
    runIndex: index("pipeline_run_steps_v2_run_id_idx").on(table.runId),
    orderIndex: uniqueIndex("pipeline_run_steps_v2_run_sort_unique").on(table.runId, table.sortOrder),
  }),
);

/**
 * Prompt 模板主表。
 * 这里保存逻辑身份，不直接保存每个版本的正文。
 */
export const promptTemplatesV2Table = sqliteTable(
  "prompt_templates_v2",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").references(() => novelProjectsV2Table.id, { onDelete: "cascade" }),
    templateKey: text("template_key").notNull(),
    stage: text("stage").notNull(),
    ownerScope: text("owner_scope").notNull(),
    currentVersionId: text("current_version_id"),
    ...lifecycleColumns(),
  },
  (table) => ({
    templateIndex: uniqueIndex("prompt_templates_v2_scope_key_unique").on(table.projectId, table.templateKey),
  }),
);

/**
 * Prompt 模板版本表。
 * 后续每次 prompt 调整都应该沉淀到这里，而不是只改代码字符串。
 */
export const promptTemplateVersionsV2Table = sqliteTable(
  "prompt_template_versions_v2",
  {
    id: text("id").primaryKey(),
    templateId: text("template_id")
      .notNull()
      .references(() => promptTemplatesV2Table.id, { onDelete: "cascade" }),
    versionName: text("version_name").notNull(),
    systemPrompt: text("system_prompt").notNull(),
    userPrompt: text("user_prompt").notNull(),
    outputContract: text("output_contract"),
    changeSummary: text("change_summary"),
    ...lifecycleColumns(),
  },
  (table) => ({
    templateIndex: index("prompt_template_versions_v2_template_id_idx").on(table.templateId),
    versionIndex: uniqueIndex("prompt_template_versions_v2_unique").on(table.templateId, table.versionName),
  }),
);
