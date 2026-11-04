ALTER TABLE collector_profile ADD COLUMN username_change_used integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TABLE game_cards (
  id integer PRIMARY KEY AUTOINCREMENT,
  game text NOT NULL,
  uid text NOT NULL UNIQUE,
  section_key text NOT NULL,
  section_name text NOT NULL,
  section_sort integer NOT NULL DEFAULT 0,
  slot_sort integer NOT NULL DEFAULT 0,
  number text,
  printed text NOT NULL,
  name text NOT NULL,
  rarity text,
  finish text,
  image_url text,
  price real,
  owned_qty integer NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE INDEX game_cards_game_section_idx ON game_cards (game, section_key, slot_sort);
--> statement-breakpoint
CREATE INDEX game_cards_game_name_idx ON game_cards (game, name);
--> statement-breakpoint
CREATE TABLE game_import_meta (
  game text PRIMARY KEY,
  state text NOT NULL DEFAULT '{}',
  sets_total integer NOT NULL DEFAULT 0,
  sets_done integer NOT NULL DEFAULT 0,
  cards_total integer NOT NULL DEFAULT 0,
  complete integer NOT NULL DEFAULT 0,
  updated_at text NOT NULL
);
