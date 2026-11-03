CREATE TABLE `deal_thread_reads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`viewer_code` text NOT NULL,
	`kind` text NOT NULL,
	`deal_id` integer NOT NULL,
	`last_read_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `deal_thread_reads_viewer_kind_deal` ON `deal_thread_reads` (`viewer_code`,`kind`,`deal_id`);
