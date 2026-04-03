CREATE TABLE `knowledge_batches_v2` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`batch_key` text NOT NULL,
	`stage_label` text,
	`focus_label` text,
	`chapter_from` integer,
	`chapter_to` integer,
	`review_status` text NOT NULL,
	`source_review_file` text,
	`source_review_data_file` text,
	`source_candidates_file` text,
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
CREATE INDEX `knowledge_batches_v2_project_id_idx` ON `knowledge_batches_v2` (`project_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `knowledge_batches_v2_project_batch_key_unique` ON `knowledge_batches_v2` (`project_id`,`batch_key`);--> statement-breakpoint
CREATE TABLE `knowledge_findings_v2` (
	`id` text PRIMARY KEY NOT NULL,
	`batch_id` text NOT NULL,
	`project_id` text NOT NULL,
	`source_type` text NOT NULL,
	`feedback_tier` text NOT NULL,
	`domain` text NOT NULL,
	`severity` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`source_path` text,
	`source_document_id` text,
	`risk_nature` text,
	`risk_reasons` text NOT NULL,
	`evidence_paths` text NOT NULL,
	`status` text NOT NULL,
	`version` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`meta_json` text NOT NULL,
	`extra_json` text NOT NULL,
	FOREIGN KEY (`batch_id`) REFERENCES `knowledge_batches_v2`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `novel_projects_v2`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `knowledge_findings_v2_batch_id_idx` ON `knowledge_findings_v2` (`batch_id`);--> statement-breakpoint
CREATE INDEX `knowledge_findings_v2_project_id_idx` ON `knowledge_findings_v2` (`project_id`);--> statement-breakpoint
CREATE INDEX `knowledge_findings_v2_project_severity_idx` ON `knowledge_findings_v2` (`project_id`,`severity`);--> statement-breakpoint
CREATE TABLE `knowledge_items_v2` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`batch_id` text,
	`source_finding_id` text,
	`scope` text NOT NULL,
	`status` text NOT NULL,
	`domain` text NOT NULL,
	`priority` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`rationale` text NOT NULL,
	`prompt` text,
	`validation_count` integer NOT NULL,
	`profile_affinity` text NOT NULL,
	`evidence_paths` text NOT NULL,
	`version` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`meta_json` text NOT NULL,
	`extra_json` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `novel_projects_v2`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`batch_id`) REFERENCES `knowledge_batches_v2`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_finding_id`) REFERENCES `knowledge_findings_v2`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `knowledge_items_v2_project_id_idx` ON `knowledge_items_v2` (`project_id`);--> statement-breakpoint
CREATE INDEX `knowledge_items_v2_batch_id_idx` ON `knowledge_items_v2` (`batch_id`);--> statement-breakpoint
CREATE INDEX `knowledge_items_v2_scope_status_idx` ON `knowledge_items_v2` (`scope`,`status`);