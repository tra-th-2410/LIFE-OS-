-- Fix: storage.buckets has RLS enabled but ZERO policies, so neither anon nor
-- authenticated roles can read bucket metadata. The Supabase Storage API needs
-- to resolve the bucket (to check public/private) before generating signed URLs
-- or serving objects. Without a SELECT policy, every createSignedUrl call fails
-- with "Bucket not found", causing Forum and Community images to show
-- "Failed to load image".
--
-- This restores the default Supabase bucket read policy that allows any
-- role to SELECT bucket metadata. Bucket-level access control is not the
-- security boundary — object-level RLS policies on storage.objects enforce
-- who can read/write actual files.

DROP POLICY IF EXISTS "bucket_select_all" ON storage.buckets;
CREATE POLICY "bucket_select_all"
  ON storage.buckets FOR SELECT
  TO anon, authenticated
  USING (true);
