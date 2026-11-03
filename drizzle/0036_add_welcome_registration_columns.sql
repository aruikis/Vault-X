ALTER TABLE `collector_profile` ADD COLUMN `welcome_seen` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `collector_profile` ADD COLUMN `registered_at` text;
