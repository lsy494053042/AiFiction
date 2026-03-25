import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { lifecycleColumns, orderingColumns } from "../foundation/base-columns";
import { novelProjectsV2Table } from "./project-schema";

/**
 * 世界规则表。
 * V2 继续保留规则表，但预留 category、severity、effectiveScope 等后续扩展方向。
 */
export const worldRulesV2Table = sqliteTable(
  "world_rules_v2",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => novelProjectsV2Table.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    severity: text("severity").notNull(),
    isHardConstraint: integer("is_hard_constraint", { mode: "boolean" }).notNull(),
    ...lifecycleColumns(),
  },
  (table) => ({
    projectIndex: index("world_rules_v2_project_id_idx").on(table.projectId),
  }),
);

/**
 * 角色主表。
 * 这里只放角色核心身份和角色弧，别名与关系拆成子表。
 */
export const charactersV2Table = sqliteTable(
  "characters_v2",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => novelProjectsV2Table.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    roleType: text("role_type").notNull(),
    archetype: text("archetype").notNull(),
    publicIdentity: text("public_identity").notNull(),
    hiddenIdentity: text("hidden_identity"),
    coreDesire: text("core_desire").notNull(),
    coreFear: text("core_fear").notNull(),
    growthArc: text("growth_arc").notNull(),
    speechGuide: text("speech_guide", { mode: "json" }).$type<string[]>().notNull(),
    ...lifecycleColumns(),
  },
  (table) => ({
    projectIndex: index("characters_v2_project_id_idx").on(table.projectId),
  }),
);

/**
 * 角色别名表。
 * 以后支持多称谓、别号、马甲名时无需改角色主表。
 */
export const characterAliasesV2Table = sqliteTable(
  "character_aliases_v2",
  {
    id: text("id").primaryKey(),
    characterId: text("character_id")
      .notNull()
      .references(() => charactersV2Table.id, { onDelete: "cascade" }),
    alias: text("alias").notNull(),
    aliasType: text("alias_type").notNull(),
    ...orderingColumns(),
    ...lifecycleColumns(),
  },
  (table) => ({
    characterIndex: index("character_aliases_v2_character_id_idx").on(table.characterId),
    orderIndex: uniqueIndex("character_aliases_v2_character_sort_unique").on(
      table.characterId,
      table.sortOrder,
    ),
  }),
);

/**
 * 角色关系表。
 * V2 明确拆表，避免长期把关系网络塞在 JSON 中无法查询。
 */
export const characterRelationshipsV2Table = sqliteTable(
  "character_relationships_v2",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => novelProjectsV2Table.id, { onDelete: "cascade" }),
    sourceCharacterId: text("source_character_id")
      .notNull()
      .references(() => charactersV2Table.id, { onDelete: "cascade" }),
    targetCharacterId: text("target_character_id")
      .notNull()
      .references(() => charactersV2Table.id, { onDelete: "cascade" }),
    publicLabel: text("public_label").notNull(),
    privateLabel: text("private_label"),
    trustLevel: integer("trust_level").notNull(),
    tensionLevel: integer("tension_level").notNull(),
    ...lifecycleColumns(),
  },
  (table) => ({
    sourceIndex: index("character_relationships_v2_source_idx").on(table.sourceCharacterId),
    targetIndex: index("character_relationships_v2_target_idx").on(table.targetCharacterId),
    pairIndex: uniqueIndex("character_relationships_v2_pair_unique").on(
      table.sourceCharacterId,
      table.targetCharacterId,
      table.publicLabel,
    ),
  }),
);

/**
 * 分卷表。
 */
export const volumesV2Table = sqliteTable(
  "volumes_v2",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => novelProjectsV2Table.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    phaseGoal: text("phase_goal").notNull(),
    mainConflict: text("main_conflict").notNull(),
    plannedChapterCount: integer("planned_chapter_count").notNull(),
    ...orderingColumns(),
    ...lifecycleColumns(),
  },
  (table) => ({
    projectIndex: index("volumes_v2_project_id_idx").on(table.projectId),
    orderIndex: uniqueIndex("volumes_v2_project_sort_unique").on(table.projectId, table.sortOrder),
  }),
);

/**
 * 章节表。
 * 章级的高频字段明确列出，正文等长文本内容交给 artifact 层。
 */
