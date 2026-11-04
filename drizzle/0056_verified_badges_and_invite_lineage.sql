CREATE TABLE `verified_badges` (
  `collector_code` text PRIMARY KEY NOT NULL,
  `username` text NOT NULL,
  `status` text NOT NULL,
  `basis` text NOT NULL,
  `proof_json` text,
  `granted_at` text NOT NULL,
  `revoked_at` text,
  `revoked_by` text,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `badge_conferrals` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `earner_code` text NOT NULL,
  `granter_code` text NOT NULL,
  `kind` text NOT NULL,
  `ref_id` integer NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `badge_conferrals_pair` ON `badge_conferrals` (`earner_code`, `granter_code`);
--> statement-breakpoint
CREATE TABLE `invite_lineage` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `new_collector_code` text NOT NULL,
  `new_username` text NOT NULL,
  `vouched_by_code` text NOT NULL,
  `vouched_by_username` text NOT NULL,
  `source` text NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invite_lineage_new_user` ON `invite_lineage` (`new_collector_code`);
--> statement-breakpoint
ALTER TABLE `collector_profile` ADD COLUMN `invite_code` text;
--> statement-breakpoint
ALTER TABLE `collector_profile` ADD COLUMN `vouched_by_code` text;
--> statement-breakpoint
ALTER TABLE `collector_profile` ADD COLUMN `vouched_by_username` text;
--> statement-breakpoint
ALTER TABLE `collector_profile` ADD COLUMN `vouched_at` text;
