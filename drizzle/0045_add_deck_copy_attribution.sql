ALTER TABLE `decks` ADD COLUMN `copied_from_code` text;
--> statement-breakpoint
ALTER TABLE `decks` ADD COLUMN `copied_from_username` text;
--> statement-breakpoint
ALTER TABLE `decks` ADD COLUMN `source_deck_name` text;
