CREATE TABLE `recent_additions` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `card_id` integer NOT NULL,
  `added_at` text NOT NULL,
  `qty` integer NOT NULL DEFAULT 1
);
