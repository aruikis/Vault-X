CREATE TABLE `catalog_audit_log` (
  `id` integer PRIMARY KEY AUTOINCREMENT,
  `ran_at` text NOT NULL,
  `added` integer NOT NULL DEFAULT 0,
  `skipped` integer NOT NULL DEFAULT 0,
  `source` text NOT NULL DEFAULT 'daily'
);
