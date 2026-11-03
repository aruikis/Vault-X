CREATE TABLE `marketplace_listings` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `seller_code` text NOT NULL,
  `seller_username` text NOT NULL,
  `kind` text NOT NULL,
  `card_id` integer,
  `sealed_name` text,
  `comic_id` text,
  `name` text NOT NULL,
  `group_name` text NOT NULL,
  `finish` text NOT NULL,
  `condition` text NOT NULL,
  `qty` integer NOT NULL DEFAULT 1,
  `asking_price` real NOT NULL,
  `market_value` real,
  `status` text NOT NULL DEFAULT 'available',
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `marketplace_offers` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `listing_id` integer NOT NULL,
  `buyer_code` text NOT NULL,
  `buyer_username` text NOT NULL,
  `type` text NOT NULL,
  `amount` real NOT NULL,
  `status` text NOT NULL DEFAULT 'pending',
  `seller_confirmed` integer NOT NULL DEFAULT 0,
  `buyer_confirmed` integer NOT NULL DEFAULT 0,
  `completed_at` text,
  `trust_recorded` integer NOT NULL DEFAULT 0,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `marketplace_feedback` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `offer_id` integer NOT NULL,
  `from_code` text NOT NULL,
  `to_code` text NOT NULL,
  `rating` text NOT NULL,
  `tags` text NOT NULL DEFAULT '[]',
  `comment` text,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `marketplace_meta` (
  `key` text PRIMARY KEY NOT NULL,
  `value` text NOT NULL
);
