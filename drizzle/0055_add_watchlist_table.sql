CREATE TABLE `watchlist_items` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `target_kind` text NOT NULL,
  `card_id` integer,
  `sealed_name` text,
  `created_at` text NOT NULL
);
