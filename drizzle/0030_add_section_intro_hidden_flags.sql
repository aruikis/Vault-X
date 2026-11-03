ALTER TABLE `collector_profile` ADD COLUMN `sealed_intro_hidden` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `collector_profile` ADD COLUMN `social_intro_hidden` integer DEFAULT 0 NOT NULL;
