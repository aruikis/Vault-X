CREATE TABLE `card_price_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uid` text NOT NULL,
	`date` text NOT NULL,
	`label` text NOT NULL,
	`unit_value` real NOT NULL,
	`source` text DEFAULT 'export' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `card_price_history_uid_idx` ON `card_price_history` (`uid`);
