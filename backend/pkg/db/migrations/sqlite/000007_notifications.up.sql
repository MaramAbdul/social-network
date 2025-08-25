CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,                  -- recipient
  type TEXT NOT NULL,                     -- follow_request | follow_accepted | comment | like
  actor_id TEXT,                          -- who caused it
  post_id INTEGER,                        -- optional: post involved
  comment_id INTEGER,                     -- optional
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  read_at TEXT                            -- null = unread
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications (user_id, read_at);