/*
# Edit/Delete support: RLS fix, updated_at columns, soft-delete for communities

## Summary
1. Fix challenges INSERT policy to enforce creator_id = auth.uid() (prevents spoofing).
2. Add updated_at column to communities and challenges tables.
3. Add auto-update triggers for updated_at on posts, communities, challenges, and projects.
4. Add archived_at column to communities for soft-delete.
5. Add deleted_at column to posts for soft-delete (preserves comment/reaction integrity).

## Security changes
- challenges INSERT: WITH CHECK (creator_id = auth.uid()) — users can only create challenges they own.

## New columns
- communities.updated_at (timestamptz, default now())
- communities.archived_at (timestamptz, nullable)
- challenges.updated_at (timestamptz, default now())
- posts.deleted_at (timestamptz, nullable) — soft delete marker

## Triggers
- update_updated_at() function applied to posts, communities, challenges, projects
- Automatically sets updated_at = now() on every UPDATE

## Important notes
1. Preset challenges (creator_id IS NULL) remain immutable — INSERT policy now requires creator_id = auth.uid().
2. Communities soft-delete via archived_at; RLS SELECT excludes archived communities.
3. Posts soft-delete via deleted_at; RLS SELECT excludes deleted posts.
4. All existing data preserved — new columns are nullable with safe defaults.
*/

-- Fix challenges INSERT policy
DROP POLICY IF EXISTS "challenges_insert" ON challenges;
CREATE POLICY "challenges_insert_own" ON challenges FOR INSERT
  TO authenticated WITH CHECK (creator_id = auth.uid());

-- Add updated_at to communities
ALTER TABLE communities ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE communities ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- Add updated_at to challenges
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Add deleted_at to posts (soft delete)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Create auto-update trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Apply triggers (idempotent — DROP IF EXISTS first)
DROP TRIGGER IF EXISTS trg_posts_updated_at ON posts;
CREATE TRIGGER trg_posts_updated_at BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_communities_updated_at ON communities;
CREATE TRIGGER trg_communities_updated_at BEFORE UPDATE ON communities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_challenges_updated_at ON challenges;
CREATE TRIGGER trg_challenges_updated_at BEFORE UPDATE ON challenges
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_projects_updated_at ON projects;
CREATE TRIGGER trg_projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Update communities SELECT to exclude archived
DROP POLICY IF EXISTS "communities_select" ON communities;
CREATE POLICY "communities_select" ON communities FOR SELECT
  TO authenticated USING (
    archived_at IS NULL
    AND (
      is_private = false
      OR created_by = auth.uid()
      OR public.is_community_member(id)
    )
  );

-- Communities UPDATE: owner only (already exists, re-affirm)
DROP POLICY IF EXISTS "communities_update_own" ON communities;
CREATE POLICY "communities_update_own" ON communities FOR UPDATE
  TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

-- Communities DELETE: owner only — but we use soft delete via archived_at
-- Keep DELETE policy for cleanup but UI will use archive
DROP POLICY IF EXISTS "communities_delete_own" ON communities;
CREATE POLICY "communities_delete_own" ON communities FOR DELETE
  TO authenticated USING (created_by = auth.uid());

-- Update posts SELECT to exclude soft-deleted
DROP POLICY IF EXISTS "posts_select" ON posts;
CREATE POLICY "posts_select" ON posts FOR SELECT TO authenticated USING (
  deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM communities c WHERE c.id = posts.community_id
    AND (c.is_private = false OR c.created_by = auth.uid()
      OR public.is_community_member(c.id))
  )
);

-- Index for soft-delete queries
CREATE INDEX IF NOT EXISTS idx_posts_deleted_at ON posts(deleted_at);
CREATE INDEX IF NOT EXISTS idx_communities_archived_at ON communities(archived_at);
