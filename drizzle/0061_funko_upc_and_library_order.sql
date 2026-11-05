ALTER TABLE `game_cards` ADD COLUMN `upc` text;
--> statement-breakpoint
CREATE TABLE `library_orders` (
  `collector_code` text PRIMARY KEY NOT NULL,
  `order_json` text DEFAULT '{}' NOT NULL,
  `updated_at` integer DEFAULT 0 NOT NULL
);
