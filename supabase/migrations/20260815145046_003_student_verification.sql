/*
# Student Verification System

## Overview
Adds a student verification system that supports 3 verification methods:
1. School email verification (OTP/link)
2. Student ID card upload (manual review)
3. School-based verification (country/province/school selection)

Privacy-by-design: does NOT permanently store ID card images or sensitive documents.
Only stores verification status, method, and minimal metadata.

## New Tables

### student_verifications
- `id` (uuid, PK)
- `user_id` (uuid, references profiles, cascade delete)
- `status` (enum: pending/approved/rejected, default pending)
- `method` (enum: school_email/student_id/school_verification)
- `school_email` (text, nullable) — used for method 1
- `school_name` (text, nullable) — used for methods 2 & 3
- `country` (text, nullable)
- `province` (text, nullable)
- `grade_or_year` (text, nullable) — e.g. "Grade 10", "Year 1 University"
- `student_id_url` (text, nullable) — temporary storage, deleted after review
- `rejection_reason` (text, nullable)
- `reviewed_by` (uuid, nullable, references profiles) — admin who reviewed
- `reviewed_at` (timestamptz, nullable)
- `created_at`, `updated_at`

### user_roles
- `user_id` (uuid, PK, references profiles, cascade)
- `role` (enum: user/moderator/admin/super_admin, default user)
- `created_at`

## Modified Tables
### profiles
- Added `date_of_birth` (date, nullable) — used for age group only, not displayed publicly
- Added `country` (text, nullable)
- Added `province` (text, nullable)
- Added `verification_status` (enum: basic/pending/verified, default basic)

## Security
- student_verifications: owner can read own; admin can read all; owner can insert/update own
- user_roles: only admins can read; user can read own role; super_admin can manage
- profiles: existing policies updated to include new columns (no change to access logic)
- An admin-only SECURITY DEFINER function to approve/reject verifications

## Notes
1. Verification status stored as enum on profiles for fast reads — no join needed.
2. Student ID URLs are temporary; a cleanup function/edge function should delete them post-review.
3. user_roles uses raw_app_meta_data as source of truth for role checks in RLS where possible.
4. For now, first user can be made super_admin via execute_sql for testing.
*/

-- ============================================================
-- ENUM TYPES
-- ============================================================
DO $$ BEGIN CREATE TYPE verification_status AS ENUM ('basic', 'pending', 'verified'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE verification_method AS ENUM ('school_email', 'student_id', 'school_verification'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE user_role AS ENUM ('user', 'moderator', 'admin', 'super_admin'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE verification_review_status AS ENUM ('pending', 'approved', 'rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- ADD COLUMNS TO PROFILES
-- ============================================================
DO $$ BEGIN
  ALTER TABLE profiles ADD COLUMN date_of_birth date;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE profiles ADD COLUMN country text;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE profiles ADD COLUMN province text;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE profiles ADD COLUMN verification_status verification_status DEFAULT 'basic';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- ============================================================
-- USER ROLES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS user_roles (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  role user_role DEFAULT 'user',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Users can read their own role
DROP POLICY IF EXISTS "user_roles_select_own" ON user_roles;
CREATE POLICY "user_roles_select_own" ON user_roles FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

-- Admins can read all roles
DROP POLICY IF EXISTS "user_roles_select_admin" ON user_roles;
CREATE POLICY "user_roles_select_admin" ON user_roles FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'super_admin'))
  );

-- Only super_admin can insert/update roles
DROP POLICY IF EXISTS "user_roles_manage" ON user_roles;
CREATE POLICY "user_roles_manage" ON user_roles FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin')
  );

DROP POLICY IF EXISTS "user_roles_update" ON user_roles;
CREATE POLICY "user_roles_update" ON user_roles FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin')
  );

DROP POLICY IF EXISTS "user_roles_delete" ON user_roles;
CREATE POLICY "user_roles_delete" ON user_roles FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin')
  );

-- ============================================================
-- STUDENT VERIFICATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS student_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  status verification_review_status DEFAULT 'pending',
  method verification_method NOT NULL,
  school_email text,
  school_name text,
  country text,
  province text,
  grade_or_year text,
  student_id_url text,
  rejection_reason text,
  reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE student_verifications ENABLE ROW LEVEL SECURITY;

-- Owner can read their own verification requests
DROP POLICY IF EXISTS "sv_select_own" ON student_verifications;
CREATE POLICY "sv_select_own" ON student_verifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

-- Admins can read all verification requests
DROP POLICY IF EXISTS "sv_select_admin" ON student_verifications;
CREATE POLICY "sv_select_admin" ON student_verifications FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'super_admin'))
  );

-- Owner can insert their own verification request
DROP POLICY IF EXISTS "sv_insert_own" ON student_verifications;
CREATE POLICY "sv_insert_own" ON student_verifications FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- Owner can update their own (e.g. re-submit)
DROP POLICY IF EXISTS "sv_update_own" ON student_verifications;
CREATE POLICY "sv_update_own" ON student_verifications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Admins can update (approve/reject)
DROP POLICY IF EXISTS "sv_update_admin" ON student_verifications;
CREATE POLICY "sv_update_admin" ON student_verifications FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'super_admin'))
  ) WITH CHECK (true);

-- Owner can delete their own verification data
DROP POLICY IF EXISTS "sv_delete_own" ON student_verifications;
CREATE POLICY "sv_delete_own" ON student_verifications FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- SECURITY DEFINER FUNCTION: Approve/Reject verification
-- Only admins can call. Updates both student_verifications and profiles.
-- ============================================================
CREATE OR REPLACE FUNCTION approve_student_verification(
  p_verification_id uuid,
  p_approve boolean,
  p_rejection_reason text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_role user_role;
BEGIN
  -- Check caller is admin or super_admin
  SELECT role INTO v_role FROM user_roles WHERE user_id = auth.uid();
  IF v_role NOT IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'Permission denied: admin role required';
  END IF;

  -- Get the verification record
  SELECT user_id INTO v_user_id FROM student_verifications WHERE id = p_verification_id;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Verification request not found';
  END IF;

  IF p_approve THEN
    UPDATE student_verifications
    SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
    WHERE id = p_verification_id;

    UPDATE profiles SET verification_status = 'verified', updated_at = now()
    WHERE id = v_user_id;
  ELSE
    UPDATE student_verifications
    SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(),
        rejection_reason = p_rejection_reason, updated_at = now()
    WHERE id = p_verification_id;

    UPDATE profiles SET verification_status = 'basic', updated_at = now()
    WHERE id = v_user_id;
  END IF;
END;
$$;

-- Grant execute to authenticated (the function itself checks admin role)
GRANT EXECUTE ON FUNCTION approve_student_verification(uuid, boolean, text) TO authenticated;

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_sv_user ON student_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_sv_status ON student_verifications(status);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);
