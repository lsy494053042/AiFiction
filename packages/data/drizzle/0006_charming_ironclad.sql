CREATE TABLE `knowledge_profile_rules_v2` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`knowledge_item_id` text NOT NULL,
	`binding_status` text NOT NULL,
	`binding_reason` text,
	`status` text NOT NULL,
	`version` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`meta_json` text NOT NULL,
	`extra_json` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `knowledge_profiles_v2`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`knowledge_item_id`) REFERENCES `knowledge_items_v2`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `knowledge_profile_rules_v2_profile_id_idx` ON `knowledge_profile_rules_v2` (`profile_id`);--> statement-breakpoint
CREATE INDEX `knowledge_profile_rules_v2_item_id_idx` ON `knowledge_profile_rules_v2` (`knowledge_item_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `knowledge_profile_rules_v2_profile_item_unique` ON `knowledge_profile_rules_v2` (`profile_id`,`knowledge_item_id`);--> statement-breakpoint
CREATE TABLE `knowledge_profiles_v2` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_key` text NOT NULL,
	`project_id` text,
	`scope` text NOT NULL,
	`profile_key` text NOT NULL,
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
CREATE INDEX `knowledge_profiles_v2_owner_idx` ON `knowledge_profiles_v2` (`owner_key`);--> statement-breakpoint
CREATE INDEX `knowledge_profiles_v2_project_id_idx` ON `knowledge_profiles_v2` (`project_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `knowledge_profiles_v2_owner_profile_key_unique` ON `knowledge_profiles_v2` (`owner_key`,`profile_key`);