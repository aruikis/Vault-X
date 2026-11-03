CREATE TABLE IF NOT EXISTS deal_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  deal_id INTEGER NOT NULL,
  from_code TEXT NOT NULL,
  from_username TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
