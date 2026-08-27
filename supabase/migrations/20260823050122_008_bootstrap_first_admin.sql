/*
# First Admin Bootstrap Function

## Overview
Provides a secure, one-time mechanism to promote the FIRST admin account
without exposing a public "Become Admin" button. This solves the chicken-and-egg
problem: RLS only allows super_admins to assign roles, but no super_admin
exists yet on a fresh project.

## How It Works
1. A SECURITY DEFINER function `bootstrap_first_admin()` checks if ANY admin
   or super_admin already exists in user_roles.
2. If NO admin exists, it promotes the CALLING authenticated user to super_admin.
3. If an admin already exists, it raises an exception and refuses to run.
4. The function is callable only by authenticated users (GRANT EXECUTE TO authenticated).
5. After the first admin is set, the function is permanently inert — it can
   never be used again to promote anyone.

## Security Guarantees
- Normal users can NEVER promote themselves once the first admin exists.
- The function self-disables after first use (the admin-count check fails forever after).
- No UI button or public route exposes this function — it must be called
  intentionally by the project owner from a secure context.
- The function runs with SECURITY DEFINER so it bypasses the RLS that would
  otherwise block role insertion.
- Only one admin can be bootstrapped this way. All subsequent role changes
  must be done by an existing super_admin through the admin UI.

## What This Does NOT Do
- Does NOT create a public signup path to admin.
- Does NOT verify the user or change their verification_status.
- Does NOT expose any client-side admin toggle.
- Does NOT allow unauthenticated access.
*/

CREATE OR REPLACE FUNCTION bootstrap_first_admin()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_count int;
  v_user_id uuid := auth.uid();
  v_username text;
BEGIN
  -- Must be authenticated
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Check if any admin or super_admin already exists
  SELECT count(*) INTO v_admin_count
  FROM user_roles
  WHERE role IN ('admin', 'super_admin');

  IF v_admin_count > 0 THEN
    RAISE EXCEPTION 'An admin already exists. Use the admin panel to manage roles.';
  END IF;

  -- Get username for the return message
  SELECT username INTO v_username FROM profiles WHERE id = v_user_id;

  -- Promote the calling user to super_admin
  INSERT INTO user_roles (user_id, role)
  VALUES (v_user_id, 'super_admin')
  ON CONFLICT (user_id) DO UPDATE SET role = 'super_admin';

  RETURN v_username;
END;
$$;

-- Only authenticated users can call this function
GRANT EXECUTE ON FUNCTION bootstrap_first_admin() TO authenticated;
REVOKE EXECUTE ON FUNCTION bootstrap_first_admin() FROM anon;
