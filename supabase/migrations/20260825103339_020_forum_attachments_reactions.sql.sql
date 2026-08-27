/*
# Forum Post Attachments and Emoji Reactions

## Purpose
Extend the existing Forum system with:
1. File/image attachments (documents + images) for forum posts
2. Emoji-based reactions (❤️ 👍 😂 😮 😢 😡 🎉 🔥) for forum posts

## New Tables

### forum_post_attachments
- `id` (uuid, PK)
- `post_id` (uuid, FK to forum_posts, ON DELETE CASCADE)
- `uploader_id` (uuid, FK to profiles, ON DELETE CASCADE)
- `file_name` (text) — original filename
- `file_path` (text) — storage path in community-files bucket
- `file_type` (text) — MIME type
- `file_size` (bigint) — size in bytes
- `is_image` (boolean) — whether the file is an image
- `created_at` (timestamptz)

### forum_post_reactions
- `id` (uuid, PK)
- `post_id` (uuid, FK to forum_posts, ON DELETE CASCADE)
- `user_id` (uuid, FK to profiles, ON DELETE CASCADE)
- `reaction_type` (text) — emoji string (❤️, 👍, 😂, 😮, 😢, 😡, 🎉, 🔥)
- `created_at` (timestamptz)
- Unique constraint on (post_id, user_id, reaction_type) to prevent duplicate reactions

## Storage
- Reuses the existing private `community-files` bucket (no new bucket created)
- Storage policies already allow users to upload/read/delete their own files in that bucket

## Security (RLS)
- forum_post_attachments: SELECT for all authenticated; INSERT only by post author; DELETE only by uploader
- forum_post_reactions: SELECT for all authenticated; INSERT only for own reactions; DELETE only own reactions

## Triggers
- `sync_forum_post_reactions_count()` — updates `forum_posts.reactions_count` when reactions change

## Important Notes
1. Does NOT modify the existing `forum_reactions` table (which uses an enum for the old reaction system)
2. Does NOT modify existing forum posts, comments, or delete functionality
3. The existing `forum_posts.reactions_count` column is reused — the new trigger keeps it in sync with `forum_post_reactions`
4. The existing `forum_posts.image_url` column is preserved for backward compatibility
*/

-- 1. Forum post attachments table
CREATE TABLE IF NOT EXISTS forum_post_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
  uploader_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  is_image BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_forum_attachments_post_id ON forum_post_attachments(post_id);
CREATE INDEX IF NOT EXISTS idx_forum_attachments_uploader_id ON forum_post_attachments(uploader_id);

ALTER TABLE forum_post_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "forum_attachments_select" ON forum_post_attachments;
CREATE POLICY "forum_attachments_select"
  ON forum_post_attachments FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "forum_attachments_insert_own" ON forum_post_attachments;
CREATE POLICY "forum_attachments_insert_own"
  ON forum_post_attachments FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = uploader_id
    AND EXISTS (
      SELECT 1 FROM forum_posts p
      WHERE p.id = forum_post_attachments.post_id AND p.author_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "forum_attachments_delete_own" ON forum_post_attachments;
CREATE POLICY "forum_attachments_delete_own"
  ON forum_post_attachments FOR DELETE TO authenticated
  USING (auth.uid() = uploader_id);

-- 2. Forum post emoji reactions table
CREATE TABLE IF NOT EXISTS forum_post_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One reaction per type per user per post
CREATE UNIQUE INDEX IF NOT EXISTS uniq_forum_reaction_per_user_per_post_per_type
  ON forum_post_reactions(post_id, user_id, reaction_type);

CREATE INDEX IF NOT EXISTS idx_forum_reactions_post_id ON forum_post_reactions(post_id);
CREATE INDEX IF NOT EXISTS idx_forum_reactions_user_id ON forum_post_reactions(user_id);

ALTER TABLE forum_post_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "forum_post_reactions_select" ON forum_post_reactions;
CREATE POLICY "forum_post_reactions_select"
  ON forum_post_reactions FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "forum_post_reactions_insert_own" ON forum_post_reactions;
CREATE POLICY "forum_post_reactions_insert_own"
  ON forum_post_reactions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "forum_post_reactions_delete_own" ON forum_post_reactions;
CREATE POLICY "forum_post_reactions_delete_own"
  ON forum_post_reactions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 3. Trigger to sync forum_posts.reactions_count with forum_post_reactions
CREATE OR REPLACE FUNCTION sync_forum_post_reactions_count()
RETURNS TRIGGER AS $$
DECLARE
  new_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO new_count
  FROM forum_post_reactions
  WHERE post_id = COALESCE(NEW.post_id, OLD.post_id);

  UPDATE forum_posts SET reactions_count = new_count
  WHERE id = COALESCE(NEW.post_id, OLD.post_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_forum_post_reactions_count ON forum_post_reactions;
CREATE TRIGGER trg_sync_forum_post_reactions_count
  AFTER INSERT OR DELETE ON forum_post_reactions
  FOR EACH ROW EXECUTE FUNCTION sync_forum_post_reactions_count();
