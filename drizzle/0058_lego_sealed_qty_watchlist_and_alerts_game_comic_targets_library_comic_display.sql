ALTER TABLE `game_cards` ADD COLUMN `owned_sealed_qty` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `watchlist_items` ADD COLUMN `game_card_id` integer;
--> statement-breakpoint
ALTER TABLE `watchlist_items` ADD COLUMN `comic_id` text;
--> statement-breakpoint
ALTER TABLE `price_alerts` ADD COLUMN `game_card_id` integer;
--> statement-breakpoint
ALTER TABLE `collector_profile` ADD COLUMN `library_comic_display` text;
