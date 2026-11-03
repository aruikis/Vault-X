DROP TABLE entries;
--> statement-breakpoint
CREATE TABLE cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL UNIQUE,
  grp TEXT NOT NULL,
  group_key TEXT NOT NULL,
  group_name TEXT NOT NULL,
  group_label TEXT NOT NULL,
  group_sort INTEGER NOT NULL,
  slot_sort INTEGER NOT NULL,
  set_code TEXT NOT NULL,
  family TEXT,
  number INTEGER,
  printed TEXT NOT NULL,
  full_name TEXT NOT NULL,
  name TEXT,
  rarity TEXT,
  ink TEXT,
  cost INTEGER,
  inkwell INTEGER NOT NULL DEFAULT 0,
  card_type TEXT,
  strength INTEGER,
  willpower INTEGER,
  lore INTEGER,
  card_text TEXT,
  subtypes TEXT,
  image_url TEXT,
  image_blob_key TEXT,
  tcgplayer_id TEXT,
  owned_qty INTEGER NOT NULL DEFAULT 0,
  finishes TEXT NOT NULL DEFAULT '{}',
  market_value REAL
);
--> statement-breakpoint
CREATE INDEX idx_cards_group ON cards (group_key, slot_sort);
--> statement-breakpoint
CREATE INDEX idx_cards_name ON cards (full_name);
