-- Add a visibility column to posts:
-- 'public' | 'followers' | 'private'
ALTER TABLE posts ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public';

-- Allow-list table for 'private' posts: who is allowed to view
CREATE TABLE IF NOT EXISTS post_allowed (
  post_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  PRIMARY KEY (post_id, user_id),
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_post_allowed_post ON post_allowed (post_id);
CREATE INDEX IF NOT EXISTS idx_post_allowed_user ON post_allowed (user_id);