-- One row per email the worker handled.
CREATE TABLE IF NOT EXISTS mail (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,           -- ISO timestamp
  to_addr TEXT,               -- envelope recipient, e.g. jobs+acme@example.com
  slug TEXT,                  -- the +tag of to_addr ("acme"), empty if none
  from_addr TEXT,
  subject TEXT,
  category TEXT,              -- see content/categories.json, or "unsure"
  confidence REAL,            -- classifier probability of category
  probs TEXT,                 -- JSON of all category probabilities
  company TEXT,               -- the rest are filled only for attention mail
  role TEXT,
  summary TEXT,
  routed_to TEXT,             -- address the email was forwarded to
  pinged INTEGER DEFAULT 0,   -- 1 if a Telegram message went out
  error TEXT
);
CREATE INDEX IF NOT EXISTS mail_at ON mail (at);
