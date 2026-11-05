ALTER TABLE change_requests ADD COLUMN completed_at text;
--> statement-breakpoint
CREATE TABLE version_live_stamps (
  version text PRIMARY KEY,
  went_live_at text NOT NULL
);
--> statement-breakpoint
CREATE TABLE game_section_art (
  game text NOT NULL,
  section_key text NOT NULL,
  image_url text NOT NULL,
  page_url text,
  PRIMARY KEY (game, section_key)
);
--> statement-breakpoint
UPDATE game_cards SET image_url = 'https://images.brickset.com/sets/AdditionalImages/76240-1/76240_alt3.jpg' WHERE game = 'lego' AND printed = '76240-1';
