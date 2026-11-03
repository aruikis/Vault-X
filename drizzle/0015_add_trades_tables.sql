CREATE TABLE `trade_offers` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `proposer_code` text NOT NULL,
  `proposer_username` text NOT NULL,
  `partner_code` text NOT NULL,
  `partner_username` text NOT NULL,
  `give_json` text NOT NULL DEFAULT '[]',
  `get_json` text NOT NULL DEFAULT '[]',
  `note` text,
  `status` text NOT NULL DEFAULT 'pending',
  `proposer_confirmed` integer NOT NULL DEFAULT 0,
  `partner_confirmed` integer NOT NULL DEFAULT 0,
  `completed_at` text,
  `trust_recorded` integer NOT NULL DEFAULT 0,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `trade_feedback` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `trade_id` integer NOT NULL,
  `from_code` text NOT NULL,
  `to_code` text NOT NULL,
  `rating` text NOT NULL,
  `tags` text NOT NULL DEFAULT '[]',
  `comment` text,
  `created_at` text NOT NULL
);
