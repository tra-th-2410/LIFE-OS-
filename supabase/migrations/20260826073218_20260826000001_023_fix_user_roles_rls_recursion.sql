/*
# Fix Infinite RLS Recursion on user_roles

## Problem
The `user_roles` table has RLS enabled. Its own policies (user_roles_select_admin,
user_roles_manage, user_roles_update, user_roles_delete) reference `user_roles`
in their predicate expressions. When PostgreSQL evaluates any of these policies,
it triggers RLS on `user_roles` again, causing infinite recursion (error 42P17).

This recursion is triggered indirectly whenever ANY table with a policy that
references `user_roles` is queried as the `authenticated` role — most critically
`storage.objects` (policies sv_bucket_read_admin / sv_bucket_delete_admin),
which the Supabase Storage API queries on every signed-URL and list request.
The Storage API maps the underlying 42P17 error to HTTP 503
`DatabaseInvalidObjectDefinition`.

## Solution
1. Create two SECURITY DEFINER functions:
   - `is_admin()` — returns true if the current user has role 'admin' or 'super_admin'
   - `is_moderator_or_admin()` — returns true if the current user has role
     'moderator', 'admin', or 'super_admin'

   SECURITY DEFINER functions execute with the privileges of their owner
   (postgres), which bypasses RLS. This breaks the recursion because the
   function's internal SELECT on `user_roles` no longer triggers `user_roles`
   RLS policies.

2. Replace every `EXISTS (SELECT 1 FROM user_roles ...)` in RLS policies with
   the appropriate helper function call.

## Policies Changed (10 total across 5 tables)

### user_roles (4 policies — self-referencing, the root cause)
- user_roles_select_admin  → USING (is_admin())
- user_roles_manage         → WITH CHECK (is_admin('super_admin'))
- user_roles_update         → USING (is_admin('super_admin')) WITH CHECK (is_admin('super_admin'))
- user_roles_delete         → USING (is_admin('super_admin'))

### storage.objects (2 policies — triggered the Storage API 503)
- sv_bucket_read_admin   → USING (bucket_id = 'student-verification' AND is_admin())
- sv_bucket_delete_admin → USING (bucket_id = 'student-verification' AND is_admin())

### student_verifications (2 policies)
- sv_select_admin → USING (is_admin())
- sv_update_admin → USING (is_admin()) WITH CHECK (true)

### verification_audit_logs (1 policy)
- val_select_admin → USING (is_admin())

### forum_reports (1 policy)
- forum_reports_select → USING (reporter_id = auth.uid() OR is_moderator_or_admin())

## Security Impact
- No table schemas changed.
- No bucket configurations changed.
- No files deleted or moved.
- Non-admin user access rules are unchanged (user_roles_select_own preserved).
- `user_roles` is NOT made publicly readable — only the SECURITY DEFINER
  function (owned by postgres) can read it, and it only returns a boolean.
- Admin/super_admin permissions are preserved exactly.
- Moderator permissions on forum_reports are preserved.

## Existing Data
All existing files in community-files, forum-images, and student-verification
buckets remain untouched. Signed URLs will work for authenticated users after
this migration.
*/

-- ============================================================
-- 1. Create SECURITY DEFINER helper functions
-- ============================================================

-- is_admin(p_role text DEFAULT NULL)
-- If p_role is NULL: returns true when user has 'admin' or 'super_admin'
-- If p_role is provided: returns true when user has that specific role
-- (used by user_roles_manage/update/delete which require 'super_admin')
CREATE OR REPLACE FUNCTION public.is_admin(p_role text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_count int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  IF p_role IS NOT NULL THEN
    SELECT count(*) INTO v_count
    FROM user_roles
    WHERE user_id = v_user_id AND role = p_role::user_role;
  ELSE
    SELECT count(*) INTO v_count
    FROM user_roles
    WHERE user_id = v_user_id AND role IN ('admin', 'super_admin');
  END IF;

  RETURN v_count > 0;
END;
$$;

-- is_moderator_or_admin()
-- Returns true when the current user has role 'moderator', 'admin', or 'super_admin'
CREATE OR REPLACE FUNCTION public.is_moderator_or_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_count int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT count(*) INTO v_count
  FROM user_roles
  WHERE user_id = v_user_id
    AND role IN ('moderator', 'admin', 'super_admin');

  RETURN v_count > 0;
END;
$$;

-- Grant execute to authenticated only (not anon — these are for logged-in users)
GRANT EXECUTE ON FUNCTION public.is_admin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_moderator_or_admin() TO authenticated;

-- ============================================================
-- 2. Fix user_roles self-referencing policies (the root cause)
-- ============================================================

-- SELECT: admins can read all roles (was: self-referencing EXISTS subquery)
DROP POLICY IF EXISTS "user_roles_select_admin" ON user_roles;
CREATE POLICY "user_roles_select_admin" ON user_roles FOR SELECT
  TO authenticated USING (is_admin());

-- INSERT: only super_admin can manage roles
DROP POLICY IF EXISTS "user_roles_manage" ON user_roles;
CREATE POLICY "user_roles_manage" ON user_roles FOR INSERT
  TO authenticated WITH CHECK (is_admin('super_admin'));

-- UPDATE: only super_admin can update roles
DROP POLICY IF EXISTS "user_roles_update" ON user_roles;
CREATE POLICY "user_roles_update" ON user_roles FOR UPDATE
  TO authenticated
  USING (is_admin('super_admin'))
  WITH CHECK (is_admin('super_admin'));

-- DELETE: only super_admin can delete roles
DROP POLICY IF EXISTS "user_roles_delete" ON user_roles;
CREATE POLICY "user_roles_delete" ON user_roles FOR DELETE
  TO authenticated USING (is_admin('super_admin'));

-- ============================================================
-- 3. Fix storage.objects policies (caused the Storage API 503)
-- ============================================================

-- Admins can read all files in student-verification bucket
DROP POLICY IF EXISTS "sv_bucket_read_admin" ON storage.objects;
CREATE POLICY "sv_bucket_read_admin" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'student-verification'
    AND is_admin()
  );

-- Admins can delete files (cleanup after review)
DROP POLICY IF EXISTS "sv_bucket_delete_admin" ON storage.objects;
CREATE POLICY "sv_bucket_delete_admin" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'student-verification'
    AND is_admin()
  );

-- ============================================================
-- 4. Fix student_verifications policies
-- ============================================================

-- Admins can read all verification requests
DROP POLICY IF EXISTS "sv_select_admin" ON student_verifications;
CREATE POLICY "sv_select_admin" ON student_verifications FOR SELECT
  TO authenticated USING (is_admin());

-- Admins can update (approve/reject)
DROP POLICY IF EXISTS "sv_update_admin" ON student_verifications;
CREATE POLICY "sv_update_admin" ON student_verifications FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (true);

-- ============================================================
-- 5. Fix verification_audit_logs policy
-- ============================================================

DROP POLICY IF EXISTS "val_select_admin" ON verification_audit_logs;
CREATE POLICY "val_select_admin" ON verification_audit_logs FOR SELECT
  TO authenticated USING (is_admin());

-- ============================================================
-- 6. Fix forum_reports policy (uses moderator + admin check)
-- ============================================================

DROP POLICY IF EXISTS "forum_reports_select" ON forum_reports;
CREATE POLICY "forum_reports_select" ON forum_reports FOR SELECT
  TO authenticated
  USING (reporter_id = auth.uid() OR is_moderator_or_admin());
