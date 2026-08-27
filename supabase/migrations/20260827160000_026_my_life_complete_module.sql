/*
# Migration: 026_my_life_complete_module.sql
# Description: Implements comprehensive database support for My Life module:
# - Friendships & connected users system with security definer helper
# - Habit templates library with student-oriented seed data & habit table extensions
# - Mood weekly summaries table with user habit integration
# - Journal social upgrades: visibility, attachments, reactions, comments, and shares
# - Strict Row Level Security (RLS) policies for all new and updated tables
*/

-- ============================================================================
-- 1. FRIENDSHIPS & CONNECTED USERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'blocked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_friendship UNIQUE (user_id, friend_id),
  CONSTRAINT no_self_friendship CHECK (user_id != friend_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_user ON friendships(user_id, status);
CREATE INDEX IF NOT EXISTS idx_friendships_friend ON friendships(friend_id, status);

-- Security definer helper to check friendship without RLS recursion
CREATE OR REPLACE FUNCTION are_friends(u1 UUID, u2 UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM friendships
    WHERE status = 'accepted'
    AND ((user_id = u1 AND friend_id = u2) OR (user_id = u2 AND friend_id = u1))
  );
$$;

ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "friendships_select" ON friendships;
CREATE POLICY "friendships_select" ON friendships
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

DROP POLICY IF EXISTS "friendships_insert" ON friendships;
CREATE POLICY "friendships_insert" ON friendships
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "friendships_update" ON friendships;
CREATE POLICY "friendships_update" ON friendships
  FOR UPDATE TO authenticated
  USING (auth.uid() = friend_id OR auth.uid() = user_id)
  WITH CHECK (auth.uid() = friend_id OR auth.uid() = user_id);

DROP POLICY IF EXISTS "friendships_delete" ON friendships;
CREATE POLICY "friendships_delete" ON friendships
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = friend_id);


-- ============================================================================
-- 2. HABIT TEMPLATES & HABIT UPGRADES
-- ============================================================================

CREATE TABLE IF NOT EXISTS habit_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT '🎯',
  category TEXT NOT NULL DEFAULT 'study' CHECK (category IN ('study', 'health', 'mindfulness', 'language', 'skill', 'routine')),
  default_frequency TEXT NOT NULL DEFAULT 'daily',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_habit_templates_category ON habit_templates(category, sort_order);

ALTER TABLE habit_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "habit_templates_select" ON habit_templates;
CREATE POLICY "habit_templates_select" ON habit_templates
  FOR SELECT TO authenticated
  USING (true);

-- Seed predefined student habits
INSERT INTO habit_templates (title, description, icon, category, sort_order) VALUES
  ('Đọc sách 20 phút', 'Đọc sách chuyên ngành hoặc sách phát triển bản thân', '📚', 'study', 1),
  ('Chạy bộ', 'Rèn luyện sức bền và giải tỏa căng thẳng', '🏃', 'health', 2),
  ('Bơi lội', 'Vận động toàn diện nâng cao thể lực', '🏊', 'health', 3),
  ('Tập thể dục / Gym', 'Tập luyện thể chất duy trì vóc dáng và năng lượng', '💪', 'health', 4),
  ('Thiền 10 phút', 'Thư giãn tâm trí, giảm lo âu và tăng tập trung', '🧘', 'mindfulness', 5),
  ('Đi bộ ngoài trời', 'Hít thở không khí trong lành và thư giãn mắt', '🚶', 'mindfulness', 6),
  ('Tự học tập trung (Pomodoro)', 'Học không xao nhãng theo phiên 25 phút', '⏱️', 'study', 7),
  ('Uống đủ 2L nước', 'Duy trì đủ nước cho cơ thể và trí não cả ngày', '💧', 'health', 8),
  ('Ngủ đúng giờ (trước 23h)', 'Đảm bảo giấc ngủ chất lượng để phục hồi năng lượng', '🌙', 'health', 9),
  ('Viết nhật ký ngày', 'Ghi lại cảm xúc, bài học và điều biết ơn', '✍️', 'mindfulness', 10),
  ('Học tiếng Anh 30 phút', 'Luyện nghe, nói hoặc ngữ pháp tiếng Anh', '🗣️', 'language', 11),
  ('Ôn 15 từ vựng mới', 'Học và ôn tập từ vựng qua flashcards', '🔤', 'language', 12),
  ('Luyện 1 đề IELTS', 'Luyện kỹ năng Reading/Listening hoặc viết Task 1/2', '🎯', 'language', 13),
  ('Luyện lập trình / Coding', 'Viết code giải thuật hoặc xây dựng dự án cá nhân', '💻', 'skill', 14),
  ('Dọn dẹp bàn học', 'Giữ không gian học tập gọn gàng, thoáng đãng', '🧹', 'routine', 15)
