ALTER TABLE trade_offers ADD COLUMN settled_at text;
--> statement-breakpoint
ALTER TABLE trade_offers ADD COLUMN settlement_json text;
--> statement-breakpoint
ALTER TABLE cash_purchases ADD COLUMN settled_at text;
--> statement-breakpoint
ALTER TABLE cash_purchases ADD COLUMN settlement_json text;
