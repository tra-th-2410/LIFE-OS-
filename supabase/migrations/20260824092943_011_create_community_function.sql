/*
# Atomic Community Creation

1. New Function
- `create_community` validates the authenticated caller and creates a community.
- The function creates the owner's membership in the same database operation.
- The member count starts at one for the creator.

2. Security
- The caller is always taken from `auth.uid()`; no client-supplied owner is trusted.
- The function requires an authenticated user with an existing profile.
- Anonymous callers cannot execute the function.

3. Important Notes
- This replaces the frontend's fragile sequence of separate community and membership writes.
- Existing community tables, relationships, and row-level policies are preserved.
*/

CREATE OR REPLACE FUNCTION public.create_community(
  p_name text,
  p_slug text,
  p_description text,
  p_icon text DEFAULT '💬',
  p_color text DEFAULT 'teal',
  p_is_private boolean DEFAULT false
) RETURNS public.communities
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_community public.communities;
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id) THEN
    RAISE EXCEPTION 'PROFILE_REQUIRED';
  END IF;

  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'NAME_REQUIRED';
  END IF;

  IF p_description IS NULL OR length(trim(p_description)) = 0 THEN
    RAISE EXCEPTION 'DESCRIPTION_REQUIRED';
  END IF;

  IF p_slug IS NULL OR length(trim(p_slug)) = 0 THEN
    RAISE EXCEPTION 'SLUG_REQUIRED';
  END IF;

  INSERT INTO public.communities (
    name, slug, description, icon, color, is_private, is_anonymous, members_count, created_by
  ) VALUES (
    trim(p_name), trim(p_slug), trim(p_description), coalesce(nullif(trim(p_icon), ''), '💬'),
    coalesce(nullif(trim(p_color), ''), 'teal'), coalesce(p_is_private, false), false, 1, v_user_id
  )
  RETURNING * INTO v_community;

  INSERT INTO public.community_members (community_id, user_id, role)
  VALUES (v_community.id, v_user_id, 'owner');

  RETURN v_community;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_community(text, text, text, text, text, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_community(text, text, text, text, text, boolean) TO authenticated;
