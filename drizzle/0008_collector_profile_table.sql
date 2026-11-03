CREATE TABLE `collector_profile` (
	`id` integer PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`collector_code` text NOT NULL,
	`photo_blob_key` text,
	`updated_at` text NOT NULL
);
