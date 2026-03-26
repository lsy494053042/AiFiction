CREATE TABLE `asset_updates_v2` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`sync_run_id` text,
	`source_document_id` text,
	`asset_type` text NOT NULL,
	`asset_id` text,
	`update_kind` text NOT NULL,
	`confidence_level` text NOT NULL,
	`proposed_payload_json` text NOT NULL,
	`applied_status` text NOT NULL,
	`applied_at` text,
	`status` text NOT NULL,
	`version` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`meta_json` text NOT NULL,
	`extra_json` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `novel_projects_v2`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sync_run_id`) REFERENCES `sync_runs_v2`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`source_document_id`) REFERENCES `source_documents_v2`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `asset_updates_v2_project_id_idx` ON `asset_updates_v2` (`project_id`);--> statement-breakpoint
CREATE INDEX `asset_updates_v2_sync_run_id_idx` ON `asset_updates_v2` (`sync_run_id`);--> statement-breakpoint
CREATE INDEX `asset_updates_v2_asset_idx` ON `asset_updates_v2` (`asset_type`,`asset_id`);--> statement-breakpoint
CREATE INDEX `asset_updates_v2_applied_status_idx` ON `asset_updates_v2` (`applied_status`);--> statement-breakpoint
CREATE TABLE `file_sources_v2` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`source_key` text NOT NULL,
	`label` text NOT NULL,
	`source_kind` text NOT NULL,
	`root_path` text NOT NULL,
	`chapter_path` text,
	`outline_path` text,
	`export_path` text,
	`scan_policy_json` text NOT NULL,
	`is_active` integer NOT NULL,
	`last_scanned_at` text,
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
CREATE INDEX `file_sources_v2_project_id_idx` ON `file_sources_v2` (`project_id`);--> statement-breakpoint
CREATE INDEX `file_sources_v2_project_active_idx` ON `file_sources_v2` (`project_id`,`is_active`);--> statement-breakpoint
CREATE UNIQUE INDEX `file_sources_v2_project_source_key_unique` ON `file_sources_v2` (`project_id`,`source_key`);--> statement-breakpoint
CREATE TABLE `review_queue_v2` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`sync_run_id` text,
	`source_document_id` text,
	`asset_update_id` text,
	`source_type` text NOT NULL,
	`source_id` text,
	`review_kind` text NOT NULL,
	`severity` text NOT NULL,
	`status` text NOT NULL,
	`summary` text NOT NULL,
	`detail_json` text NOT NULL,
	`decision_note` text,
	`decided_at` text,
	`version` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`meta_json` text NOT NULL,
	`extra_json` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `novel_projects_v2`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sync_run_id`) REFERENCES `sync_runs_v2`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`source_document_id`) REFERENCES `source_documents_v2`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`asset_update_id`) REFERENCES `asset_updates_v2`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `review_queue_v2_project_id_idx` ON `review_queue_v2` (`project_id`);--> statement-breakpoint
CREATE INDEX `review_queue_v2_sync_run_id_idx` ON `review_queue_v2` (`sync_run_id`);--> statement-breakpoint
CREATE INDEX `review_queue_v2_status_idx` ON `review_queue_v2` (`status`);--> statement-breakpoint
CREATE INDEX `review_queue_v2_severity_idx` ON `review_queue_v2` (`severity`);--> statement-breakpoint
CREATE TABLE `source_documents_v2` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`file_source_id` text NOT NULL,
	`relative_path` text NOT NULL,
	`document_kind` text NOT NULL,
	`checksum` text NOT NULL,
	`file_size_bytes` integer,
	`last_modified_at` text NOT NULL,
	`sync_status` text NOT NULL,
	`mapped_scope_type` text,
	`mapped_scope_id` text,
	`current_artifact_id` text,
	`status` text NOT NULL,
	`version` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`meta_json` text NOT NULL,
	`extra_json` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `novel_projects_v2`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`file_source_id`) REFERENCES `file_sources_v2`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`current_artifact_id`) REFERENCES `artifacts_v2`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `source_documents_v2_project_id_idx` ON `source_documents_v2` (`project_id`);--> statement-breakpoint
