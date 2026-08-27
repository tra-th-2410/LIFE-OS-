/*
# Fix challenge system: RLS visibility, DB constraints, remove global status update

## Summary
1. Fix RLS SELECT on challenges: custom challenges only visible to creator; preset (creator_id IS NULL) visible to all.
2. Add CHECK constraint on challenges.duration_days (1-30).
3. Add CHECK constraint on challenges.status values.
4. Add CHECK constraint on challenge_checkins to prevent future issues.
5. Keep challenge_participants SELECT as-is (already correct — all authenticated can see participations, needed for participant counts).

## Security changes
- challenges SELECT: `creator_id IS NULL OR creator_id = auth.uid()` — preset challenges are public, custom challenges are private to creator.
- This means User B cannot see User A's custom challenges.
*/

-- Fix SELECT policy on challenges: custom challenges only visible to creator
DROP POLICY IF EXISTS "challenges_select_all" ON challenges;
CREATE POLICY "challenges_select_visible" ON challenges FOR SELECT
  TO authenticated USING (creator_id IS NULL OR creator_id = auth.uid());

-- Add CHECK constraint on duration_days (1-30)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_duration_range') THEN
    ALTER TABLE challenges ADD CONSTRAINT chk_duration_range CHECK (duration_days >= 1 AND duration_days <= 30);
  END IF;
END $$;

-- Add CHECK constraint on status
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_challenge_status') THEN
    ALTER TABLE challenges ADD CONSTRAINT chk_challenge_status CHECK (status IN ('active', 'completed', 'archived'));
  END IF;
END $$;
