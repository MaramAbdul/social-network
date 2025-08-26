-- Revert post_allowed table to use TEXT for post_id

-- Create table with old structure
CREATE TABLE IF NOT EXISTS post_allowed_old (
  post_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  PRIMARY KEY (post_id, user_id),
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Copy data back, converting post_id from INTEGER to TEXT
INSERT INTO post_allowed_old (post_id, user_id)
SELECT CAST(post_id AS TEXT), user_id 
FROM post_allowed;

-- Drop new table and rename old one
DROP TABLE IF EXISTS post_allowed;
ALTER TABLE post_allowed_old RENAME TO post_allowed;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_post_allowed_post ON post_allowed (post_id);
CREATE INDEX IF NOT EXISTS idx_post_allowed_user ON post_allowed (user_id);