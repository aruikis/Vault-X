CREATE TABLE `lego_set_details` (
	`game_card_id` integer PRIMARY KEY NOT NULL,
	`set_num` text NOT NULL,
	`release_date` text,
	`retail_price_usd` real,
	`ages` text,
	`upc` text,
	`ean` text,
	`dimensions` text,
	`weight_grams` integer,
	`build_time` text,
	`description` text,
	`availability` text,
	`retired_date` text,
	`expected_retirement` text,
	`minifigs_json` text,
	`minifigs_value_usd` real,
	`parts_distinct` integer,
	`parts_spares` integer,
	`part_out_value_usd` real,
	`market_sealed_usd` real,
	`market_used_usd` real,
	`used_range` text,
	`annual_growth_pct` real,
	`forecast_1yr_usd` real,
	`forecast_5yr_usd` real,
	`sold_listings_json` text,
	`retailers_json` text,
	`sources_json` text,
	`researched_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `lego_ownership_notes` (
	`game_card_id` integer PRIMARY KEY NOT NULL,
	`paid_price_usd` real,
	`condition` text,
	`completeness` text,
	`missing_pieces` integer,
	`date_added` text
);
--> statement-breakpoint
ALTER TABLE `item_locations` ADD `game_card_id` integer;
