CREATE TABLE `mail_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`from_code` text NOT NULL,
	`from_username` text NOT NULL,
	`to_code` text NOT NULL,
	`to_username` text NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text NOT NULL,
	`read_at` text
);
