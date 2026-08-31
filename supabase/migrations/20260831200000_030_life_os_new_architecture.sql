/*
# Migration: 030_life_os_new_architecture.sql
# Description: Implements comprehensive database support for the unified Life OS architecture:
# 1. Profile display_name column & synchronization
# 2. Smart Calendar with recurring events & reminders
# 3. Weakness Map topic tracking
# 4. Gamification (XP ledger, Leveling, Streak, Achievements, Rewards catalog)
# 5. Focus sessions (Pomodoro with customizable duration)
# 6. Study Library (materials, documents, summaries)
# 7. Study Groups in Community
# 8. Strict Row Level Security (RLS) policies for all new tables
*/

-- ============================================================================
-- 1. PROFILES UPGRADE: display_name
-- ============================================================================
DO $$ BEGIN
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name text;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Populate display_name from full_name or username if null
UPDATE public.profiles
SET display_name = COALESCE(NULLIF(trim(full_name), ''), username)
WHERE display_name IS NULL OR trim(display_name) = '';

-- Ensure authenticated role has full permissions on profiles
GRANT ALL ON TABLE public.profiles TO authenticated;


-- ============================================================================
-- 2. SMART CALENDAR & RECURRING EVENTS & REMINDERS
-- ============================================================================
DO $$ BEGIN CREATE TYPE calendar_event_status AS ENUM ('todo', 'in_progress', 'completed', 'missed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE calendar_event_source AS ENUM ('manual', 'ai_import', 'ai_natural_language', 'study_coach', 'challenge', 'weakness_review'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.smart_calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subject TEXT DEFAULT 'general',
  topic TEXT,
  description TEXT DEFAULT '',
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 45,
  color TEXT DEFAULT 'blue',
  category TEXT DEFAULT 'study',
  status calendar_event_status DEFAULT 'todo',
  is_recurring BOOLEAN DEFAULT false,
  recurrence_rule JSONB DEFAULT '{}'::jsonb, -- e.g. {"freq": "weekly", "days": ["mon", "wed"], "until": "2026-12-31"}
  parent_event_id UUID REFERENCES public.smart_calendar_events(id) ON DELETE CASCADE,
  recurrence_series_id UUID,
  has_reminder BOOLEAN DEFAULT false,
  reminder_minutes_before INT DEFAULT 30,
  source calendar_event_source DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_user_date ON public.smart_calendar_events(user_id, date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_series ON public.smart_calendar_events(recurrence_series_id);

ALTER TABLE public.smart_calendar_events ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.smart_calendar_events TO authenticated;

DROP POLICY IF EXISTS "calendar_events_select" ON public.smart_calendar_events;
CREATE POLICY "calendar_events_select" ON public.smart_calendar_events
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "calendar_events_insert" ON public.smart_calendar_events;
CREATE POLICY "calendar_events_insert" ON public.smart_calendar_events
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "calendar_events_update" ON public.smart_calendar_events;
CREATE POLICY "calendar_events_update" ON public.smart_calendar_events
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "calendar_events_delete" ON public.smart_calendar_events;
CREATE POLICY "calendar_events_delete" ON public.smart_calendar_events
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Calendar Reminders
CREATE TABLE IF NOT EXISTS public.smart_calendar_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.smart_calendar_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reminder_time TIMESTAMPTZ NOT NULL,
  is_sent BOOLEAN DEFAULT false,
  notification_id UUID REFERENCES public.notifications(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calendar_reminders_time ON public.smart_calendar_reminders(user_id, reminder_time, is_sent);

ALTER TABLE public.smart_calendar_reminders ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.smart_calendar_reminders TO authenticated;

DROP POLICY IF EXISTS "calendar_reminders_select" ON public.smart_calendar_reminders;
CREATE POLICY "calendar_reminders_select" ON public.smart_calendar_reminders
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "calendar_reminders_insert" ON public.smart_calendar_reminders;
CREATE POLICY "calendar_reminders_insert" ON public.smart_calendar_reminders
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "calendar_reminders_update" ON public.smart_calendar_reminders;
CREATE POLICY "calendar_reminders_update" ON public.smart_calendar_reminders
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "calendar_reminders_delete" ON public.smart_calendar_reminders;
CREATE POLICY "calendar_reminders_delete" ON public.smart_calendar_reminders
  FOR DELETE TO authenticated USING (auth.uid() = user_id);


-- ============================================================================
-- 3. WEAKNESS MAP TOPICS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.study_weakness_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  total_questions INT NOT NULL DEFAULT 0,
  correct_questions INT NOT NULL DEFAULT 0,
  mastery_score NUMERIC(5,2) NOT NULL DEFAULT 0, -- 0 to 100
  last_assessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_subject_topic UNIQUE (user_id, subject, topic)
);

CREATE INDEX IF NOT EXISTS idx_weakness_topics_user ON public.study_weakness_topics(user_id, mastery_score);

ALTER TABLE public.study_weakness_topics ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.study_weakness_topics TO authenticated;

DROP POLICY IF EXISTS "weakness_topics_select" ON public.study_weakness_topics;
CREATE POLICY "weakness_topics_select" ON public.study_weakness_topics
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "weakness_topics_insert" ON public.study_weakness_topics;
CREATE POLICY "weakness_topics_insert" ON public.study_weakness_topics
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "weakness_topics_update" ON public.study_weakness_topics;
CREATE POLICY "weakness_topics_update" ON public.study_weakness_topics
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "weakness_topics_delete" ON public.study_weakness_topics;
CREATE POLICY "weakness_topics_delete" ON public.study_weakness_topics
  FOR DELETE TO authenticated USING (auth.uid() = user_id);


-- ============================================================================
-- 4. GAMIFICATION (XP LEDGER, LEVEL, STREAK, REWARDS)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_gamification (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  xp INT NOT NULL DEFAULT 0,
  level INT NOT NULL DEFAULT 1,
  streak_days INT NOT NULL DEFAULT 0,
  last_active_date DATE,
  total_study_minutes INT NOT NULL DEFAULT 0,
  total_questions_solved INT NOT NULL DEFAULT 0,
  total_correct_questions INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_gamification ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.user_gamification TO authenticated;

DROP POLICY IF EXISTS "gamification_select" ON public.user_gamification;
CREATE POLICY "gamification_select" ON public.user_gamification
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "gamification_insert" ON public.user_gamification;
CREATE POLICY "gamification_insert" ON public.user_gamification
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "gamification_update" ON public.user_gamification;
CREATE POLICY "gamification_update" ON public.user_gamification
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "gamification_delete" ON public.user_gamification;
CREATE POLICY "gamification_delete" ON public.user_gamification
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- XP Ledger (Audit log to prevent duplicate awards)
CREATE TABLE IF NOT EXISTS public.xp_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  xp_amount INT NOT NULL,
  source_type TEXT NOT NULL, -- 'quiz_completed', 'calendar_task_completed', 'challenge_completed', 'streak_milestone', 'study_set_created', 'flashcards_reviewed', 'focus_session_completed', 'community_activity'
  source_id TEXT,            -- Unique identifier to prevent spam (e.g. session_id, task_id, checkin_id)
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_xp_source UNIQUE (user_id, source_type, source_id)
);

CREATE INDEX IF NOT EXISTS idx_xp_ledger_user ON public.xp_ledger(user_id, created_at DESC);

ALTER TABLE public.xp_ledger ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.xp_ledger TO authenticated;

DROP POLICY IF EXISTS "xp_ledger_select" ON public.xp_ledger;
CREATE POLICY "xp_ledger_select" ON public.xp_ledger
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "xp_ledger_insert" ON public.xp_ledger;
CREATE POLICY "xp_ledger_insert" ON public.xp_ledger
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "xp_ledger_delete" ON public.xp_ledger;
CREATE POLICY "xp_ledger_delete" ON public.xp_ledger
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Rewards Catalog & Unlocks
CREATE TABLE IF NOT EXISTS public.user_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reward_id TEXT NOT NULL,
  reward_type TEXT NOT NULL CHECK (reward_type IN ('pet', 'plant', 'room', 'theme', 'avatar_item', 'garden')),
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  level_required INT NOT NULL DEFAULT 1,
  is_unlocked BOOLEAN NOT NULL DEFAULT false,
  is_equipped BOOLEAN NOT NULL DEFAULT false,
  unlocked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_reward UNIQUE (user_id, reward_id)
);

CREATE INDEX IF NOT EXISTS idx_user_rewards_user ON public.user_rewards(user_id);

ALTER TABLE public.user_rewards ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.user_rewards TO authenticated;

DROP POLICY IF EXISTS "user_rewards_select" ON public.user_rewards;
CREATE POLICY "user_rewards_select" ON public.user_rewards
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_rewards_insert" ON public.user_rewards;
CREATE POLICY "user_rewards_insert" ON public.user_rewards
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_rewards_update" ON public.user_rewards;
CREATE POLICY "user_rewards_update" ON public.user_rewards
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_rewards_delete" ON public.user_rewards;
CREATE POLICY "user_rewards_delete" ON public.user_rewards
  FOR DELETE TO authenticated USING (auth.uid() = user_id);


-- ============================================================================
-- 5. FOCUS SESSIONS (POMODORO)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.focus_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  task_id TEXT,
  event_id UUID REFERENCES public.smart_calendar_events(id) ON DELETE SET NULL,
  subject TEXT DEFAULT 'general',
  duration_minutes INT NOT NULL DEFAULT 25,
  preset_type TEXT NOT NULL DEFAULT '25/5', -- '25/5', '30/5', '45/10', '60/10', 'custom'
  status TEXT NOT NULL DEFAULT 'completed', -- 'completed', 'cancelled'
  xp_awarded INT NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_focus_sessions_user ON public.focus_sessions(user_id, created_at DESC);

ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.focus_sessions TO authenticated;

DROP POLICY IF EXISTS "focus_sessions_select" ON public.focus_sessions;
CREATE POLICY "focus_sessions_select" ON public.focus_sessions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "focus_sessions_insert" ON public.focus_sessions;
CREATE POLICY "focus_sessions_insert" ON public.focus_sessions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "focus_sessions_update" ON public.focus_sessions;
CREATE POLICY "focus_sessions_update" ON public.focus_sessions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "focus_sessions_delete" ON public.focus_sessions;
CREATE POLICY "focus_sessions_delete" ON public.focus_sessions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);


