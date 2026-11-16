ALTER TABLE `mail_messages` ADD COLUMN `shared_id` text;
--> statement-breakpoint
ALTER TABLE `mail_messages` ADD COLUMN `notice` integer DEFAULT 0 NOT NULL;
