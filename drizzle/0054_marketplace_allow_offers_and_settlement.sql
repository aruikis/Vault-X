ALTER TABLE marketplace_listings ADD COLUMN allow_offers integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE marketplace_offers ADD COLUMN settled_at text;
--> statement-breakpoint
ALTER TABLE marketplace_offers ADD COLUMN settlement_json text;
