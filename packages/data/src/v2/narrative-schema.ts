import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { lifecycleColumns, orderingColumns } from "../foundation/base-columns";
import { novelProjectsV2Table } from "./project-schema";

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

export const entitiesV2Table = sqliteTable(
  "entities_v2",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => novelProjectsV2Table.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),
    canonicalName: text("canonical_name").notNull(),
    displayName: text("display_name").notNull(),
    summary: text("summary"),
    ...lifecycleColumns(),
  },
  (table) => ({
    projectIndex: index("entities_v2_project_id_idx").on(table.projectId),
    typeIndex: index("entities_v2_project_type_idx").on(table.projectId, table.entityType),
    canonicalIndex: uniqueIndex("entities_v2_project_type_name_unique").on(
      table.projectId,
      table.entityType,
      table.canonicalName,
    ),
  }),
);

export const entityAliasesV2Table = sqliteTable(
  "entity_aliases_v2",
  {
    id: text("id").primaryKey(),
    entityId: text("entity_id")
      .notNull()
      .references(() => entitiesV2Table.id, { onDelete: "cascade" }),
    alias: text("alias").notNull(),
    aliasType: text("alias_type").notNull(),
    ...orderingColumns(),
    ...lifecycleColumns(),
  },
  (table) => ({
    entityIndex: index("entity_aliases_v2_entity_id_idx").on(table.entityId),
    orderIndex: uniqueIndex("entity_aliases_v2_entity_sort_unique").on(table.entityId, table.sortOrder),
  }),
);

export const entityEdgesV2Table = sqliteTable(
  "entity_edges_v2",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => novelProjectsV2Table.id, { onDelete: "cascade" }),
    sourceEntityId: text("source_entity_id")
      .notNull()
      .references(() => entitiesV2Table.id, { onDelete: "cascade" }),
    targetEntityId: text("target_entity_id")
      .notNull()
      .references(() => entitiesV2Table.id, { onDelete: "cascade" }),
    edgeType: text("edge_type").notNull(),
    publicLabel: text("public_label").notNull(),
    privateLabel: text("private_label"),
    directionality: text("directionality").notNull(),
    weight: integer("weight").notNull(),
    ...lifecycleColumns(),
  },
  (table) => ({
    projectIndex: index("entity_edges_v2_project_id_idx").on(table.projectId),
    sourceIndex: index("entity_edges_v2_source_idx").on(table.sourceEntityId),
    targetIndex: index("entity_edges_v2_target_idx").on(table.targetEntityId),
    pairIndex: uniqueIndex("entity_edges_v2_pair_unique").on(
      table.sourceEntityId,
      table.targetEntityId,
      table.edgeType,
      table.publicLabel,
    ),
  }),
);

export const panelTemplatesV2Table = sqliteTable(
  "panel_templates_v2",
  {
    id: text("id").primaryKey(),
    ownerKey: text("owner_key").notNull(),
    projectId: text("project_id").references(() => novelProjectsV2Table.id, { onDelete: "cascade" }),
    scope: text("scope").notNull(),
    templateKey: text("template_key").notNull(),
    label: text("label").notNull(),
    appliesToEntityType: text("applies_to_entity_type").notNull(),
    description: text("description"),
    ...lifecycleColumns(),
  },
  (table) => ({
    ownerIndex: index("panel_templates_v2_owner_idx").on(table.ownerKey),
    projectIndex: index("panel_templates_v2_project_id_idx").on(table.projectId),
    templateIndex: uniqueIndex("panel_templates_v2_owner_template_key_unique").on(
      table.ownerKey,
      table.templateKey,
    ),
  }),
);

export const panelFieldsV2Table = sqliteTable(
  "panel_fields_v2",
  {
    id: text("id").primaryKey(),
    templateId: text("template_id")
      .notNull()
      .references(() => panelTemplatesV2Table.id, { onDelete: "cascade" }),
    fieldKey: text("field_key").notNull(),
    label: text("label").notNull(),
    valueType: text("value_type").notNull(),
    cardinality: text("cardinality").notNull(),
    displayGroup: text("display_group"),
    isSearchable: integer("is_searchable", { mode: "boolean" }).notNull(),
    isFilterable: integer("is_filterable", { mode: "boolean" }).notNull(),
    isTimelineTracked: integer("is_timeline_tracked", { mode: "boolean" }).notNull(),
    defaultValueJson: text("default_value_json", { mode: "json" }),
    ...orderingColumns(),
    ...lifecycleColumns(),
  },
  (table) => ({
    templateIndex: index("panel_fields_v2_template_id_idx").on(table.templateId),
    fieldIndex: uniqueIndex("panel_fields_v2_template_field_key_unique").on(
      table.templateId,
      table.fieldKey,
    ),
    orderIndex: uniqueIndex("panel_fields_v2_template_sort_unique").on(table.templateId, table.sortOrder),
  }),
);

