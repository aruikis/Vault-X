CREATE TABLE `admin_metric_seen` (
	`key` text PRIMARY KEY NOT NULL,
	`seen_value` text,
	`last_value` text NOT NULL,
	`updated_at` text NOT NULL
);
