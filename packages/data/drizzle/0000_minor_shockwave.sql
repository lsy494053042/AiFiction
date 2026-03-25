CREATE TABLE `chapter_cards` (
	`id` text PRIMARY KEY NOT NULL,
	`work_id` text NOT NULL,
	`volume_id` text NOT NULL,
	`order` integer NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`chapter_goal` text NOT NULL,
	`conflict` text NOT NULL,
	`entry_state` text NOT NULL,
	`exit_state` text NOT NULL,
	`new_info` text NOT NULL,
	`foreshadow_seeds` text NOT NULL,
	`required_callbacks` text NOT NULL,
	`ending_hook` text NOT NULL,
	`key_characters` text NOT NULL,
	`scene_cards` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`volume_id`) REFERENCES `volume_outlines`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `chapter_cards_work_id_idx` ON `chapter_cards` (`work_id`);--> statement-breakpoint
CREATE INDEX `chapter_cards_volume_id_idx` ON `chapter_cards` (`volume_id`);--> statement-breakpoint
CREATE TABLE `character_states` (
	`snapshot_id` text PRIMARY KEY NOT NULL,
	`work_id` text NOT NULL,
	`chapter_id` text NOT NULL,
	`character_id` text NOT NULL,
	`knows` text NOT NULL,
	`resources` text NOT NULL,
	`wounds` text NOT NULL,
	`emotional_state` text NOT NULL,
	`stance_summary` text NOT NULL,
	`relationship_deltas` text NOT NULL,
	`unresolved_threads` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `character_states_work_id_idx` ON `character_states` (`work_id`);--> statement-breakpoint
CREATE INDEX `character_states_character_id_idx` ON `character_states` (`character_id`);--> statement-breakpoint
CREATE INDEX `character_states_chapter_id_idx` ON `character_states` (`chapter_id`);--> statement-breakpoint
CREATE TABLE `characters` (
	`id` text PRIMARY KEY NOT NULL,
	`work_id` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`archetype` text NOT NULL,
	`public_identity` text NOT NULL,
	`hidden_identity` text,
	`core_desire` text NOT NULL,
	`core_fear` text NOT NULL,
	`strengths` text NOT NULL,
	`flaws` text NOT NULL,
	`secrets` text NOT NULL,
	`speech_style` text NOT NULL,
	`growth_arc` text NOT NULL,
	`relationships` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `characters_work_id_idx` ON `characters` (`work_id`);--> statement-breakpoint
CREATE TABLE `foreshadow_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`work_id` text NOT NULL,
	`seed_chapter_id` text NOT NULL,
	`description` text NOT NULL,
	`narrative_purpose` text NOT NULL,
	`expected_payoff_volume_id` text,
	`expected_payoff_chapter_id` text,
	`actual_payoff_chapter_id` text,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `foreshadow_ledger_work_id_idx` ON `foreshadow_ledger` (`work_id`);--> statement-breakpoint
CREATE TABLE `pipeline_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`work_id` text NOT NULL,
	`chapter_id` text,
	`stage` text NOT NULL,
	`prompt_version` text NOT NULL,
	`model` text NOT NULL,
	`success` integer NOT NULL,
	`input_summary` text NOT NULL,
	`output_summary` text NOT NULL,
	`estimated_token_cost` real NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`error_message` text,
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `pipeline_runs_work_id_idx` ON `pipeline_runs` (`work_id`);--> statement-breakpoint
CREATE INDEX `pipeline_runs_chapter_id_idx` ON `pipeline_runs` (`chapter_id`);--> statement-breakpoint
CREATE TABLE `style_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`work_id` text NOT NULL,
	`perspective` text NOT NULL,
	`language_density` text NOT NULL,
	`pacing` text NOT NULL,
	`emotion_level` text NOT NULL,
	`dialogue_ratio` real NOT NULL,
	`sensory_detail_level` real NOT NULL,
	`humor_ratio` real NOT NULL,
	`banned_patterns` text NOT NULL,
	`style_anchors` text NOT NULL,
	`notes` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `style_profiles_work_id_unique` ON `style_profiles` (`work_id`);--> statement-breakpoint
CREATE TABLE `timeline_events` (
	`id` text PRIMARY KEY NOT NULL,
	`work_id` text NOT NULL,
	`in_world_day` integer NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`related_chapter_id` text NOT NULL,
	`involved_character_ids` text NOT NULL,
	`consequences` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `timeline_events_work_id_idx` ON `timeline_events` (`work_id`);--> statement-breakpoint
CREATE INDEX `timeline_events_related_chapter_id_idx` ON `timeline_events` (`related_chapter_id`);--> statement-breakpoint
CREATE TABLE `volume_outlines` (
	`id` text PRIMARY KEY NOT NULL,
	`work_id` text NOT NULL,
	`order` integer NOT NULL,
	`title` text NOT NULL,
	`goal` text NOT NULL,
	`main_conflict` text NOT NULL,
	`entry_hook` text NOT NULL,
	`climax` text NOT NULL,
	`payoff` text NOT NULL,
	`must_deliver_info` text NOT NULL,
	`key_characters` text NOT NULL,
	`planned_chapter_count` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `volume_outlines_work_id_idx` ON `volume_outlines` (`work_id`);--> statement-breakpoint
CREATE TABLE `works` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`tagline` text NOT NULL,
	`genre` text NOT NULL,
	`subgenre` text,
	`target_platform` text NOT NULL,
	`target_audience` text NOT NULL,
	`target_word_count` integer NOT NULL,
	`daily_word_target` integer NOT NULL,
	`update_cadence` text NOT NULL,
	`commercial_hooks` text NOT NULL,
	`hard_constraints` text NOT NULL,
	`content_warnings` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `works_slug_unique` ON `works` (`slug`);--> statement-breakpoint
CREATE TABLE `world_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`work_id` text NOT NULL,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`hard_constraint` integer NOT NULL,
	`examples` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `world_rules_work_id_idx` ON `world_rules` (`work_id`);--> statement-breakpoint
CREATE TABLE `artifact_versions_v2` (
	`id` text PRIMARY KEY NOT NULL,
	`artifact_id` text NOT NULL,
	`version_label` text NOT NULL,
	`parent_version_id` text,
	`content_format` text NOT NULL,
	`content_text` text,
	`content_json` text,
	`source_run_step_id` text,
	`status` text NOT NULL,
	`version` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`meta_json` text NOT NULL,
	`extra_json` text NOT NULL,
	FOREIGN KEY (`artifact_id`) REFERENCES `artifacts_v2`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `artifact_versions_v2_artifact_id_idx` ON `artifact_versions_v2` (`artifact_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `artifact_versions_v2_artifact_version_unique` ON `artifact_versions_v2` (`artifact_id`,`version_label`);--> statement-breakpoint
CREATE TABLE `artifacts_v2` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`artifact_key` text NOT NULL,
	`artifact_kind` text NOT NULL,
	`scope_type` text NOT NULL,
	`scope_id` text NOT NULL,
	`current_version_id` text,
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
CREATE INDEX `artifacts_v2_project_id_idx` ON `artifacts_v2` (`project_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `artifacts_v2_project_scope_key_unique` ON `artifacts_v2` (`project_id`,`scope_type`,`scope_id`,`artifact_key`);--> statement-breakpoint
CREATE TABLE `chapter_scenes_v2` (
	`id` text PRIMARY KEY NOT NULL,
	`chapter_id` text NOT NULL,
	`title` text NOT NULL,
	`purpose` text NOT NULL,
	`conflict` text NOT NULL,
	`emotional_shift` text NOT NULL,
	`sort_order` integer NOT NULL,
	`status` text NOT NULL,
	`version` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`meta_json` text NOT NULL,
	`extra_json` text NOT NULL,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters_v2`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `chapter_scenes_v2_chapter_id_idx` ON `chapter_scenes_v2` (`chapter_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `chapter_scenes_v2_chapter_sort_unique` ON `chapter_scenes_v2` (`chapter_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `chapters_v2` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`volume_id` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`chapter_goal` text NOT NULL,
	`conflict` text NOT NULL,
	`entry_state` text NOT NULL,
	`exit_state` text NOT NULL,
	`ending_hook` text NOT NULL,
	`current_artifact_id` text,
	`sort_order` integer NOT NULL,
	`status` text NOT NULL,
	`version` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`meta_json` text NOT NULL,
	`extra_json` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `novel_projects_v2`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`volume_id`) REFERENCES `volumes_v2`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `chapters_v2_project_id_idx` ON `chapters_v2` (`project_id`);--> statement-breakpoint
CREATE INDEX `chapters_v2_volume_id_idx` ON `chapters_v2` (`volume_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `chapters_v2_volume_sort_unique` ON `chapters_v2` (`volume_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `character_aliases_v2` (
	`id` text PRIMARY KEY NOT NULL,
	`character_id` text NOT NULL,
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
	FOREIGN KEY (`character_id`) REFERENCES `characters_v2`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `character_aliases_v2_character_id_idx` ON `character_aliases_v2` (`character_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `character_aliases_v2_character_sort_unique` ON `character_aliases_v2` (`character_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `character_relationships_v2` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`source_character_id` text NOT NULL,
	`target_character_id` text NOT NULL,
	`public_label` text NOT NULL,
	`private_label` text,
	`trust_level` integer NOT NULL,
	`tension_level` integer NOT NULL,
	`status` text NOT NULL,
	`version` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`meta_json` text NOT NULL,
	`extra_json` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `novel_projects_v2`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_character_id`) REFERENCES `characters_v2`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_character_id`) REFERENCES `characters_v2`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `character_relationships_v2_source_idx` ON `character_relationships_v2` (`source_character_id`);--> statement-breakpoint
CREATE INDEX `character_relationships_v2_target_idx` ON `character_relationships_v2` (`target_character_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `character_relationships_v2_pair_unique` ON `character_relationships_v2` (`source_character_id`,`target_character_id`,`public_label`);--> statement-breakpoint
CREATE TABLE `characters_v2` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`role_type` text NOT NULL,
	`archetype` text NOT NULL,
	`public_identity` text NOT NULL,
	`hidden_identity` text,
	`core_desire` text NOT NULL,
	`core_fear` text NOT NULL,
	`growth_arc` text NOT NULL,
	`speech_guide` text NOT NULL,
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
CREATE INDEX `characters_v2_project_id_idx` ON `characters_v2` (`project_id`);--> statement-breakpoint
CREATE TABLE `entity_state_snapshots_v2` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`chapter_id` text,
	`snapshot_label` text NOT NULL,
	`state_json` text NOT NULL,
	`source_artifact_id` text,
	`status` text NOT NULL,
	`version` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`meta_json` text NOT NULL,
	`extra_json` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `novel_projects_v2`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters_v2`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `entity_state_snapshots_v2_project_id_idx` ON `entity_state_snapshots_v2` (`project_id`);--> statement-breakpoint
CREATE INDEX `entity_state_snapshots_v2_entity_idx` ON `entity_state_snapshots_v2` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `entity_state_snapshots_v2_chapter_id_idx` ON `entity_state_snapshots_v2` (`chapter_id`);--> statement-breakpoint
CREATE TABLE `foreshadow_links_v2` (
	`id` text PRIMARY KEY NOT NULL,
	`foreshadow_id` text NOT NULL,
	`link_type` text NOT NULL,
	`target_id` text NOT NULL,
	`note` text,
	`status` text NOT NULL,
	`version` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`meta_json` text NOT NULL,
	`extra_json` text NOT NULL,
	FOREIGN KEY (`foreshadow_id`) REFERENCES `foreshadows_v2`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `foreshadow_links_v2_foreshadow_id_idx` ON `foreshadow_links_v2` (`foreshadow_id`);--> statement-breakpoint
CREATE TABLE `foreshadows_v2` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`seed_chapter_id` text NOT NULL,
	`description` text NOT NULL,
	`narrative_purpose` text NOT NULL,
	`payoff_status` text NOT NULL,
	`expected_payoff_chapter_id` text,
	`actual_payoff_chapter_id` text,
	`status` text NOT NULL,
	`version` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`meta_json` text NOT NULL,
	`extra_json` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `novel_projects_v2`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`seed_chapter_id`) REFERENCES `chapters_v2`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`expected_payoff_chapter_id`) REFERENCES `chapters_v2`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`actual_payoff_chapter_id`) REFERENCES `chapters_v2`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `foreshadows_v2_project_id_idx` ON `foreshadows_v2` (`project_id`);--> statement-breakpoint
CREATE INDEX `foreshadows_v2_seed_chapter_id_idx` ON `foreshadows_v2` (`seed_chapter_id`);--> statement-breakpoint
CREATE TABLE `guardrail_profiles_v2` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`label` text NOT NULL,
	`profile_key` text NOT NULL,
	`perspective` text NOT NULL,
	`pacing_level` text NOT NULL,
	`language_density` text NOT NULL,
	`emotion_level` text NOT NULL,
	`banned_patterns` text NOT NULL,
	`hard_constraints` text NOT NULL,
	`style_anchors` text NOT NULL,
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
CREATE INDEX `guardrail_profiles_v2_project_id_idx` ON `guardrail_profiles_v2` (`project_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `guardrail_profiles_v2_project_profile_key_unique` ON `guardrail_profiles_v2` (`project_id`,`profile_key`);--> statement-breakpoint
CREATE TABLE `novel_projects_v2` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`subtitle` text,
	`owner_mode` text NOT NULL,
	`workflow_phase` text NOT NULL,
	`primary_genre` text NOT NULL,
	`secondary_genre` text,
	`active_profile_id` text,
	`active_guardrail_profile_id` text,
	`active_outline_artifact_id` text,
	`summary` text,
	`status` text NOT NULL,
	`version` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`meta_json` text NOT NULL,
	`extra_json` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `novel_projects_v2_slug_unique` ON `novel_projects_v2` (`slug`);--> statement-breakpoint
CREATE INDEX `novel_projects_v2_phase_idx` ON `novel_projects_v2` (`workflow_phase`);--> statement-breakpoint
CREATE TABLE `pipeline_run_steps_v2` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`step_key` text NOT NULL,
	`step_type` text NOT NULL,
	`provider_name` text,
	`model_name` text,
	`input_artifact_id` text,
	`output_artifact_id` text,
	`error_code` text,
	`error_message` text,
	`started_at` text NOT NULL,
	`finished_at` text,
	`sort_order` integer NOT NULL,
	`status` text NOT NULL,
	`version` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`meta_json` text NOT NULL,
	`extra_json` text NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `pipeline_runs_v2`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `pipeline_run_steps_v2_run_id_idx` ON `pipeline_run_steps_v2` (`run_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `pipeline_run_steps_v2_run_sort_unique` ON `pipeline_run_steps_v2` (`run_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `pipeline_runs_v2` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`scope_type` text NOT NULL,
	`scope_id` text NOT NULL,
	`workflow_name` text NOT NULL,
	`workflow_version` text NOT NULL,
	`execution_mode` text NOT NULL,
	`provider_name` text,
	`model_name` text,
	`estimated_token_cost` integer NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
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
CREATE INDEX `pipeline_runs_v2_project_id_idx` ON `pipeline_runs_v2` (`project_id`);--> statement-breakpoint
CREATE INDEX `pipeline_runs_v2_workflow_idx` ON `pipeline_runs_v2` (`workflow_name`,`workflow_version`);--> statement-breakpoint
CREATE TABLE `project_profiles_v2` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`profile_key` text NOT NULL,
	`label` text NOT NULL,
	`target_platform` text NOT NULL,
	`target_audience` text NOT NULL,
	`target_word_count` integer NOT NULL,
	`daily_word_target` integer NOT NULL,
	`update_cadence` text NOT NULL,
	`commercialization_hooks` text NOT NULL,
	`promise_summary` text NOT NULL,
	`risk_notes` text NOT NULL,
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
CREATE INDEX `project_profiles_v2_project_id_idx` ON `project_profiles_v2` (`project_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `project_profiles_v2_project_profile_key_unique` ON `project_profiles_v2` (`project_id`,`profile_key`);--> statement-breakpoint
CREATE TABLE `project_tags_v2` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`code` text NOT NULL,
	`display_name` text NOT NULL,
	`group_name` text NOT NULL,
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
CREATE INDEX `project_tags_v2_project_id_idx` ON `project_tags_v2` (`project_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `project_tags_v2_project_id_code_unique` ON `project_tags_v2` (`project_id`,`code`);--> statement-breakpoint
CREATE TABLE `prompt_template_versions_v2` (
	`id` text PRIMARY KEY NOT NULL,
	`template_id` text NOT NULL,
	`version_name` text NOT NULL,
	`system_prompt` text NOT NULL,
	`user_prompt` text NOT NULL,
	`output_contract` text,
	`change_summary` text,
	`status` text NOT NULL,
	`version` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`meta_json` text NOT NULL,
	`extra_json` text NOT NULL,
	FOREIGN KEY (`template_id`) REFERENCES `prompt_templates_v2`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `prompt_template_versions_v2_template_id_idx` ON `prompt_template_versions_v2` (`template_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `prompt_template_versions_v2_unique` ON `prompt_template_versions_v2` (`template_id`,`version_name`);--> statement-breakpoint
CREATE TABLE `prompt_templates_v2` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`template_key` text NOT NULL,
	`stage` text NOT NULL,
	`owner_scope` text NOT NULL,
	`current_version_id` text,
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
CREATE UNIQUE INDEX `prompt_templates_v2_scope_key_unique` ON `prompt_templates_v2` (`project_id`,`template_key`);--> statement-breakpoint
CREATE TABLE `timeline_events_v2` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`chapter_id` text,
	`in_world_day` integer NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`impact_summary` text,
	`status` text NOT NULL,
	`version` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`meta_json` text NOT NULL,
	`extra_json` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `novel_projects_v2`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters_v2`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `timeline_events_v2_project_id_idx` ON `timeline_events_v2` (`project_id`);--> statement-breakpoint
CREATE INDEX `timeline_events_v2_day_idx` ON `timeline_events_v2` (`in_world_day`);--> statement-breakpoint
CREATE TABLE `volumes_v2` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`title` text NOT NULL,
	`phase_goal` text NOT NULL,
	`main_conflict` text NOT NULL,
	`planned_chapter_count` integer NOT NULL,
	`sort_order` integer NOT NULL,
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
CREATE INDEX `volumes_v2_project_id_idx` ON `volumes_v2` (`project_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `volumes_v2_project_sort_unique` ON `volumes_v2` (`project_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `world_rules_v2` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`severity` text NOT NULL,
	`is_hard_constraint` integer NOT NULL,
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
CREATE INDEX `world_rules_v2_project_id_idx` ON `world_rules_v2` (`project_id`);