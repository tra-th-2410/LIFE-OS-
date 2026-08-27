-- Add composite indexes for forum_posts sort modes used by the category page.
-- The existing idx_forum_posts_category covers (category_id, created_at DESC) for 'latest' sort.
-- These cover the 'discussed' and 'helpful' sort modes which order by comments_count / reactions_count.

CREATE INDEX IF NOT EXISTS idx_forum_posts_category_discussed
  ON forum_posts (category_id, comments_count DESC, created_at DESC)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_forum_posts_category_helpful
  ON forum_posts (category_id, reactions_count DESC, created_at DESC)
  WHERE status = 'active';