-- ============================================================================
-- 6. STUDY LIBRARY (STUDY MATERIALS)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.study_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT 'general',
  topic TEXT,
  file_name TEXT,
  file_path TEXT,
  file_type TEXT,
  file_size BIGINT DEFAULT 0,
  content_summary TEXT,
  ai_analysis JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_study_materials_user ON public.study_materials(user_id, subject);

ALTER TABLE public.study_materials ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.study_materials TO authenticated;

DROP POLICY IF EXISTS "study_materials_select" ON public.study_materials;
CREATE POLICY "study_materials_select" ON public.study_materials
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "study_materials_insert" ON public.study_materials;
CREATE POLICY "study_materials_insert" ON public.study_materials
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "study_materials_update" ON public.study_materials;
CREATE POLICY "study_materials_update" ON public.study_materials
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "study_materials_delete" ON public.study_materials;
CREATE POLICY "study_materials_delete" ON public.study_materials
  FOR DELETE TO authenticated USING (auth.uid() = user_id);


-- ============================================================================
-- 7. STUDY GROUPS IN COMMUNITY
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.study_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  description TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT 'general',
  creator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  members_count INT DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.study_group_members (
  group_id UUID NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.study_group_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  attachments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.study_group_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  uploader_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('document', 'quiz', 'challenge', 'link')),
  resource_id TEXT,
  file_url TEXT,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.study_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_group_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_group_resources ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.study_groups TO authenticated;