export const entityPanelValuesV2Table = sqliteTable(
  "entity_panel_values_v2",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => novelProjectsV2Table.id, { onDelete: "cascade" }),
    entityId: text("entity_id")
      .notNull()
      .references(() => entitiesV2Table.id, { onDelete: "cascade" }),
    templateId: text("template_id")
      .notNull()
      .references(() => panelTemplatesV2Table.id, { onDelete: "cascade" }),
    fieldId: text("field_id")
      .notNull()
      .references(() => panelFieldsV2Table.id, { onDelete: "cascade" }),
    valueText: text("value_text"),
    valueInteger: integer("value_integer"),
    valueNumber: real("value_number"),
    valueBoolean: integer("value_boolean", { mode: "boolean" }),
    valueJson: text("value_json", { mode: "json" }),
    ...lifecycleColumns(),
  },
  (table) => ({
    projectIndex: index("entity_panel_values_v2_project_id_idx").on(table.projectId),
    entityIndex: index("entity_panel_values_v2_entity_id_idx").on(table.entityId),
    templateIndex: index("entity_panel_values_v2_template_id_idx").on(table.templateId),
    fieldIndex: index("entity_panel_values_v2_field_id_idx").on(table.fieldId),
    uniqueValueIndex: uniqueIndex("entity_panel_values_v2_entity_field_unique").on(
      table.entityId,
      table.fieldId,
    ),
  }),
);

export const entityStateEventsV2Table = sqliteTable(
  "entity_state_events_v2",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => novelProjectsV2Table.id, { onDelete: "cascade" }),
    entityId: text("entity_id")
      .notNull()
      .references(() => entitiesV2Table.id, { onDelete: "cascade" }),
    fieldId: text("field_id").references(() => panelFieldsV2Table.id, { onDelete: "set null" }),
    chapterId: text("chapter_id"),
    eventType: text("event_type").notNull(),
    reason: text("reason"),
    oldValueJson: text("old_value_json", { mode: "json" }),
    newValueJson: text("new_value_json", { mode: "json" }),
    sourceArtifactId: text("source_artifact_id"),
    ...lifecycleColumns(),
  },
  (table) => ({
    projectIndex: index("entity_state_events_v2_project_id_idx").on(table.projectId),
    entityIndex: index("entity_state_events_v2_entity_id_idx").on(table.entityId),
    fieldIndex: index("entity_state_events_v2_field_id_idx").on(table.fieldId),
    chapterIndex: index("entity_state_events_v2_chapter_id_idx").on(table.chapterId),
  }),
);

export const tagTaxonomiesV2Table = sqliteTable(
  "tag_taxonomies_v2",
  {
    id: text("id").primaryKey(),
    ownerKey: text("owner_key").notNull(),
    projectId: text("project_id").references(() => novelProjectsV2Table.id, { onDelete: "cascade" }),
    scope: text("scope").notNull(),
    taxonomyKey: text("taxonomy_key").notNull(),
    label: text("label").notNull(),
    description: text("description"),
    ...lifecycleColumns(),
  },
  (table) => ({
    ownerIndex: index("tag_taxonomies_v2_owner_idx").on(table.ownerKey),
    projectIndex: index("tag_taxonomies_v2_project_id_idx").on(table.projectId),
    taxonomyIndex: uniqueIndex("tag_taxonomies_v2_owner_taxonomy_key_unique").on(
      table.ownerKey,
      table.taxonomyKey,
    ),
  }),
);

export const entityTagsV2Table = sqliteTable(
  "entity_tags_v2",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => novelProjectsV2Table.id, { onDelete: "cascade" }),
    entityId: text("entity_id")
      .notNull()
      .references(() => entitiesV2Table.id, { onDelete: "cascade" }),
    taxonomyId: text("taxonomy_id")
      .notNull()
      .references(() => tagTaxonomiesV2Table.id, { onDelete: "cascade" }),
    tagCode: text("tag_code").notNull(),
    tagLabel: text("tag_label").notNull(),
    weight: integer("weight").notNull(),
    ...lifecycleColumns(),
  },
  (table) => ({
    projectIndex: index("entity_tags_v2_project_id_idx").on(table.projectId),
    entityIndex: index("entity_tags_v2_entity_id_idx").on(table.entityId),
    taxonomyIndex: index("entity_tags_v2_taxonomy_id_idx").on(table.taxonomyId),
    uniqueTagIndex: uniqueIndex("entity_tags_v2_entity_taxonomy_code_unique").on(
      table.entityId,
      table.taxonomyId,
      table.tagCode,
    ),
  }),
);