ON CONFLICT DO NOTHING;

-- Extend habits table
ALTER TABLE habits ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'study';
ALTER TABLE habits ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS target_days INT DEFAULT 7;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_habits_user_archived ON habits(user_id, is_archived);
CREATE INDEX IF NOT EXISTS idx_habit_logs_user_date ON habit_logs(user_id, completed_date);


-- ============================================================================
-- 3. MOOD TRACKER & WEEKLY SUMMARIES
-- ============================================================================

CREATE TABLE IF NOT EXISTS mood_weekly_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  avg_mood NUMERIC(3,2) NOT NULL,
  positive_days_count INT NOT NULL DEFAULT 0,
  neutral_days_count INT NOT NULL DEFAULT 0,
  difficult_days_count INT NOT NULL DEFAULT 0,
  trend TEXT NOT NULL CHECK (trend IN ('improving', 'stable', 'declining', 'mixed')),
  summary_text TEXT NOT NULL,
  encouragement TEXT NOT NULL,
  habit_suggestions JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_week UNIQUE (user_id, week_start_date)
);

CREATE INDEX IF NOT EXISTS idx_mood_summaries_user_week ON mood_weekly_summaries(user_id, week_start_date DESC);

ALTER TABLE mood_weekly_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mood_weekly_summaries_select" ON mood_weekly_summaries;
CREATE POLICY "mood_weekly_summaries_select" ON mood_weekly_summaries
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "mood_weekly_summaries_insert" ON mood_weekly_summaries;
CREATE POLICY "mood_weekly_summaries_insert" ON mood_weekly_summaries
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "mood_weekly_summaries_update" ON mood_weekly_summaries;
CREATE POLICY "mood_weekly_summaries_update" ON mood_weekly_summaries
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "mood_weekly_summaries_delete" ON mood_weekly_summaries;
CREATE POLICY "mood_weekly_summaries_delete" ON mood_weekly_summaries
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);


-- ============================================================================
-- 4. JOURNAL SOCIAL UPGRADES
-- ============================================================================

-- Add visibility and social columns to journal_entries
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'friends' CHECK (visibility IN ('private', 'friends', 'public'));
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS reactions_count INT DEFAULT 0;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS comments_count INT DEFAULT 0;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS image_url TEXT;

CREATE INDEX IF NOT EXISTS idx_journal_visibility ON journal_entries(visibility, created_at DESC);

-- Update RLS for journal_entries to support friends / public
DROP POLICY IF EXISTS "journal_select_own" ON journal_entries;
DROP POLICY IF EXISTS "journal_select_social" ON journal_entries;
CREATE POLICY "journal_select_social" ON journal_entries
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR visibility = 'public'
    OR (visibility = 'friends' AND are_friends(auth.uid(), user_id))
  );

-- Journal attachments
CREATE TABLE IF NOT EXISTS journal_post_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  uploader_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  is_image BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_journal_attachments_journal ON journal_post_attachments(journal_id);

ALTER TABLE journal_post_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "journal_attachments_select" ON journal_post_attachments;
CREATE POLICY "journal_attachments_select" ON journal_post_attachments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM journal_entries j
      WHERE j.id = journal_post_attachments.journal_id
      AND (j.user_id = auth.uid() OR j.visibility = 'public' OR (j.visibility = 'friends' AND are_friends(auth.uid(), j.user_id)))
    )
  );

