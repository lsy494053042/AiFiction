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