export const taskTemplatesV2Table = sqliteTable(
  "task_templates_v2",
  {
    id: text("id").primaryKey(),
    ownerKey: text("owner_key").notNull(),
    projectId: text("project_id").references(() => novelProjectsV2Table.id, { onDelete: "cascade" }),
    scope: text("scope").notNull(),
    templateKey: text("template_key").notNull(),
    label: text("label").notNull(),
    taskType: text("task_type").notNull(),
    description: text("description"),
    ...lifecycleColumns(),
  },
  (table) => ({
    ownerIndex: index("task_templates_v2_owner_idx").on(table.ownerKey),
    projectIndex: index("task_templates_v2_project_id_idx").on(table.projectId),
    templateIndex: uniqueIndex("task_templates_v2_owner_template_key_unique").on(
      table.ownerKey,
      table.templateKey,
    ),
  }),
);

export const taskRequirementsV2Table = sqliteTable(
  "task_requirements_v2",
  {
    id: text("id").primaryKey(),
    taskTemplateId: text("task_template_id")
      .notNull()
      .references(() => taskTemplatesV2Table.id, { onDelete: "cascade" }),
    requirementKey: text("requirement_key").notNull(),
    requirementType: text("requirement_type").notNull(),
    targetKey: text("target_key").notNull(),
    expectedText: text("expected_text"),
    expectedNumber: real("expected_number"),
    weight: integer("weight").notNull(),
    ...orderingColumns(),
    ...lifecycleColumns(),
  },
  (table) => ({
    templateIndex: index("task_requirements_v2_template_id_idx").on(table.taskTemplateId),
    requirementIndex: uniqueIndex("task_requirements_v2_template_requirement_key_unique").on(
      table.taskTemplateId,
      table.requirementKey,
    ),
    orderIndex: uniqueIndex("task_requirements_v2_template_sort_unique").on(
      table.taskTemplateId,
      table.sortOrder,
    ),
  }),
);

export const taskAssignmentsV2Table = sqliteTable(
  "task_assignments_v2",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => novelProjectsV2Table.id, { onDelete: "cascade" }),
    taskTemplateId: text("task_template_id")
      .notNull()
      .references(() => taskTemplatesV2Table.id, { onDelete: "cascade" }),
    entityId: text("entity_id")
      .notNull()
      .references(() => entitiesV2Table.id, { onDelete: "cascade" }),
    assignmentStatus: text("assignment_status").notNull(),
    rationale: text("rationale"),
    ...lifecycleColumns(),
  },
  (table) => ({
    projectIndex: index("task_assignments_v2_project_id_idx").on(table.projectId),
    templateIndex: index("task_assignments_v2_template_id_idx").on(table.taskTemplateId),
    entityIndex: index("task_assignments_v2_entity_id_idx").on(table.entityId),
  }),
);

export const entityTaskMatchesV2Table = sqliteTable(
  "entity_task_matches_v2",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => novelProjectsV2Table.id, { onDelete: "cascade" }),
    taskTemplateId: text("task_template_id")
      .notNull()
      .references(() => taskTemplatesV2Table.id, { onDelete: "cascade" }),
    entityId: text("entity_id")
      .notNull()
      .references(() => entitiesV2Table.id, { onDelete: "cascade" }),
    matchScore: real("match_score").notNull(),
    matchLabel: text("match_label"),
    reasonsJson: text("reasons_json", { mode: "json" }).notNull(),
    ...lifecycleColumns(),
  },
  (table) => ({
    projectIndex: index("entity_task_matches_v2_project_id_idx").on(table.projectId),
    templateIndex: index("entity_task_matches_v2_template_id_idx").on(table.taskTemplateId),
    entityIndex: index("entity_task_matches_v2_entity_id_idx").on(table.entityId),
    uniqueMatchIndex: uniqueIndex("entity_task_matches_v2_task_entity_unique").on(
      table.taskTemplateId,
      table.entityId,
    ),
  }),
);

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
