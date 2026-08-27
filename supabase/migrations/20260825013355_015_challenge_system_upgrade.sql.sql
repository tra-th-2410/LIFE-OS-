/*
# Upgrade Challenges system: custom challenges, daily check-ins, progression

## Summary
Extends the existing challenges and challenge_participants tables to support:
- User-created custom challenges (1-30 days) with ownership
- Daily check-in tracking with uniqueness constraint
- Challenge continuation (rounds) preserving history
- Challenge status (active, completed, archived)
- Categories for filtering

## Changes to existing tables

### challenges (add columns)
- creator_id (uuid, nullable, references profiles) — owner of custom challenges; NULL for preset challenges
- category (text, default 'other') — Study, IELTS, Math, Physics, Chemistry, English, Reading, HSG, Habit, Other
- start_date (date, nullable) — when the challenge begins for the participant
- status (text, default 'active') — active, completed, archived
- parent_challenge_id (uuid, nullable, references challenges) — links a continuation to its original challenge

### challenge_participants (add columns)
- completed (boolean, default false) — whether the user finished this challenge
- round (int, default 1) — which round of continuation this participation represents

## New tables

### challenge_checkins
- id (uuid, primary key)
- challenge_id (uuid, references challenges)
- user_id (uuid, references profiles)
- checkin_date (date) — the day that was completed
- created_at (timestamptz)
- UNIQUE (challenge_id, user_id, checkin_date) — prevents duplicate daily completion

## Security (RLS)
- challenges: authenticated can SELECT all; INSERT/UPDATE/DELETE only own (creator_id = auth.uid())
- challenge_participants: authenticated can SELECT all; INSERT/UPDATE/DELETE only own (user_id = auth.uid())
- challenge_checkins: authenticated can SELECT/INSERT only own (user_id = auth.uid()); DELETE own

## Important notes
1. Preset challenges (creator_id IS NULL) remain visible to all users and cannot be edited/deleted by non-admin users.
2. Custom challenges (creator_id = auth.uid()) are owned by the creator.
3. The unique constraint on challenge_checkins prevents double check-in for the same day.
4. Parent challenge history is preserved — continuations create new challenge rows linked via parent_challenge_id.
5. All existing data is preserved — new columns have safe defaults.
*/

-- Add columns to challenges
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS creator_id uuid REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'other';
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS parent_challenge_id uuid REFERENCES challenges(id) ON DELETE SET NULL;

-- Add columns to challenge_participants
ALTER TABLE challenge_participants ADD COLUMN IF NOT EXISTS completed boolean NOT NULL DEFAULT false;
ALTER TABLE challenge_participants ADD COLUMN IF NOT EXISTS round int NOT NULL DEFAULT 1;

-- Create challenge_checkins table
CREATE TABLE IF NOT EXISTS challenge_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  checkin_date date NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (challenge_id, user_id, checkin_date)
);

ALTER TABLE challenge_checkins ENABLE ROW LEVEL SECURITY;

-- Indexes for challenge_checkins
CREATE INDEX IF NOT EXISTS idx_checkins_user_challenge ON challenge_checkins(user_id, challenge_id, checkin_date DESC);
CREATE INDEX IF NOT EXISTS idx_checkins_challenge ON challenge_checkins(challenge_id, checkin_date DESC);

-- Index for challenges by creator
CREATE INDEX IF NOT EXISTS idx_challenges_creator ON challenges(creator_id);
CREATE INDEX IF NOT EXISTS idx_challenges_status ON challenges(status);
CREATE INDEX IF NOT EXISTS idx_challenges_category ON challenges(category);

-- RLS policies for challenges (update existing)
-- SELECT: all authenticated can see all challenges (preset + custom)
DROP POLICY IF EXISTS "challenges_select_all" ON challenges;
CREATE POLICY "challenges_select_all" ON challenges FOR SELECT
  TO authenticated USING (true);

-- INSERT: any authenticated user can create challenges
DROP POLICY IF EXISTS "challenges_insert" ON challenges;
CREATE POLICY "challenges_insert" ON challenges FOR INSERT
  TO authenticated WITH CHECK (true);

-- UPDATE: only the creator can update their own custom challenges
DROP POLICY IF EXISTS "challenges_update_own" ON challenges;
CREATE POLICY "challenges_update_own" ON challenges FOR UPDATE
  TO authenticated USING (creator_id = auth.uid()) WITH CHECK (creator_id = auth.uid());

-- DELETE: only the creator can delete their own custom challenges
DROP POLICY IF EXISTS "challenges_delete_own" ON challenges;
CREATE POLICY "challenges_delete_own" ON challenges FOR DELETE
  TO authenticated USING (creator_id = auth.uid());

-- RLS policies for challenge_participants (keep existing, they're correct)
-- SELECT: all authenticated can see all participations
-- INSERT/UPDATE/DELETE: only own participation
-- (existing policies are already correct, no changes needed)

-- RLS policies for challenge_checkins
DROP POLICY IF EXISTS "checkins_select_own" ON challenge_checkins;
CREATE POLICY "checkins_select_own" ON challenge_checkins FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "checkins_insert_own" ON challenge_checkins;
CREATE POLICY "checkins_insert_own" ON challenge_checkins FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "checkins_delete_own" ON challenge_checkins;
CREATE POLICY "checkins_delete_own" ON challenge_checkins FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
