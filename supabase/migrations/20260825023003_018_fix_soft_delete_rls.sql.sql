/*
# Fix soft-delete RLS: SELECT policies block UPDATE of deleted_at/archived_at

## Root cause
PostgreSQL re-evaluates SELECT policies on the new row version during UPDATE.
The posts SELECT policy requires `deleted_at IS NULL` and the communities SELECT
policy requires `archived_at IS NULL`. When a user soft-deletes (sets the column
to non-null), the new row violates the SELECT policy, raising:
  42501: new row violates row-level security policy for table "posts"/"communities"

## Fix
Allow the row owner to always see their own rows, including soft-deleted ones.
This lets the UPDATE's new row pass the SELECT policy visibility check.
The UI already filters by deleted_at IS NULL / archived_at IS NULL in queries,
so soft-deleted rows won't appear in listings.
*/

-- Posts: allow author to see their own soft-deleted posts
DROP POLICY IF EXISTS "posts_select" ON posts;
CREATE POLICY "posts_select" ON posts FOR SELECT TO authenticated USING (
  (
    deleted_at IS NULL
    OR author_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM communities c WHERE c.id = posts.community_id
    AND (c.is_private = false OR c.created_by = auth.uid()
      OR public.is_community_member(c.id))
  )
);

-- Communities: allow creator to see their own archived communities
DROP POLICY IF EXISTS "communities_select" ON communities;
CREATE POLICY "communities_select" ON communities FOR SELECT TO authenticated USING (
  (
    archived_at IS NULL
    OR created_by = auth.uid()
  )
  AND (
    is_private = false
    OR created_by = auth.uid()
    OR public.is_community_member(id)
  )
);
