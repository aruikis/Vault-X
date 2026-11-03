ALTER TABLE `change_requests` ADD COLUMN `status` text DEFAULT 'open' NOT NULL;
--> statement-breakpoint
ALTER TABLE `change_requests` ADD COLUMN `assignee` text;
