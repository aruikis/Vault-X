CREATE TABLE `forum_threads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`author_code` text NOT NULL,
	`author_username` text NOT NULL,
	`pinned` integer DEFAULT 0 NOT NULL,
	`locked` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`last_activity_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `forum_posts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`thread_id` integer NOT NULL,
	`author_code` text NOT NULL,
	`author_username` text NOT NULL,
	`body` text NOT NULL,
	`deleted` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `forum_thread_reads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`thread_id` integer NOT NULL,
	`reader_code` text NOT NULL,
	`last_read_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `forum_thread_reads_pair` ON `forum_thread_reads` (`thread_id`,`reader_code`);
--> statement-breakpoint
CREATE TABLE `forum_roles` (
	`collector_code` text PRIMARY KEY NOT NULL,
	`role` text NOT NULL,
	`granted_by` text NOT NULL,
	`granted_at` integer NOT NULL,
	`suspended` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE `marketplace_listings` ADD COLUMN `description` text;
--> statement-breakpoint
ALTER TABLE `marketplace_listings` ADD COLUMN `category` text;
--> statement-breakpoint
ALTER TABLE `marketplace_listings` ADD COLUMN `photo_blob_key` text;
--> statement-breakpoint
ALTER TABLE `marketplace_listings` ADD COLUMN `photo_status` text;