GRANT ALL ON TABLE public.study_group_members TO authenticated;
GRANT ALL ON TABLE public.study_group_messages TO authenticated;
GRANT ALL ON TABLE public.study_group_resources TO authenticated;

DROP POLICY IF EXISTS "study_groups_select" ON public.study_groups;
CREATE POLICY "study_groups_select" ON public.study_groups FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "study_groups_insert" ON public.study_groups;
CREATE POLICY "study_groups_insert" ON public.study_groups FOR INSERT TO authenticated WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "study_groups_update" ON public.study_groups;
CREATE POLICY "study_groups_update" ON public.study_groups FOR UPDATE TO authenticated USING (auth.uid() = creator_id) WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "study_groups_delete" ON public.study_groups;
CREATE POLICY "study_groups_delete" ON public.study_groups FOR DELETE TO authenticated USING (auth.uid() = creator_id);

DROP POLICY IF EXISTS "study_group_members_select" ON public.study_group_members;
CREATE POLICY "study_group_members_select" ON public.study_group_members FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "study_group_members_insert" ON public.study_group_members;
CREATE POLICY "study_group_members_insert" ON public.study_group_members FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM public.study_groups g WHERE g.id = study_group_members.group_id AND g.creator_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "study_group_members_update" ON public.study_group_members;
CREATE POLICY "study_group_members_update" ON public.study_group_members FOR UPDATE TO authenticated USING (
  auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM public.study_groups g WHERE g.id = study_group_members.group_id AND g.creator_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "study_group_members_delete" ON public.study_group_members;
CREATE POLICY "study_group_members_delete" ON public.study_group_members FOR DELETE TO authenticated USING (
  auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM public.study_groups g WHERE g.id = study_group_members.group_id AND g.creator_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "study_group_messages_select" ON public.study_group_messages;
CREATE POLICY "study_group_messages_select" ON public.study_group_messages FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.study_group_members m WHERE m.group_id = study_group_messages.group_id AND m.user_id = auth.uid())
);

