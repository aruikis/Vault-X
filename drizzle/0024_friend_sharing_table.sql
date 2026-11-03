CREATE TABLE `friend_sharing` (
	`friend_code` text PRIMARY KEY NOT NULL,
	`share` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL
);