CREATE INDEX `source_documents_v2_file_source_id_idx` ON `source_documents_v2` (`file_source_id`);--> statement-breakpoint
CREATE INDEX `source_documents_v2_sync_status_idx` ON `source_documents_v2` (`sync_status`);--> statement-breakpoint
CREATE UNIQUE INDEX `source_documents_v2_file_source_path_unique` ON `source_documents_v2` (`file_source_id`,`relative_path`);--> statement-breakpoint
CREATE TABLE `source_refs_v2` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`asset_type` text NOT NULL,
	`asset_id` text NOT NULL,
	`source_document_id` text,
	`artifact_version_id` text,
	`reference_kind` text NOT NULL,
	`locator` text NOT NULL,
	`evidence_quote` text,
	`status` text NOT NULL,
	`version` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`meta_json` text NOT NULL,
	`extra_json` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `novel_projects_v2`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_document_id`) REFERENCES `source_documents_v2`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`artifact_version_id`) REFERENCES `artifact_versions_v2`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `source_refs_v2_project_id_idx` ON `source_refs_v2` (`project_id`);--> statement-breakpoint
CREATE INDEX `source_refs_v2_asset_idx` ON `source_refs_v2` (`asset_type`,`asset_id`);--> statement-breakpoint
CREATE INDEX `source_refs_v2_source_document_id_idx` ON `source_refs_v2` (`source_document_id`);--> statement-breakpoint
CREATE INDEX `source_refs_v2_artifact_version_id_idx` ON `source_refs_v2` (`artifact_version_id`);--> statement-breakpoint
CREATE TABLE `sync_run_items_v2` (
	`id` text PRIMARY KEY NOT NULL,
	`sync_run_id` text NOT NULL,
	`source_document_id` text,
	`change_kind` text NOT NULL,
	`processing_status` text NOT NULL,
	`generated_artifact_id` text,
	`generated_artifact_version_id` text,
	`summary` text,
	`error_message` text,
	`status` text NOT NULL,
	`version` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`meta_json` text NOT NULL,
	`extra_json` text NOT NULL,
	FOREIGN KEY (`sync_run_id`) REFERENCES `sync_runs_v2`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_document_id`) REFERENCES `source_documents_v2`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`generated_artifact_id`) REFERENCES `artifacts_v2`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`generated_artifact_version_id`) REFERENCES `artifact_versions_v2`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `sync_run_items_v2_sync_run_id_idx` ON `sync_run_items_v2` (`sync_run_id`);--> statement-breakpoint
CREATE INDEX `sync_run_items_v2_source_document_id_idx` ON `sync_run_items_v2` (`source_document_id`);--> statement-breakpoint
CREATE INDEX `sync_run_items_v2_processing_status_idx` ON `sync_run_items_v2` (`processing_status`);--> statement-breakpoint
CREATE TABLE `sync_runs_v2` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`file_source_id` text,
	`run_kind` text NOT NULL,
	`trigger_mode` text NOT NULL,
	`run_status` text NOT NULL,
	`scanned_count` integer NOT NULL,
	`changed_count` integer NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`error_summary` text,
	`status` text NOT NULL,
	`version` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`meta_json` text NOT NULL,
	`extra_json` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `novel_projects_v2`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`file_source_id`) REFERENCES `file_sources_v2`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `sync_runs_v2_project_id_idx` ON `sync_runs_v2` (`project_id`);--> statement-breakpoint
CREATE INDEX `sync_runs_v2_file_source_id_idx` ON `sync_runs_v2` (`file_source_id`);--> statement-breakpoint
CREATE INDEX `sync_runs_v2_status_idx` ON `sync_runs_v2` (`run_status`);