DROP POLICY IF EXISTS "study_group_messages_insert" ON public.study_group_messages;
CREATE POLICY "study_group_messages_insert" ON public.study_group_messages FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = sender_id AND EXISTS (SELECT 1 FROM public.study_group_members m WHERE m.group_id = study_group_messages.group_id AND m.user_id = auth.uid())
);

DROP POLICY IF EXISTS "study_group_messages_delete" ON public.study_group_messages;
CREATE POLICY "study_group_messages_delete" ON public.study_group_messages FOR DELETE TO authenticated USING (
  auth.uid() = sender_id OR EXISTS (SELECT 1 FROM public.study_groups g WHERE g.id = study_group_messages.group_id AND g.creator_id = auth.uid())
);

DROP POLICY IF EXISTS "study_group_resources_select" ON public.study_group_resources;
CREATE POLICY "study_group_resources_select" ON public.study_group_resources FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.study_group_members m WHERE m.group_id = study_group_resources.group_id AND m.user_id = auth.uid())
);

DROP POLICY IF EXISTS "study_group_resources_insert" ON public.study_group_resources;
CREATE POLICY "study_group_resources_insert" ON public.study_group_resources FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = uploader_id AND EXISTS (SELECT 1 FROM public.study_group_members m WHERE m.group_id = study_group_resources.group_id AND m.user_id = auth.uid())
);

DROP POLICY IF EXISTS "study_group_resources_update" ON public.study_group_resources;
CREATE POLICY "study_group_resources_update" ON public.study_group_resources FOR UPDATE TO authenticated USING (
  auth.uid() = uploader_id OR EXISTS (SELECT 1 FROM public.study_groups g WHERE g.id = study_group_resources.group_id AND g.creator_id = auth.uid())
);

DROP POLICY IF EXISTS "study_group_resources_delete" ON public.study_group_resources;
CREATE POLICY "study_group_resources_delete" ON public.study_group_resources FOR DELETE TO authenticated USING (
  auth.uid() = uploader_id OR EXISTS (SELECT 1 FROM public.study_groups g WHERE g.id = study_group_resources.group_id AND g.creator_id = auth.uid())
);
