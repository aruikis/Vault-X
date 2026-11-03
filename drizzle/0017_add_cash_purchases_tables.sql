CREATE TABLE `cash_purchases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`buyer_code` text NOT NULL,
	`buyer_username` text NOT NULL,
	`seller_code` text NOT NULL,
	`seller_username` text NOT NULL,
	`card_id` integer NOT NULL,
	`name` text NOT NULL,
	`group_name` text NOT NULL,
	`printed` text,
	`finish` text NOT NULL,
	`qty` integer DEFAULT 1 NOT NULL,
	`unit_price` real NOT NULL,
	`price_source` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`buyer_confirmed` integer DEFAULT 0 NOT NULL,
	`seller_confirmed` integer DEFAULT 0 NOT NULL,
	`completed_at` text,
	`trust_recorded` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `cash_feedback` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`purchase_id` integer NOT NULL,
	`from_code` text NOT NULL,
	`to_code` text NOT NULL,
	`rating` text NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`comment` text,
	`created_at` text NOT NULL
);
