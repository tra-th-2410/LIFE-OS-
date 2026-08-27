/*
# Fix Community RLS Recursion

1. New Function
- Adds `is_community_member`, a server-side membership check that reads membership data without recursively applying the browser-facing membership policy.
- The authenticated session user is used automatically; callers cannot provide a different user ID.

2. Modified Policies
- Updates `communities_select` to use the membership check instead of directly querying `community_members`.
- Updates `cm_select` to use the same non-recursive membership check.
- Public communities remain readable to authenticated users.
- Private communities remain limited to their creator and members.

3. Security
- The helper is `SECURITY DEFINER`, uses a fixed `search_path`, and is executable only by authenticated users.
- Anonymous users cannot use the helper or read protected community data.
- No tables, rows, or columns are removed.

4. Root Cause
- The previous policies referenced each other: community visibility evaluated `community_members`, while membership visibility evaluated `communities`. PostgreSQL detected infinite RLS recursion and rejected the communities SELECT query.
*/

CREATE OR REPLACE FUNCTION public.is_community_member(p_community_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.community_members
    WHERE community_id = p_community_id
      AND user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_community_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_community_member(uuid) TO authenticated;

DROP POLICY IF EXISTS "communities_select" ON public.communities;
CREATE POLICY "communities_select" ON public.communities
  FOR SELECT
  TO authenticated
  USING (
    is_private = false
    OR created_by = auth.uid()
    OR public.is_community_member(id)
  );

DROP POLICY IF EXISTS "cm_select" ON public.community_members;
CREATE POLICY "cm_select" ON public.community_members
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.communities c
      WHERE c.id = community_members.community_id
        AND (
          c.is_private = false
          OR c.created_by = auth.uid()
          OR public.is_community_member(c.id)
        )
    )
  );
