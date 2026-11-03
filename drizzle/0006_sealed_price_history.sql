CREATE TABLE `sealed_price_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`date` text NOT NULL,
	`label` text NOT NULL,
	`unit_value` real NOT NULL,
	`source` text DEFAULT 'export' NOT NULL
);
