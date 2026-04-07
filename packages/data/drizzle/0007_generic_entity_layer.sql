DROP TABLE IF EXISTS `character_aliases_v2`;
--> statement-breakpoint
DROP TABLE IF EXISTS `character_relationships_v2`;
--> statement-breakpoint
DROP TABLE IF EXISTS `characters_v2`;
--> statement-breakpoint
CREATE TABLE `entities_v2` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`canonical_name` text NOT NULL,
	`display_name` text NOT NULL,
	`summary` text,
	`status` text NOT NULL,
	`version` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`meta_json` text NOT NULL,
	`extra_json` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `novel_projects_v2`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `entities_v2_project_id_idx` ON `entities_v2` (`project_id`);
--> statement-breakpoint
CREATE INDEX `entities_v2_project_type_idx` ON `entities_v2` (`project_id`,`entity_type`);
--> statement-breakpoint
CREATE UNIQUE INDEX `entities_v2_project_type_name_unique` ON `entities_v2` (`project_id`,`entity_type`,`canonical_name`);
--> statement-breakpoint
CREATE TABLE `entity_aliases_v2` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_id` text NOT NULL,
	`alias` text NOT NULL,
	`alias_type` text NOT NULL,
	`sort_order` integer NOT NULL,
	`status` text NOT NULL,
	`version` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`meta_json` text NOT NULL,
	`extra_json` text NOT NULL,
	FOREIGN KEY (`entity_id`) REFERENCES `entities_v2`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `entity_aliases_v2_entity_id_idx` ON `entity_aliases_v2` (`entity_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `entity_aliases_v2_entity_sort_unique` ON `entity_aliases_v2` (`entity_id`,`sort_order`);
--> statement-breakpoint
CREATE TABLE `entity_edges_v2` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`source_entity_id` text NOT NULL,
	`target_entity_id` text NOT NULL,
	`edge_type` text NOT NULL,
	`public_label` text NOT NULL,
	`private_label` text,
	`directionality` text NOT NULL,
	`weight` integer NOT NULL,
	`status` text NOT NULL,
	`version` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`meta_json` text NOT NULL,
	`extra_json` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `novel_projects_v2`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_entity_id`) REFERENCES `entities_v2`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_entity_id`) REFERENCES `entities_v2`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `entity_edges_v2_project_id_idx` ON `entity_edges_v2` (`project_id`);
