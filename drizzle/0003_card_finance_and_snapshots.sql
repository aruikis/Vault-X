ALTER TABLE `cards` ADD COLUMN `paid_value` real;
--> statement-breakpoint
ALTER TABLE `cards` ADD COLUMN `finance_json` text;
--> statement-breakpoint
CREATE TABLE `finance_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`label` text NOT NULL,
	`value` real NOT NULL,
	`paid` real NOT NULL,
	`cards` integer NOT NULL,
	`source` text DEFAULT 'export' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `finance_snapshots_label_unique` ON `finance_snapshots` (`label`);
