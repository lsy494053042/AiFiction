CREATE TABLE `follow_up_task_states_v2` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`chapter_id` text NOT NULL,
	`task_kind` text NOT NULL,
	`task_fingerprint` text NOT NULL,
	`task_status` text NOT NULL,
	`decision_note` text,
	`decided_at` text,
	`status` text NOT NULL,
	`version` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`meta_json` text NOT NULL,
	`extra_json` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `novel_projects_v2`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters_v2`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `follow_up_task_states_v2_project_id_idx` ON `follow_up_task_states_v2` (`project_id`);--> statement-breakpoint
CREATE INDEX `follow_up_task_states_v2_chapter_id_idx` ON `follow_up_task_states_v2` (`chapter_id`);--> statement-breakpoint
CREATE INDEX `follow_up_task_states_v2_status_idx` ON `follow_up_task_states_v2` (`task_status`);--> statement-breakpoint
CREATE UNIQUE INDEX `follow_up_task_states_v2_project_chapter_kind_unique` ON `follow_up_task_states_v2` (`project_id`,`chapter_id`,`task_kind`);