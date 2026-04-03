CREATE TABLE `knowledge_applications_v2` (
	`id` text PRIMARY KEY NOT NULL,
	`knowledge_item_id` text NOT NULL,
	`project_id` text NOT NULL,
	`batch_id` text NOT NULL,
	`pack_kind` text NOT NULL,
	`application_result` text NOT NULL,
	`note` text,
	`status` text NOT NULL,
	`version` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`meta_json` text NOT NULL,
	`extra_json` text NOT NULL,
	FOREIGN KEY (`knowledge_item_id`) REFERENCES `knowledge_items_v2`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `novel_projects_v2`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`batch_id`) REFERENCES `knowledge_batches_v2`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `knowledge_applications_v2_item_id_idx` ON `knowledge_applications_v2` (`knowledge_item_id`);--> statement-breakpoint
CREATE INDEX `knowledge_applications_v2_batch_id_idx` ON `knowledge_applications_v2` (`batch_id`);--> statement-breakpoint
CREATE INDEX `knowledge_applications_v2_project_id_idx` ON `knowledge_applications_v2` (`project_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `knowledge_applications_v2_batch_item_pack_unique` ON `knowledge_applications_v2` (`batch_id`,`knowledge_item_id`,`pack_kind`);--> statement-breakpoint
CREATE TABLE `knowledge_gates_v2` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`batch_id` text NOT NULL,
	`gate_code` text NOT NULL,
	`gate_status` text NOT NULL,
	`note` text,
	`status` text NOT NULL,
	`version` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`meta_json` text NOT NULL,
	`extra_json` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `novel_projects_v2`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`batch_id`) REFERENCES `knowledge_batches_v2`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `knowledge_gates_v2_batch_id_idx` ON `knowledge_gates_v2` (`batch_id`);--> statement-breakpoint
CREATE INDEX `knowledge_gates_v2_project_id_idx` ON `knowledge_gates_v2` (`project_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `knowledge_gates_v2_batch_gate_unique` ON `knowledge_gates_v2` (`batch_id`,`gate_code`);