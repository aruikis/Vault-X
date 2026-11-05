CREATE TABLE `game_card_price_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`game_card_id` integer NOT NULL,
	`date` text NOT NULL,
	`label` text NOT NULL,
	`unit_value` real NOT NULL,
	`source` text DEFAULT 'daily' NOT NULL
);
