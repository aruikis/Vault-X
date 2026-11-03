CREATE TABLE `item_locations` (
  `id` integer PRIMARY KEY AUTOINCREMENT,
  `target_kind` text NOT NULL,
  `card_id` integer,
  `sealed_name` text,
  `comic_id` text,
  `loc_type` text NOT NULL,
  `place` text NOT NULL,
  `spot` text,
  `qty` integer DEFAULT 1 NOT NULL,
  `created_at` text NOT NULL
);
