-- Fix post_allowed table to use INTEGER for post_id to match posts.id
-- SQLite doesn't support ALTER COLUMN, so we need to recreate the table

-- Create new table with correct types
CREATE TABLE IF NOT EXISTS post_allowed_new (
  post_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  PRIMARY KEY (post_id, user_id),
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Copy data, converting post_id from TEXT to INTEGER
INSERT INTO post_allowed_new (post_id, user_id)
SELECT CAST(post_id AS INTEGER), user_id 
FROM post_allowed 
WHERE post_id != '' AND post_id IS NOT NULL;

-- Drop old table and rename new one
DROP TABLE IF EXISTS post_allowed;
ALTER TABLE post_allowed_new RENAME TO post_allowed;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_post_allowed_post ON post_allowed (post_id);
CREATE INDEX IF NOT EXISTS idx_post_allowed_user ON post_allowed (user_id);