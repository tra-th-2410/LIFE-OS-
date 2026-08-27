/*
# Forum Images Storage Bucket

1. New Storage
- Creates a `forum-images` bucket for forum post image uploads
- Public read, authenticated write (owner-scoped)
2. Security
- Only authenticated users can upload to their own folder
- Public read for all forum images
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('forum-images', 'forum-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read
DROP POLICY IF EXISTS "forum_images_public_read" ON storage.objects;
CREATE POLICY "forum_images_public_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'forum-images');

-- Allow authenticated users to upload to their own folder
DROP POLICY IF EXISTS "forum_images_insert_own" ON storage.objects;
CREATE POLICY "forum_images_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'forum-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow users to update/delete their own files
DROP POLICY IF EXISTS "forum_images_update_own" ON storage.objects;
CREATE POLICY "forum_images_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'forum-images' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'forum-images' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "forum_images_delete_own" ON storage.objects;
CREATE POLICY "forum_images_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'forum-images' AND (storage.foldername(name))[1] = auth.uid()::text);