export const chaptersV2Table = sqliteTable(
  "chapters_v2",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => novelProjectsV2Table.id, { onDelete: "cascade" }),
    volumeId: text("volume_id")
      .notNull()
      .references(() => volumesV2Table.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    chapterGoal: text("chapter_goal").notNull(),
    conflict: text("conflict").notNull(),
    entryState: text("entry_state").notNull(),
    exitState: text("exit_state").notNull(),
    endingHook: text("ending_hook").notNull(),
    currentArtifactId: text("current_artifact_id"),
    ...orderingColumns(),
    ...lifecycleColumns(),
  },
  (table) => ({
    projectIndex: index("chapters_v2_project_id_idx").on(table.projectId),
    volumeIndex: index("chapters_v2_volume_id_idx").on(table.volumeId),
    volumeOrderIndex: uniqueIndex("chapters_v2_volume_sort_unique").on(
      table.volumeId,
      table.sortOrder,
    ),
  }),
);

/**
 * 场景子表。
 * 这是章节未来最容易扩展的地方之一，所以提前拆出来。
 */
export const chapterScenesV2Table = sqliteTable(
  "chapter_scenes_v2",
  {
    id: text("id").primaryKey(),
    chapterId: text("chapter_id")
      .notNull()
      .references(() => chaptersV2Table.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    purpose: text("purpose").notNull(),
    conflict: text("conflict").notNull(),
    emotionalShift: text("emotional_shift").notNull(),
    ...orderingColumns(),
    ...lifecycleColumns(),
  },
  (table) => ({
    chapterIndex: index("chapter_scenes_v2_chapter_id_idx").on(table.chapterId),
    chapterOrderIndex: uniqueIndex("chapter_scenes_v2_chapter_sort_unique").on(
      table.chapterId,
      table.sortOrder,
    ),
  }),
);

/**
 * 伏笔主表。
 */
export const foreshadowsV2Table = sqliteTable(
  "foreshadows_v2",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => novelProjectsV2Table.id, { onDelete: "cascade" }),
    seedChapterId: text("seed_chapter_id")
      .notNull()
      .references(() => chaptersV2Table.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    narrativePurpose: text("narrative_purpose").notNull(),
    payoffStatus: text("payoff_status").notNull(),
    expectedPayoffChapterId: text("expected_payoff_chapter_id").references(() => chaptersV2Table.id, {
      onDelete: "set null",
    }),
    actualPayoffChapterId: text("actual_payoff_chapter_id").references(() => chaptersV2Table.id, {
      onDelete: "set null",
    }),
    ...lifecycleColumns(),
  },
  (table) => ({
    projectIndex: index("foreshadows_v2_project_id_idx").on(table.projectId),
    seedIndex: index("foreshadows_v2_seed_chapter_id_idx").on(table.seedChapterId),
  }),
);

/**
 * 伏笔关联表。
 * 用于把一个伏笔与多个章节、角色、规则或 artifact 建立显式关系。
 */
export const foreshadowLinksV2Table = sqliteTable(
  "foreshadow_links_v2",
  {
    id: text("id").primaryKey(),
    foreshadowId: text("foreshadow_id")
      .notNull()
      .references(() => foreshadowsV2Table.id, { onDelete: "cascade" }),
    linkType: text("link_type").notNull(),
    targetId: text("target_id").notNull(),
    note: text("note"),
    ...lifecycleColumns(),
  },
  (table) => ({
    foreshadowIndex: index("foreshadow_links_v2_foreshadow_id_idx").on(table.foreshadowId),
  }),
);

/**
 * 时间线事件表。
 */
export const timelineEventsV2Table = sqliteTable(
  "timeline_events_v2",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => novelProjectsV2Table.id, { onDelete: "cascade" }),
    chapterId: text("chapter_id").references(() => chaptersV2Table.id, { onDelete: "set null" }),
    inWorldDay: integer("in_world_day").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    impactSummary: text("impact_summary"),
    ...lifecycleColumns(),
  },
  (table) => ({
    projectIndex: index("timeline_events_v2_project_id_idx").on(table.projectId),
    dayIndex: index("timeline_events_v2_day_idx").on(table.inWorldDay),
  }),
);

/**
 * 实体状态快照表。
 * 这层比 V1 更泛化，后续不仅能存角色状态，也能扩展到组织、地点、势力等实体。
 */
export const entityStateSnapshotsV2Table = sqliteTable(
  "entity_state_snapshots_v2",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => novelProjectsV2Table.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    chapterId: text("chapter_id").references(() => chaptersV2Table.id, { onDelete: "set null" }),
    snapshotLabel: text("snapshot_label").notNull(),
    stateJson: text("state_json", { mode: "json" }).notNull(),
    sourceArtifactId: text("source_artifact_id"),
    ...lifecycleColumns(),
  },
  (table) => ({
    projectIndex: index("entity_state_snapshots_v2_project_id_idx").on(table.projectId),
    entityIndex: index("entity_state_snapshots_v2_entity_idx").on(table.entityType, table.entityId),
    chapterIndex: index("entity_state_snapshots_v2_chapter_id_idx").on(table.chapterId),
  }),
);
