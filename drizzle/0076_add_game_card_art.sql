CREATE TABLE `game_card_art` (
	`game` text NOT NULL,
	`card_id` integer NOT NULL,
	`image_url` text NOT NULL,
	`page_url` text,
	`source` text,
	PRIMARY KEY(`game`, `card_id`)
);