--> statement-breakpoint
CREATE INDEX `entity_edges_v2_source_idx` ON `entity_edges_v2` (`source_entity_id`);
--> statement-breakpoint
CREATE INDEX `entity_edges_v2_target_idx` ON `entity_edges_v2` (`target_entity_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `entity_edges_v2_pair_unique` ON `entity_edges_v2` (`source_entity_id`,`target_entity_id`,`edge_type`,`public_label`);
--> statement-breakpoint
CREATE TABLE `panel_templates_v2` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_key` text NOT NULL,
	`project_id` text,
	`scope` text NOT NULL,
	`template_key` text NOT NULL,
	`label` text NOT NULL,
	`applies_to_entity_type` text NOT NULL,
	`description` text,
	`status` text NOT NULL,
	`version` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`meta_json` text NOT NULL,
	`extra_json` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `novel_projects_v2`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `panel_templates_v2_owner_idx` ON `panel_templates_v2` (`owner_key`);
--> statement-breakpoint
CREATE INDEX `panel_templates_v2_project_id_idx` ON `panel_templates_v2` (`project_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `panel_templates_v2_owner_template_key_unique` ON `panel_templates_v2` (`owner_key`,`template_key`);
--> statement-breakpoint
CREATE TABLE `panel_fields_v2` (
	`id` text PRIMARY KEY NOT NULL,
	`template_id` text NOT NULL,
	`field_key` text NOT NULL,
	`label` text NOT NULL,
	`value_type` text NOT NULL,
	`cardinality` text NOT NULL,
	`display_group` text,
	`is_searchable` integer NOT NULL,
	`is_filterable` integer NOT NULL,
	`is_timeline_tracked` integer NOT NULL,
	`default_value_json` text,
	`sort_order` integer NOT NULL,
	`status` text NOT NULL,
	`version` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`meta_json` text NOT NULL,
	`extra_json` text NOT NULL,
	FOREIGN KEY (`template_id`) REFERENCES `panel_templates_v2`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `panel_fields_v2_template_id_idx` ON `panel_fields_v2` (`template_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `panel_fields_v2_template_field_key_unique` ON `panel_fields_v2` (`template_id`,`field_key`);
--> statement-breakpoint
CREATE UNIQUE INDEX `panel_fields_v2_template_sort_unique` ON `panel_fields_v2` (`template_id`,`sort_order`);
--> statement-breakpoint
CREATE TABLE `entity_panel_values_v2` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`entity_id` text NOT NULL,
	`template_id` text NOT NULL,
	`field_id` text NOT NULL,
	`value_text` text,
	`value_integer` integer,
	`value_number` real,
	`value_boolean` integer,
	`value_json` text,
	`status` text NOT NULL,
	`version` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`meta_json` text NOT NULL,
	`extra_json` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `novel_projects_v2`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entity_id`) REFERENCES `entities_v2`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`template_id`) REFERENCES `panel_templates_v2`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`field_id`) REFERENCES `panel_fields_v2`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `entity_panel_values_v2_project_id_idx` ON `entity_panel_values_v2` (`project_id`);
--> statement-breakpoint
CREATE INDEX `entity_panel_values_v2_entity_id_idx` ON `entity_panel_values_v2` (`entity_id`);
--> statement-breakpoint
CREATE INDEX `entity_panel_values_v2_template_id_idx` ON `entity_panel_values_v2` (`template_id`);
--> statement-breakpoint
CREATE INDEX `entity_panel_values_v2_field_id_idx` ON `entity_panel_values_v2` (`field_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `entity_panel_values_v2_entity_field_unique` ON `entity_panel_values_v2` (`entity_id`,`field_id`);
--> statement-breakpoint
CREATE TABLE `entity_state_events_v2` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`entity_id` text NOT NULL,
	`field_id` text,
	`chapter_id` text,
	`event_type` text NOT NULL,
	`reason` text,
	`old_value_json` text,
	`new_value_json` text,
	`source_artifact_id` text,
	`status` text NOT NULL,
	`version` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`meta_json` text NOT NULL,
	`extra_json` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `novel_projects_v2`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entity_id`) REFERENCES `entities_v2`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`field_id`) REFERENCES `panel_fields_v2`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters_v2`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `entity_state_events_v2_project_id_idx` ON `entity_state_events_v2` (`project_id`);
--> statement-breakpoint
CREATE INDEX `entity_state_events_v2_entity_id_idx` ON `entity_state_events_v2` (`entity_id`);
--> statement-breakpoint
CREATE INDEX `entity_state_events_v2_field_id_idx` ON `entity_state_events_v2` (`field_id`);
--> statement-breakpoint
CREATE INDEX `entity_state_events_v2_chapter_id_idx` ON `entity_state_events_v2` (`chapter_id`);
--> statement-breakpoint
CREATE TABLE `tag_taxonomies_v2` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_key` text NOT NULL,
	`project_id` text,
	`scope` text NOT NULL,
	`taxonomy_key` text NOT NULL,
	`label` text NOT NULL,
	`description` text,
	`status` text NOT NULL,
	`version` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`meta_json` text NOT NULL,
	`extra_json` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `novel_projects_v2`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tag_taxonomies_v2_owner_idx` ON `tag_taxonomies_v2` (`owner_key`);
--> statement-breakpoint
CREATE INDEX `tag_taxonomies_v2_project_id_idx` ON `tag_taxonomies_v2` (`project_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `tag_taxonomies_v2_owner_taxonomy_key_unique` ON `tag_taxonomies_v2` (`owner_key`,`taxonomy_key`);
--> statement-breakpoint
CREATE TABLE `entity_tags_v2` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`entity_id` text NOT NULL,
	`taxonomy_id` text NOT NULL,
	`tag_code` text NOT NULL,
	`tag_label` text NOT NULL,
	`weight` integer NOT NULL,
	`status` text NOT NULL,
	`version` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`meta_json` text NOT NULL,
	`extra_json` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `novel_projects_v2`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entity_id`) REFERENCES `entities_v2`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`taxonomy_id`) REFERENCES `tag_taxonomies_v2`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `entity_tags_v2_project_id_idx` ON `entity_tags_v2` (`project_id`);
--> statement-breakpoint
CREATE INDEX `entity_tags_v2_entity_id_idx` ON `entity_tags_v2` (`entity_id`);
--> statement-breakpoint
CREATE INDEX `entity_tags_v2_taxonomy_id_idx` ON `entity_tags_v2` (`taxonomy_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `entity_tags_v2_entity_taxonomy_code_unique` ON `entity_tags_v2` (`entity_id`,`taxonomy_id`,`tag_code`);
--> statement-breakpoint
CREATE TABLE `task_templates_v2` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_key` text NOT NULL,
	`project_id` text,
	`scope` text NOT NULL,
	`template_key` text NOT NULL,
	`label` text NOT NULL,
	`task_type` text NOT NULL,
	`description` text,
	`status` text NOT NULL,
	`version` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`meta_json` text NOT NULL,
	`extra_json` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `novel_projects_v2`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `task_templates_v2_owner_idx` ON `task_templates_v2` (`owner_key`);
--> statement-breakpoint
CREATE INDEX `task_templates_v2_project_id_idx` ON `task_templates_v2` (`project_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `task_templates_v2_owner_template_key_unique` ON `task_templates_v2` (`owner_key`,`template_key`);
--> statement-breakpoint
CREATE TABLE `task_requirements_v2` (
	`id` text PRIMARY KEY NOT NULL,
	`task_template_id` text NOT NULL,
	`requirement_key` text NOT NULL,
	`requirement_type` text NOT NULL,
	`target_key` text NOT NULL,
	`expected_text` text,
	`expected_number` real,
	`weight` integer NOT NULL,
	`sort_order` integer NOT NULL,
	`status` text NOT NULL,
	`version` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`meta_json` text NOT NULL,
	`extra_json` text NOT NULL,
	FOREIGN KEY (`task_template_id`) REFERENCES `task_templates_v2`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `task_requirements_v2_template_id_idx` ON `task_requirements_v2` (`task_template_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `task_requirements_v2_template_requirement_key_unique` ON `task_requirements_v2` (`task_template_id`,`requirement_key`);
--> statement-breakpoint
CREATE UNIQUE INDEX `task_requirements_v2_template_sort_unique` ON `task_requirements_v2` (`task_template_id`,`sort_order`);
--> statement-breakpoint
CREATE TABLE `task_assignments_v2` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`task_template_id` text NOT NULL,
	`entity_id` text NOT NULL,
	`assignment_status` text NOT NULL,
	`rationale` text,
	`status` text NOT NULL,
	`version` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`meta_json` text NOT NULL,
	`extra_json` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `novel_projects_v2`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_template_id`) REFERENCES `task_templates_v2`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entity_id`) REFERENCES `entities_v2`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `task_assignments_v2_project_id_idx` ON `task_assignments_v2` (`project_id`);
--> statement-breakpoint
CREATE INDEX `task_assignments_v2_template_id_idx` ON `task_assignments_v2` (`task_template_id`);
--> statement-breakpoint
CREATE INDEX `task_assignments_v2_entity_id_idx` ON `task_assignments_v2` (`entity_id`);
--> statement-breakpoint
CREATE TABLE `entity_task_matches_v2` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`task_template_id` text NOT NULL,
	`entity_id` text NOT NULL,
	`match_score` real NOT NULL,
	`match_label` text,
	`reasons_json` text NOT NULL,
	`status` text NOT NULL,
	`version` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`meta_json` text NOT NULL,
	`extra_json` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `novel_projects_v2`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_template_id`) REFERENCES `task_templates_v2`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entity_id`) REFERENCES `entities_v2`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `entity_task_matches_v2_project_id_idx` ON `entity_task_matches_v2` (`project_id`);
--> statement-breakpoint
CREATE INDEX `entity_task_matches_v2_template_id_idx` ON `entity_task_matches_v2` (`task_template_id`);
--> statement-breakpoint
CREATE INDEX `entity_task_matches_v2_entity_id_idx` ON `entity_task_matches_v2` (`entity_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `entity_task_matches_v2_task_entity_unique` ON `entity_task_matches_v2` (`task_template_id`,`entity_id`);
