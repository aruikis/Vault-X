CREATE TABLE `price_alerts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`target_kind` text NOT NULL,
	`card_id` integer,
	`sealed_name` text,
	`label` text NOT NULL,
	`direction` text NOT NULL,
	`threshold` real NOT NULL,
	`created_at` text NOT NULL
);
