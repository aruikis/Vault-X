CREATE TABLE `backup_meta` (
	`id` integer PRIMARY KEY NOT NULL,
	`last_change_at` text,
	`last_full_sync_at` text,
	`last_sync_items` integer,
	`last_sync_copies` integer,
	`last_daily_check_at` text
);