DROP POLICY IF EXISTS "journal_attachments_insert" ON journal_post_attachments;
CREATE POLICY "journal_attachments_insert" ON journal_post_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = uploader_id
    AND EXISTS (
      SELECT 1 FROM journal_entries j
      WHERE j.id = journal_post_attachments.journal_id AND j.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "journal_attachments_delete" ON journal_post_attachments;
CREATE POLICY "journal_attachments_delete" ON journal_post_attachments
  FOR DELETE TO authenticated
  USING (auth.uid() = uploader_id);

-- Journal reactions
CREATE TABLE IF NOT EXISTS journal_post_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_journal_user_reaction UNIQUE (journal_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_journal_reactions_journal ON journal_post_reactions(journal_id);

ALTER TABLE journal_post_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "journal_reactions_select" ON journal_post_reactions;
CREATE POLICY "journal_reactions_select" ON journal_post_reactions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM journal_entries j
      WHERE j.id = journal_post_reactions.journal_id
      AND (j.user_id = auth.uid() OR j.visibility = 'public' OR (j.visibility = 'friends' AND are_friends(auth.uid(), j.user_id)))
    )
  );

DROP POLICY IF EXISTS "journal_reactions_insert" ON journal_post_reactions;
CREATE POLICY "journal_reactions_insert" ON journal_post_reactions
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM journal_entries j
      WHERE j.id = journal_post_reactions.journal_id
      AND (j.user_id = auth.uid() OR j.visibility = 'public' OR (j.visibility = 'friends' AND are_friends(auth.uid(), j.user_id)))
    )
  );

DROP POLICY IF EXISTS "journal_reactions_update" ON journal_post_reactions;
CREATE POLICY "journal_reactions_update" ON journal_post_reactions
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "journal_reactions_delete" ON journal_post_reactions;
CREATE POLICY "journal_reactions_delete" ON journal_post_reactions
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Journal comments
CREATE TABLE IF NOT EXISTS journal_post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES journal_post_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_journal_comments_journal ON journal_post_comments(journal_id, created_at);

ALTER TABLE journal_post_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "journal_comments_select" ON journal_post_comments;
CREATE POLICY "journal_comments_select" ON journal_post_comments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM journal_entries j
      WHERE j.id = journal_post_comments.journal_id
      AND (j.user_id = auth.uid() OR j.visibility = 'public' OR (j.visibility = 'friends' AND are_friends(auth.uid(), j.user_id)))
    )
  );

DROP POLICY IF EXISTS "journal_comments_insert" ON journal_post_comments;
CREATE POLICY "journal_comments_insert" ON journal_post_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = author_id
    AND EXISTS (
      SELECT 1 FROM journal_entries j
      WHERE j.id = journal_post_comments.journal_id
      AND (j.user_id = auth.uid() OR j.visibility = 'public' OR (j.visibility = 'friends' AND are_friends(auth.uid(), j.user_id)))
    )
  );

DROP POLICY IF EXISTS "journal_comments_update" ON journal_post_comments;
CREATE POLICY "journal_comments_update" ON journal_post_comments
  FOR UPDATE TO authenticated
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "journal_comments_delete" ON journal_post_comments;
CREATE POLICY "journal_comments_delete" ON journal_post_comments
  FOR DELETE TO authenticated
  USING (
    auth.uid() = author_id
    OR EXISTS (
      SELECT 1 FROM journal_entries j
      WHERE j.id = journal_post_comments.journal_id AND j.user_id = auth.uid()
    )
  );

-- Journal shares
CREATE TABLE IF NOT EXISTS journal_post_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  shared_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  shared_to_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  caption TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_journal_shares_journal ON journal_post_shares(journal_id);

ALTER TABLE journal_post_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "journal_shares_select" ON journal_post_shares;
CREATE POLICY "journal_shares_select" ON journal_post_shares
  FOR SELECT TO authenticated
  USING (auth.uid() = shared_by OR auth.uid() = shared_to_user_id);

DROP POLICY IF EXISTS "journal_shares_insert" ON journal_post_shares;
CREATE POLICY "journal_shares_insert" ON journal_post_shares
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = shared_by
    AND EXISTS (
      SELECT 1 FROM journal_entries j
      WHERE j.id = journal_post_shares.journal_id
      AND (j.user_id = auth.uid() OR j.visibility = 'public' OR (j.visibility = 'friends' AND are_friends(auth.uid(), j.user_id)))
    )
  );
