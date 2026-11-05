ALTER TABLE `graded_slabs` ADD COLUMN `qty` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE `graded_slabs` ADD COLUMN `image_key` text;
--> statement-breakpoint
ALTER TABLE `graded_slabs` ADD COLUMN `image_back_key` text;
--> statement-breakpoint
ALTER TABLE `graded_slabs` ADD COLUMN `image_source` text;
--> statement-breakpoint
ALTER TABLE `graded_slabs` ADD COLUMN `online_line` text;
--> statement-breakpoint
ALTER TABLE `graded_slabs` ADD COLUMN `online_checked_at` integer;
