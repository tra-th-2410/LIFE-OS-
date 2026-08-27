/*
# Student Verification Storage Bucket

## Overview
Creates a private Supabase Storage bucket for student ID document uploads during
the student verification process. Previously the code referenced a non-existent
bucket named "student-ids", causing "Bucket not found" errors.

## Changes
1. Creates a private storage bucket named `student-verification`.
   - Private = files are NOT publicly accessible via URL.
   - Only authenticated users with proper permissions can access files.
2. Adds storage policies on `storage.objects`:
   - Authenticated users can UPLOAD files to their own folder path (`{user_id}/...`).
   - Authenticated users can READ their own files (`{user_id}/...`).
   - Admins and super_admins can READ all files in the bucket (for reviewing verifications).
   - Admins and super_admins can DELETE files (for cleanup after review).
   - Unauthenticated users have NO access.
3. No public read access — student ID documents are sensitive and must stay private.

## Security
- Bucket is private (public = false).
- Upload policy enforces that the file path starts with the uploader's own user ID.
- Read policy allows self-access and admin-access only.
- Delete policy is admin-only.
- No anon access whatsoever.
*/

-- Create the private bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('student-verification', 'student-verification', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STORAGE POLICIES on storage.objects
-- ============================================================

-- Users can upload files to their own folder: student-verification/{user_id}/...
DROP POLICY IF EXISTS "sv_bucket_upload_own" ON storage.objects;
CREATE POLICY "sv_bucket_upload_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'student-verification'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can read their own files
DROP POLICY IF EXISTS "sv_bucket_read_own" ON storage.objects;
CREATE POLICY "sv_bucket_read_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'student-verification'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Admins can read all files in the bucket
DROP POLICY IF EXISTS "sv_bucket_read_admin" ON storage.objects;
CREATE POLICY "sv_bucket_read_admin" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'student-verification'
    AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'super_admin')
    )
  );

-- Admins can delete files (cleanup after review)
DROP POLICY IF EXISTS "sv_bucket_delete_admin" ON storage.objects;
CREATE POLICY "sv_bucket_delete_admin" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'student-verification'
    AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'super_admin')
    )
  );
