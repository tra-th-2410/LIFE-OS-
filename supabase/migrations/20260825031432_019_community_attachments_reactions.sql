-- Community post attachments and reactions system

-- 1. Storage bucket for community files (private, uses signed URLs)
INSERT INTO storage.buckets (id, name, public)
VALUES ('community-files', 'community-files', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for community-files bucket
-- Users can upload to their own folder
CREATE POLICY "community_files_upload_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'community-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can read their own files
CREATE POLICY "community_files_read_own"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'community-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete their own files
CREATE POLICY "community_files_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'community-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can update their own files
CREATE POLICY "community_files_update_own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'community-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'community-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 2. community_post_attachments table
CREATE TABLE IF NOT EXISTS community_post_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  uploader_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  is_image BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attachments_post_id ON community_post_attachments(post_id);
CREATE INDEX IF NOT EXISTS idx_attachments_community_id ON community_post_attachments(community_id);
CREATE INDEX IF NOT EXISTS idx_attachments_uploader_id ON community_post_attachments(uploader_id);

ALTER TABLE community_post_attachments ENABLE ROW LEVEL SECURITY;

-- Select: anyone who can see the community can see attachments
CREATE POLICY "attachments_select"
  ON community_post_attachments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM communities c
      WHERE c.id = community_post_attachments.community_id
      AND (c.is_private = false OR c.created_by = auth.uid() OR is_community_member(c.id))
    )
  );

-- Insert: community members can upload attachments to their own posts
CREATE POLICY "attachments_insert_own"
  ON community_post_attachments FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = uploader_id
    AND EXISTS (
      SELECT 1 FROM community_members cm
      WHERE cm.community_id = community_post_attachments.community_id AND cm.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM posts p
      WHERE p.id = community_post_attachments.post_id AND p.author_id = auth.uid()
    )
  );

-- Delete: only the uploader can delete their attachment
CREATE POLICY "attachments_delete_own"
  ON community_post_attachments FOR DELETE TO authenticated
  USING (auth.uid() = uploader_id);

-- 3. community_post_reactions table
CREATE TABLE IF NOT EXISTS community_post_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One reaction per type per user per post
CREATE UNIQUE INDEX IF NOT EXISTS uniq_reaction_per_user_per_post_per_type
  ON community_post_reactions(post_id, user_id, reaction_type);

CREATE INDEX IF NOT EXISTS idx_reactions_post_id ON community_post_reactions(post_id);
CREATE INDEX IF NOT EXISTS idx_reactions_user_id ON community_post_reactions(user_id);

ALTER TABLE community_post_reactions ENABLE ROW LEVEL SECURITY;

-- Select: anyone who can see the community can see reactions
CREATE POLICY "reactions_select"
  ON community_post_reactions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM posts p
      JOIN communities c ON c.id = p.community_id
      WHERE p.id = community_post_reactions.post_id
      AND (c.is_private = false OR c.created_by = auth.uid() OR is_community_member(c.id))
    )
  );

-- Insert: community members can react to posts
CREATE POLICY "reactions_insert_own"
  ON community_post_reactions FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM posts p
      JOIN community_members cm ON cm.community_id = p.community_id
      WHERE p.id = community_post_reactions.post_id AND cm.user_id = auth.uid()
    )
  );

-- Delete: users can only remove their own reactions
CREATE POLICY "reactions_delete_own"
  ON community_post_reactions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 4. Trigger to sync posts.reactions_count with actual reaction count
CREATE OR REPLACE FUNCTION sync_post_reactions_count()
RETURNS TRIGGER AS $$
DECLARE
  new_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO new_count
  FROM community_post_reactions
  WHERE post_id = COALESCE(NEW.post_id, OLD.post_id);

  UPDATE posts SET reactions_count = new_count
  WHERE id = COALESCE(NEW.post_id, OLD.post_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_reactions_count ON community_post_reactions;
CREATE TRIGGER trg_sync_reactions_count
  AFTER INSERT OR DELETE ON community_post_reactions
  FOR EACH ROW EXECUTE FUNCTION sync_post_reactions_count();
