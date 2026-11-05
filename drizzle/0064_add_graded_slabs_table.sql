CREATE TABLE `graded_slabs` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `game_card_id` integer NOT NULL,
  `company` text DEFAULT 'PSA' NOT NULL,
  `cert` text NOT NULL,
  `grade` text NOT NULL,
  `paid` real,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `graded_slabs_cert_idx` ON `graded_slabs` (`cert`);
--> statement-breakpoint
CREATE INDEX `graded_slabs_card_idx` ON `graded_slabs` (`game_card_id`);
