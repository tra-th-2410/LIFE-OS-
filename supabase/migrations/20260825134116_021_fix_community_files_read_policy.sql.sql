/*
# Fix: Allow any authenticated user to read community-files attachments

## Problem
Forum and community post attachments are stored in the private `community-files` bucket
under `<uploader_id>/...` paths. The existing `community_files_read_own` policy only allows
reading files in your OWN folder (`storage.foldername(name)[1] = auth.uid()`).

When user A uploads an image and user B views the post, the signed URL is generated
server-side (succeeds), but when the browser fetches the signed URL, the storage RLS
SELECT policy denies access because user B is not the file owner. The image shows
"Failed to load image".

## Fix
Add a new SELECT policy `community_files_read_authenticated` that allows ANY authenticated
user to read files in the `community-files` bucket. This matches the existing database-level
RLS policies on `forum_post_attachments` and `community_post_attachments` which already allow
all authenticated users to SELECT attachment metadata.

The bucket remains PRIVATE (not public) — files are only accessible via signed URLs generated
by authenticated Supabase clients. Unauthenticated access is still denied.

Upload, update, and delete policies remain owner-scoped (unchanged).

## Security
- SELECT: any authenticated user (shared content in forum/community posts)
- INSERT: only the owner (foldername = auth.uid())
- UPDATE: only the owner
- DELETE: only the owner
*/

DROP POLICY IF EXISTS "community_files_read_authenticated" ON storage.objects;

CREATE POLICY "community_files_read_authenticated"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'community-files');
