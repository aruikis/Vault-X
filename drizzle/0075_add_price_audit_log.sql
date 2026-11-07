CREATE TABLE `price_audit_log` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `ran_at` text NOT NULL,
  `kind` text NOT NULL,
  `uid` text,
  `full_name` text,
  `printed` text,
  `old_value` real,
  `new_value` real,
  `scanned` integer,
  `flagged` integer,
  `repaired` integer,
  `source` text DEFAULT 'nightly' NOT NULL
);
