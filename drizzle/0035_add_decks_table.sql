CREATE TABLE `decks` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `owner_code` text NOT NULL,
  `name` text NOT NULL,
  `cards_json` text NOT NULL DEFAULT '[]',
  `displayed` integer NOT NULL DEFAULT 0,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
