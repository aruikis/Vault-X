CREATE TABLE `usage_journal` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`collector_code` text NOT NULL,
	`session_id` text NOT NULL,
	`kind` text NOT NULL,
	`label` text NOT NULL,
	`detail_json` text,
	`at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `usage_journal_owner_at_idx` ON `usage_journal` (`collector_code`, `at`);
