-- Migration 027: Quiz & Flashcard System

-- 1. study_sets
CREATE TABLE IF NOT EXISTS study_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT 'other',
  topic TEXT,
  description TEXT,
  default_type TEXT DEFAULT 'flashcard',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. study_questions
CREATE TABLE IF NOT EXISTS study_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id UUID NOT NULL REFERENCES study_sets(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('flashcard', 'multiple_choice', 'fill_blank')),
  question TEXT NOT NULL,
  answer TEXT,
  explanation TEXT,
  options JSONB,
  correct_option TEXT CHECK (correct_option IN ('A', 'B', 'C', 'D') OR correct_option IS NULL),
  sort_order INT NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. study_progress
CREATE TABLE IF NOT EXISTS study_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES study_questions(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'learning', 'reviewing', 'mastered')),
  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard') OR difficulty IS NULL),
  next_review_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  correct_count INT NOT NULL DEFAULT 0,
  incorrect_count INT NOT NULL DEFAULT 0,
  last_reviewed_at TIMESTAMPTZ,
  UNIQUE(user_id, question_id)
);

-- 4. study_sessions
CREATE TABLE IF NOT EXISTS study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  set_id UUID NOT NULL REFERENCES study_sets(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('practice', 'exam')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_seconds INT DEFAULT 0,
  total_questions INT NOT NULL DEFAULT 0,
  correct_answers INT NOT NULL DEFAULT 0,
  incorrect_answers INT NOT NULL DEFAULT 0,
  score NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_study_sets_user_id ON study_sets(user_id);
CREATE INDEX IF NOT EXISTS idx_study_questions_set_id ON study_questions(set_id);
CREATE INDEX IF NOT EXISTS idx_study_questions_sort ON study_questions(set_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_study_progress_user_q ON study_progress(user_id, question_id);
CREATE INDEX IF NOT EXISTS idx_study_progress_review ON study_progress(user_id, next_review_at);
CREATE INDEX IF NOT EXISTS idx_study_sessions_user_set ON study_sessions(user_id, set_id);

-- Enable RLS
ALTER TABLE study_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: study_sets
DROP POLICY IF EXISTS "study_sets_select" ON study_sets;
CREATE POLICY "study_sets_select" ON study_sets
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "study_sets_insert" ON study_sets;
CREATE POLICY "study_sets_insert" ON study_sets
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "study_sets_update" ON study_sets;
CREATE POLICY "study_sets_update" ON study_sets
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "study_sets_delete" ON study_sets;
CREATE POLICY "study_sets_delete" ON study_sets
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- RLS Policies: study_questions
DROP POLICY IF EXISTS "study_questions_select" ON study_questions;
CREATE POLICY "study_questions_select" ON study_questions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM study_sets
      WHERE study_sets.id = study_questions.set_id
      AND study_sets.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "study_questions_insert" ON study_questions;
CREATE POLICY "study_questions_insert" ON study_questions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM study_sets
      WHERE study_sets.id = study_questions.set_id
      AND study_sets.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "study_questions_update" ON study_questions;
CREATE POLICY "study_questions_update" ON study_questions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM study_sets
      WHERE study_sets.id = study_questions.set_id
      AND study_sets.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM study_sets
      WHERE study_sets.id = study_questions.set_id
      AND study_sets.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "study_questions_delete" ON study_questions;
CREATE POLICY "study_questions_delete" ON study_questions
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM study_sets
      WHERE study_sets.id = study_questions.set_id
      AND study_sets.user_id = auth.uid()
    )
  );

-- RLS Policies: study_progress
DROP POLICY IF EXISTS "study_progress_select" ON study_progress;
CREATE POLICY "study_progress_select" ON study_progress
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "study_progress_insert" ON study_progress;
CREATE POLICY "study_progress_insert" ON study_progress
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "study_progress_update" ON study_progress;
CREATE POLICY "study_progress_update" ON study_progress
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "study_progress_delete" ON study_progress;
CREATE POLICY "study_progress_delete" ON study_progress
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- RLS Policies: study_sessions
DROP POLICY IF EXISTS "study_sessions_select" ON study_sessions;
CREATE POLICY "study_sessions_select" ON study_sessions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "study_sessions_insert" ON study_sessions;
CREATE POLICY "study_sessions_insert" ON study_sessions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "study_sessions_update" ON study_sessions;
CREATE POLICY "study_sessions_update" ON study_sessions
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "study_sessions_delete" ON study_sessions;
CREATE POLICY "study_sessions_delete" ON study_sessions
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());
