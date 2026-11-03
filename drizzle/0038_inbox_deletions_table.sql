CREATE TABLE inbox_deletions (
  id integer PRIMARY KEY AUTOINCREMENT,
  viewer_code text NOT NULL,
  kind text NOT NULL,
  ref_id integer NOT NULL,
  deleted_at text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX inbox_deletions_viewer_item ON inbox_deletions (viewer_code, kind, ref_id);
