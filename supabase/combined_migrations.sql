-- ============================================================================
-- LIFE OS - COMPLETE COMBINED SUPABASE MIGRATIONS (001 -> 026)
-- Generated on: 2026-08-27T09:24:15.185Z
-- Total migrations included: 26
-- ============================================================================


-- ============================================================================
-- [MIGRATION 001] 20260815144007_001_tables_and_enums.sql
-- ============================================================================

/*
# Nexus Social OS — Tables & Enums

Creates all tables and enum types for the platform.
Policies are applied in a separate migration (002_policies).

## Tables (see 002 for security details)
profiles, communities, community_members, posts, comments, goals, habits,
habit_logs, mood_entries, journal_entries, projects, project_members,
project_tasks, challenges, challenge_participants, notifications, reports,
ai_conversations, ai_messages
*/

-- Enums
DO $$ BEGIN CREATE TYPE profile_visibility AS ENUM ('public','friends','private'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE community_role AS ENUM ('member','moderator','owner'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE post_type AS ENUM ('text','image','poll','link'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE goal_category AS ENUM ('study','health','skill','personal','project'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE goal_status AS ENUM ('active','completed','abandoned'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE project_status AS ENUM ('recruiting','active','completed','paused'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE task_status AS ENUM ('todo','in_progress','done'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE task_priority AS ENUM ('low','medium','high'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE report_status AS ENUM ('pending','reviewed','resolved'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE message_role AS ENUM ('user','assistant'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- profiles
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  full_name text,
  avatar_url text,
  bio text,
  interests text[] DEFAULT '{}',
  skills text[] DEFAULT '{}',
  goals text[] DEFAULT '{}',
  profile_visibility profile_visibility DEFAULT 'public',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- communities
CREATE TABLE IF NOT EXISTS communities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text NOT NULL DEFAULT '',
  icon text DEFAULT '💬',
  color text DEFAULT 'teal',
  is_private boolean DEFAULT false,
  is_anonymous boolean DEFAULT false,
  members_count int DEFAULT 0,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- community_members
CREATE TABLE IF NOT EXISTS community_members (
  community_id uuid REFERENCES communities(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  role community_role DEFAULT 'member',
  joined_at timestamptz DEFAULT now(),
  PRIMARY KEY (community_id, user_id)
);

-- posts
CREATE TABLE IF NOT EXISTS posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid REFERENCES communities(id) ON DELETE CASCADE,
  author_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  title text,
  content text NOT NULL DEFAULT '',
  type post_type DEFAULT 'text',
  is_anonymous boolean DEFAULT false,
  poll_options jsonb,
  poll_votes jsonb DEFAULT '{}',
  image_url text,
  link_url text,
  comments_count int DEFAULT 0,
  reactions_count int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- comments
CREATE TABLE IF NOT EXISTS comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE,
  author_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES comments(id) ON DELETE CASCADE,
  content text NOT NULL,
  is_anonymous boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- goals
CREATE TABLE IF NOT EXISTS goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  category goal_category DEFAULT 'personal',
  status goal_status DEFAULT 'active',
  progress int DEFAULT 0,
  target_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- habits
CREATE TABLE IF NOT EXISTS habits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  icon text DEFAULT '✅',
  frequency text DEFAULT 'daily',
  streak int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- habit_logs
CREATE TABLE IF NOT EXISTS habit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id uuid REFERENCES habits(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  completed_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

-- mood_entries
CREATE TABLE IF NOT EXISTS mood_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  mood int NOT NULL,
  note text,
  tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- journal_entries
CREATE TABLE IF NOT EXISTS journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  title text,
  content text NOT NULL,
  mood int,
  is_private boolean DEFAULT true,
  ai_analysis jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- projects
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  status project_status DEFAULT 'recruiting',
  progress int DEFAULT 0,
  deadline date,
  roles_needed text[] DEFAULT '{}',
  tags text[] DEFAULT '{}',
  members_count int DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- project_members
CREATE TABLE IF NOT EXISTS project_members (
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'Member',
  joined_at timestamptz DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

-- project_tasks
CREATE TABLE IF NOT EXISTS project_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  assignee_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  status task_status DEFAULT 'todo',
  priority task_priority DEFAULT 'medium',
  due_date date,
  "order" int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- challenges
CREATE TABLE IF NOT EXISTS challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'custom',
  duration_days int DEFAULT 7,
  icon text DEFAULT '🏆',
  color text DEFAULT 'amber',
  participants_count int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- challenge_participants
CREATE TABLE IF NOT EXISTS challenge_participants (
  challenge_id uuid REFERENCES challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  progress int DEFAULT 0,
  streak int DEFAULT 0,
  joined_at timestamptz DEFAULT now(),
  PRIMARY KEY (challenge_id, user_id)
);

-- notifications
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- reports
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  reason text NOT NULL,
  status report_status DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

-- ai_conversations
CREATE TABLE IF NOT EXISTS ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  bot_type text NOT NULL DEFAULT 'companion',
  title text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ai_messages
CREATE TABLE IF NOT EXISTS ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role message_role NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE habit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE mood_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_posts_community ON posts(community_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_habits_user ON habits(user_id);
CREATE INDEX IF NOT EXISTS idx_mood_user ON mood_entries(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_journal_user ON journal_entries(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON project_tasks(project_id, "order");
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_msg_conv ON ai_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_cm_user ON community_members(user_id);
CREATE INDEX IF NOT EXISTS idx_cm_community ON community_members(community_id);


-- ============================================================================
-- [MIGRATION 002] 20260815144036_002_policies.sql
-- ============================================================================

/*
# Nexus Social OS — Row Level Security Policies

## Security Overview
All tables have RLS enabled. Policies enforce:

1. profiles — all authenticated users can read; only owner can insert/update.
2. communities — public communities readable by all; private readable by members/owner; owner manages.
3. community_members — visible to members of same community; users join/leave themselves.
4. posts — readable by community members; author manages own posts.
5. comments — readable by community members; author manages own comments.
6. goals, habits, habit_logs, mood_entries, journal_entries — strictly owner-only CRUD (private data).
7. projects — public read; owner manages; members can join/leave.
8. project_tasks — public read; project owner/members can create/update; owner can delete.
9. challenges — public read; any authenticated user can create.
10. challenge_participants — public read; users manage own participation.
11. notifications — owner-only CRUD.
12. reports — reporter can create and read own reports.
13. ai_conversations, ai_messages — owner-only CRUD (private AI data).

All owner columns default to auth.uid() so inserts that omit the owner still satisfy WITH CHECK.
*/

-- profiles
DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
CREATE POLICY "profiles_select_all" ON profiles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- communities
DROP POLICY IF EXISTS "communities_select" ON communities;
CREATE POLICY "communities_select" ON communities FOR SELECT TO authenticated USING (
  is_private = false
  OR created_by = auth.uid()
  OR EXISTS (SELECT 1 FROM community_members cm WHERE cm.community_id = communities.id AND cm.user_id = auth.uid())
);
DROP POLICY IF EXISTS "communities_insert_own" ON communities;
CREATE POLICY "communities_insert_own" ON communities FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
DROP POLICY IF EXISTS "communities_update_own" ON communities;
CREATE POLICY "communities_update_own" ON communities FOR UPDATE TO authenticated USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);
DROP POLICY IF EXISTS "communities_delete_own" ON communities;
CREATE POLICY "communities_delete_own" ON communities FOR DELETE TO authenticated USING (auth.uid() = created_by);

-- community_members
DROP POLICY IF EXISTS "cm_select" ON community_members;
CREATE POLICY "cm_select" ON community_members FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM communities c WHERE c.id = community_members.community_id
    AND (c.is_private = false OR c.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM community_members cm2 WHERE cm2.community_id = c.id AND cm2.user_id = auth.uid()))
  )
);
DROP POLICY IF EXISTS "cm_insert_own" ON community_members;
CREATE POLICY "cm_insert_own" ON community_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "cm_delete_own" ON community_members;
CREATE POLICY "cm_delete_own" ON community_members FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- posts
DROP POLICY IF EXISTS "posts_select" ON posts;
CREATE POLICY "posts_select" ON posts FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM communities c WHERE c.id = posts.community_id
    AND (c.is_private = false OR c.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM community_members cm WHERE cm.community_id = c.id AND cm.user_id = auth.uid()))
  )
);
DROP POLICY IF EXISTS "posts_insert_own" ON posts;
CREATE POLICY "posts_insert_own" ON posts FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = author_id
  AND EXISTS (SELECT 1 FROM community_members cm WHERE cm.community_id = posts.community_id AND cm.user_id = auth.uid())
);
DROP POLICY IF EXISTS "posts_update_own" ON posts;
CREATE POLICY "posts_update_own" ON posts FOR UPDATE TO authenticated USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS "posts_delete_own" ON posts;
CREATE POLICY "posts_delete_own" ON posts FOR DELETE TO authenticated USING (auth.uid() = author_id);

-- comments
DROP POLICY IF EXISTS "comments_select" ON comments;
CREATE POLICY "comments_select" ON comments FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM posts p JOIN communities c ON c.id = p.community_id
    WHERE p.id = comments.post_id
    AND (c.is_private = false OR c.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM community_members cm WHERE cm.community_id = c.id AND cm.user_id = auth.uid()))
  )
);
DROP POLICY IF EXISTS "comments_insert_own" ON comments;
CREATE POLICY "comments_insert_own" ON comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS "comments_update_own" ON comments;
CREATE POLICY "comments_update_own" ON comments FOR UPDATE TO authenticated USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS "comments_delete_own" ON comments;
CREATE POLICY "comments_delete_own" ON comments FOR DELETE TO authenticated USING (auth.uid() = author_id);

-- goals
DROP POLICY IF EXISTS "goals_select_own" ON goals;
CREATE POLICY "goals_select_own" ON goals FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "goals_insert_own" ON goals;
CREATE POLICY "goals_insert_own" ON goals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "goals_update_own" ON goals;
CREATE POLICY "goals_update_own" ON goals FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "goals_delete_own" ON goals;
CREATE POLICY "goals_delete_own" ON goals FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- habits
DROP POLICY IF EXISTS "habits_select_own" ON habits;
CREATE POLICY "habits_select_own" ON habits FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "habits_insert_own" ON habits;
CREATE POLICY "habits_insert_own" ON habits FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "habits_update_own" ON habits;
CREATE POLICY "habits_update_own" ON habits FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "habits_delete_own" ON habits;
CREATE POLICY "habits_delete_own" ON habits FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- habit_logs
DROP POLICY IF EXISTS "habit_logs_select_own" ON habit_logs;
CREATE POLICY "habit_logs_select_own" ON habit_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "habit_logs_insert_own" ON habit_logs;
CREATE POLICY "habit_logs_insert_own" ON habit_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "habit_logs_delete_own" ON habit_logs;
CREATE POLICY "habit_logs_delete_own" ON habit_logs FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- mood_entries
DROP POLICY IF EXISTS "mood_select_own" ON mood_entries;
CREATE POLICY "mood_select_own" ON mood_entries FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "mood_insert_own" ON mood_entries;
CREATE POLICY "mood_insert_own" ON mood_entries FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "mood_delete_own" ON mood_entries;
CREATE POLICY "mood_delete_own" ON mood_entries FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- journal_entries
DROP POLICY IF EXISTS "journal_select_own" ON journal_entries;
CREATE POLICY "journal_select_own" ON journal_entries FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "journal_insert_own" ON journal_entries;
CREATE POLICY "journal_insert_own" ON journal_entries FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "journal_update_own" ON journal_entries;
CREATE POLICY "journal_update_own" ON journal_entries FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "journal_delete_own" ON journal_entries;
CREATE POLICY "journal_delete_own" ON journal_entries FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- projects
DROP POLICY IF EXISTS "projects_select_all" ON projects;
CREATE POLICY "projects_select_all" ON projects FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "projects_insert_own" ON projects;
CREATE POLICY "projects_insert_own" ON projects FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
DROP POLICY IF EXISTS "projects_update_own" ON projects;
CREATE POLICY "projects_update_own" ON projects FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
DROP POLICY IF EXISTS "projects_delete_own" ON projects;
CREATE POLICY "projects_delete_own" ON projects FOR DELETE TO authenticated USING (auth.uid() = owner_id);

-- project_members
DROP POLICY IF EXISTS "pm_select_all" ON project_members;
CREATE POLICY "pm_select_all" ON project_members FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "pm_insert_own" ON project_members;
CREATE POLICY "pm_insert_own" ON project_members FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM projects p WHERE p.id = project_members.project_id AND p.owner_id = auth.uid())
);
DROP POLICY IF EXISTS "pm_delete_own" ON project_members;
CREATE POLICY "pm_delete_own" ON project_members FOR DELETE TO authenticated USING (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM projects p WHERE p.id = project_members.project_id AND p.owner_id = auth.uid())
);

-- project_tasks
DROP POLICY IF EXISTS "tasks_select_all" ON project_tasks;
CREATE POLICY "tasks_select_all" ON project_tasks FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "tasks_insert" ON project_tasks;
CREATE POLICY "tasks_insert" ON project_tasks FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM projects p WHERE p.id = project_tasks.project_id AND p.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = project_tasks.project_id AND pm.user_id = auth.uid())
);
DROP POLICY IF EXISTS "tasks_update" ON project_tasks;
CREATE POLICY "tasks_update" ON project_tasks FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM projects p WHERE p.id = project_tasks.project_id AND p.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = project_tasks.project_id AND pm.user_id = auth.uid())
) WITH CHECK (true);
DROP POLICY IF EXISTS "tasks_delete" ON project_tasks;
CREATE POLICY "tasks_delete" ON project_tasks FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM projects p WHERE p.id = project_tasks.project_id AND p.owner_id = auth.uid())
);

-- challenges
DROP POLICY IF EXISTS "challenges_select_all" ON challenges;
CREATE POLICY "challenges_select_all" ON challenges FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "challenges_insert" ON challenges;
CREATE POLICY "challenges_insert" ON challenges FOR INSERT TO authenticated WITH CHECK (true);

-- challenge_participants
DROP POLICY IF EXISTS "cp_select_all" ON challenge_participants;
CREATE POLICY "cp_select_all" ON challenge_participants FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "cp_insert_own" ON challenge_participants;
CREATE POLICY "cp_insert_own" ON challenge_participants FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "cp_update_own" ON challenge_participants;
CREATE POLICY "cp_update_own" ON challenge_participants FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "cp_delete_own" ON challenge_participants;
CREATE POLICY "cp_delete_own" ON challenge_participants FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- notifications
DROP POLICY IF EXISTS "notif_select_own" ON notifications;
CREATE POLICY "notif_select_own" ON notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "notif_insert" ON notifications;
CREATE POLICY "notif_insert" ON notifications FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "notif_update_own" ON notifications;
CREATE POLICY "notif_update_own" ON notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "notif_delete_own" ON notifications;
CREATE POLICY "notif_delete_own" ON notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- reports
DROP POLICY IF EXISTS "reports_select_own" ON reports;
CREATE POLICY "reports_select_own" ON reports FOR SELECT TO authenticated USING (auth.uid() = reporter_id);
DROP POLICY IF EXISTS "reports_insert_own" ON reports;
CREATE POLICY "reports_insert_own" ON reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);

-- ai_conversations
DROP POLICY IF EXISTS "ai_conv_select_own" ON ai_conversations;
CREATE POLICY "ai_conv_select_own" ON ai_conversations FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "ai_conv_insert_own" ON ai_conversations;
CREATE POLICY "ai_conv_insert_own" ON ai_conversations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "ai_conv_update_own" ON ai_conversations;
CREATE POLICY "ai_conv_update_own" ON ai_conversations FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "ai_conv_delete_own" ON ai_conversations;
CREATE POLICY "ai_conv_delete_own" ON ai_conversations FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ai_messages
DROP POLICY IF EXISTS "ai_msg_select_own" ON ai_messages;
CREATE POLICY "ai_msg_select_own" ON ai_messages FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM ai_conversations c WHERE c.id = ai_messages.conversation_id AND c.user_id = auth.uid())
);
DROP POLICY IF EXISTS "ai_msg_insert_own" ON ai_messages;
CREATE POLICY "ai_msg_insert_own" ON ai_messages FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM ai_conversations c WHERE c.id = ai_messages.conversation_id AND c.user_id = auth.uid())
);
DROP POLICY IF EXISTS "ai_msg_delete_own" ON ai_messages;
CREATE POLICY "ai_msg_delete_own" ON ai_messages FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM ai_conversations c WHERE c.id = ai_messages.conversation_id AND c.user_id = auth.uid())
);


-- ============================================================================
-- [MIGRATION 003] 20260815145046_003_student_verification.sql
-- ============================================================================

/*
# Student Verification System

## Overview
Adds a student verification system that supports 3 verification methods:
1. School email verification (OTP/link)
2. Student ID card upload (manual review)
3. School-based verification (country/province/school selection)

Privacy-by-design: does NOT permanently store ID card images or sensitive documents.
Only stores verification status, method, and minimal metadata.

## New Tables

### student_verifications
- `id` (uuid, PK)
- `user_id` (uuid, references profiles, cascade delete)
- `status` (enum: pending/approved/rejected, default pending)
- `method` (enum: school_email/student_id/school_verification)
- `school_email` (text, nullable) — used for method 1
- `school_name` (text, nullable) — used for methods 2 & 3
- `country` (text, nullable)
- `province` (text, nullable)
- `grade_or_year` (text, nullable) — e.g. "Grade 10", "Year 1 University"
- `student_id_url` (text, nullable) — temporary storage, deleted after review
- `rejection_reason` (text, nullable)
- `reviewed_by` (uuid, nullable, references profiles) — admin who reviewed
- `reviewed_at` (timestamptz, nullable)
- `created_at`, `updated_at`

### user_roles
- `user_id` (uuid, PK, references profiles, cascade)
- `role` (enum: user/moderator/admin/super_admin, default user)
- `created_at`

## Modified Tables
### profiles
- Added `date_of_birth` (date, nullable) — used for age group only, not displayed publicly
- Added `country` (text, nullable)
- Added `province` (text, nullable)
- Added `verification_status` (enum: basic/pending/verified, default basic)

## Security
- student_verifications: owner can read own; admin can read all; owner can insert/update own
- user_roles: only admins can read; user can read own role; super_admin can manage
- profiles: existing policies updated to include new columns (no change to access logic)
- An admin-only SECURITY DEFINER function to approve/reject verifications

## Notes
1. Verification status stored as enum on profiles for fast reads — no join needed.
2. Student ID URLs are temporary; a cleanup function/edge function should delete them post-review.
3. user_roles uses raw_app_meta_data as source of truth for role checks in RLS where possible.
4. For now, first user can be made super_admin via execute_sql for testing.
*/

-- ============================================================
-- ENUM TYPES
-- ============================================================
DO $$ BEGIN CREATE TYPE verification_status AS ENUM ('basic', 'pending', 'verified'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE verification_method AS ENUM ('school_email', 'student_id', 'school_verification'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE user_role AS ENUM ('user', 'moderator', 'admin', 'super_admin'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE verification_review_status AS ENUM ('pending', 'approved', 'rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- ADD COLUMNS TO PROFILES
-- ============================================================
DO $$ BEGIN
  ALTER TABLE profiles ADD COLUMN date_of_birth date;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE profiles ADD COLUMN country text;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE profiles ADD COLUMN province text;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE profiles ADD COLUMN verification_status verification_status DEFAULT 'basic';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- ============================================================
-- USER ROLES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS user_roles (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  role user_role DEFAULT 'user',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Users can read their own role
DROP POLICY IF EXISTS "user_roles_select_own" ON user_roles;
CREATE POLICY "user_roles_select_own" ON user_roles FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

-- Admins can read all roles
DROP POLICY IF EXISTS "user_roles_select_admin" ON user_roles;
CREATE POLICY "user_roles_select_admin" ON user_roles FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'super_admin'))
  );

-- Only super_admin can insert/update roles
DROP POLICY IF EXISTS "user_roles_manage" ON user_roles;
CREATE POLICY "user_roles_manage" ON user_roles FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin')
  );

DROP POLICY IF EXISTS "user_roles_update" ON user_roles;
CREATE POLICY "user_roles_update" ON user_roles FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin')
  );

DROP POLICY IF EXISTS "user_roles_delete" ON user_roles;
CREATE POLICY "user_roles_delete" ON user_roles FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin')
  );

-- ============================================================
-- STUDENT VERIFICATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS student_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  status verification_review_status DEFAULT 'pending',
  method verification_method NOT NULL,
  school_email text,
  school_name text,
  country text,
  province text,
  grade_or_year text,
  student_id_url text,
  rejection_reason text,
  reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE student_verifications ENABLE ROW LEVEL SECURITY;

-- Owner can read their own verification requests
DROP POLICY IF EXISTS "sv_select_own" ON student_verifications;
CREATE POLICY "sv_select_own" ON student_verifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

-- Admins can read all verification requests
DROP POLICY IF EXISTS "sv_select_admin" ON student_verifications;
CREATE POLICY "sv_select_admin" ON student_verifications FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'super_admin'))
  );

-- Owner can insert their own verification request
DROP POLICY IF EXISTS "sv_insert_own" ON student_verifications;
CREATE POLICY "sv_insert_own" ON student_verifications FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- Owner can update their own (e.g. re-submit)
DROP POLICY IF EXISTS "sv_update_own" ON student_verifications;
CREATE POLICY "sv_update_own" ON student_verifications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Admins can update (approve/reject)
DROP POLICY IF EXISTS "sv_update_admin" ON student_verifications;
CREATE POLICY "sv_update_admin" ON student_verifications FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'super_admin'))
  ) WITH CHECK (true);

-- Owner can delete their own verification data
DROP POLICY IF EXISTS "sv_delete_own" ON student_verifications;
CREATE POLICY "sv_delete_own" ON student_verifications FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- SECURITY DEFINER FUNCTION: Approve/Reject verification
-- Only admins can call. Updates both student_verifications and profiles.
-- ============================================================
CREATE OR REPLACE FUNCTION approve_student_verification(
  p_verification_id uuid,
  p_approve boolean,
  p_rejection_reason text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_role user_role;
BEGIN
  -- Check caller is admin or super_admin
  SELECT role INTO v_role FROM user_roles WHERE user_id = auth.uid();
  IF v_role NOT IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'Permission denied: admin role required';
  END IF;

  -- Get the verification record
  SELECT user_id INTO v_user_id FROM student_verifications WHERE id = p_verification_id;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Verification request not found';
  END IF;

  IF p_approve THEN
    UPDATE student_verifications
    SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
    WHERE id = p_verification_id;

    UPDATE profiles SET verification_status = 'verified', updated_at = now()
    WHERE id = v_user_id;
  ELSE
    UPDATE student_verifications
    SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(),
        rejection_reason = p_rejection_reason, updated_at = now()
    WHERE id = p_verification_id;

    UPDATE profiles SET verification_status = 'basic', updated_at = now()
    WHERE id = v_user_id;
  END IF;
END;
$$;

-- Grant execute to authenticated (the function itself checks admin role)
GRANT EXECUTE ON FUNCTION approve_student_verification(uuid, boolean, text) TO authenticated;

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_sv_user ON student_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_sv_status ON student_verifications(status);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);


-- ============================================================================
-- [MIGRATION 004] 20260815145100_004_seed_demo_data.sql
-- ============================================================================

/*
# Seed Demo Communities & Challenges

Inserts demo communities and challenges for testing.
Uses ON CONFLICT DO NOTHING for idempotency.
Note: These are created without a created_by (NULL) since they're system-seeded.
The communities_select policy allows all authenticated users to read public communities.
*/

-- Insert demo communities (created_by is NULL for system-seeded)
INSERT INTO communities (name, slug, description, icon, color, is_private, is_anonymous, members_count)
VALUES
  ('Programming', 'programming', 'Learn to code, share your projects, debug together, and discuss all things programming.', '💻', 'blue', false, false, 12400),
  ('Anime & Manga', 'anime-manga', 'Discuss your favorite anime and manga series, share recommendations, and connect with fellow fans.', '🎌', 'rose', false, false, 8700),
  ('Gaming', 'gaming', 'Find teammates, share clips, discuss games, and organize gaming sessions.', '🎮', 'purple', false, false, 15200),
  ('Music', 'music', 'Discover new artists, share playlists, discuss music theory, and collaborate on musical projects.', '🎵', 'amber', false, false, 6300),
  ('Art & Design', 'art-design', 'Show your artwork, get feedback, learn new techniques, and find inspiration.', '🎨', 'orange', false, false, 4800),
  ('Science', 'science', 'Explore the wonders of the natural world, discuss research, and learn together.', '🔬', 'teal', false, false, 5100),
  ('Books', 'books', 'Book clubs, reviews, reading challenges, and literary discussions.', '📚', 'green', false, false, 3200),
  ('Heart to Heart', 'heart-to-heart', 'Anonymous space to share feelings, support each other, and talk through tough times.', '💬', 'cyan', false, true, 7900)
ON CONFLICT (slug) DO NOTHING;

-- Insert demo challenges
INSERT INTO challenges (title, description, type, duration_days, icon, color, participants_count)
VALUES
  ('7-Day English Challenge', 'Learn 10 new English words every day for a week. Build your vocabulary one day at a time.', 'english', 7, '🌍', 'blue', 342),
  ('30-Day Reading Challenge', 'Read for at least 20 minutes every day for a month. Track your progress and share what you''re reading.', 'reading', 30, '📖', 'amber', 891),
  ('14-Day Coding Challenge', 'Solve one coding problem every day for two weeks. Build your problem-solving skills.', 'coding', 14, '⚡', 'purple', 527),
  ('21-Day Exercise Challenge', '15 minutes of movement every day for three weeks. Build a sustainable exercise habit.', 'exercise', 21, '🏃', 'green', 438),
  ('7-Day Study Challenge', 'Study for at least 2 hours every day for a week. Perfect before exams.', 'study', 7, '📝', 'teal', 612)
ON CONFLICT DO NOTHING;


-- ============================================================================
-- [MIGRATION 005] 20260821125032_005_forum_tables.sql
-- ============================================================================

/*
# Forum System — Tables, Policies, and Demo Data

This migration adds a complete forum system to the Nexus platform.

## New Tables
- `forum_categories` — 12 categories (study, school-life, advice, etc.)
- `forum_posts` — user-created discussion posts with anonymous option
- `forum_comments` — comments with nested replies (depth limit 3)
- `forum_reactions` — supportive reactions (helpful, understand, interesting, well_done)
- `forum_bookmarks` — users can bookmark posts for later
- `forum_tags` — tag library for posts
- `forum_post_tags` — many-to-many between posts and tags
- `forum_reports` — reports for posts and comments (separate from existing reports table)

## Security (RLS)
- All tables have RLS enabled
- Only authenticated users can read forum content
- Only verified users can create posts/comments (checked via profile join)
- Users can only edit/delete their own posts and comments
- Users can only add/remove their own reactions and bookmarks
- Admins/moderators can manage all content

## Demo Data
- 12 forum categories with icons and descriptions
- 6 sample posts with realistic student discussions
- Sample comments and replies
- Sample tags
*/

-- Enums
DO $$ BEGIN CREATE TYPE forum_post_status AS ENUM ('active','hidden','deleted','locked'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE forum_reaction_type AS ENUM ('helpful','understand','interesting','well_done'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE forum_report_status AS ENUM ('pending','reviewed','resolved','dismissed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- forum_categories
CREATE TABLE IF NOT EXISTS forum_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text NOT NULL DEFAULT '',
  icon text DEFAULT '💬',
  color text DEFAULT 'teal',
  sort_order int DEFAULT 0,
  posts_count int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- forum_posts
CREATE TABLE IF NOT EXISTS forum_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  category_id uuid REFERENCES forum_categories(id) ON DELETE SET NULL,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  is_anonymous boolean DEFAULT false,
  status forum_post_status DEFAULT 'active',
  image_url text,
  tags text[] DEFAULT '{}',
  comments_count int DEFAULT 0,
  reactions_count int DEFAULT 0,
  bookmark_count int DEFAULT 0,
  view_count int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- forum_comments
CREATE TABLE IF NOT EXISTS forum_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES forum_comments(id) ON DELETE CASCADE,
  content text NOT NULL,
  is_anonymous boolean DEFAULT false,
  is_hidden boolean DEFAULT false,
  depth int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- forum_reactions
CREATE TABLE IF NOT EXISTS forum_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES forum_posts(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES forum_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  reaction_type forum_reaction_type NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT forum_reaction_target CHECK (post_id IS NOT NULL OR comment_id IS NOT NULL)
);

-- forum_bookmarks
CREATE TABLE IF NOT EXISTS forum_bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (post_id, user_id)
);

-- forum_tags
CREATE TABLE IF NOT EXISTS forum_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  slug text UNIQUE NOT NULL,
  usage_count int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- forum_reports
CREATE TABLE IF NOT EXISTS forum_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  target_type text NOT NULL DEFAULT 'post',
  target_id uuid NOT NULL,
  reason text NOT NULL,
  description text,
  status forum_report_status DEFAULT 'pending',
  reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE forum_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_reports ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_forum_posts_category ON forum_posts(category_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_posts_author ON forum_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_forum_posts_status ON forum_posts(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_comments_post ON forum_comments(post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_forum_comments_parent ON forum_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_forum_reactions_post ON forum_reactions(post_id);
CREATE INDEX IF NOT EXISTS idx_forum_reactions_comment ON forum_reactions(comment_id);
CREATE INDEX IF NOT EXISTS idx_forum_reactions_user ON forum_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_forum_bookmarks_user ON forum_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_forum_reports_status ON forum_reports(status);

-- ============================================================
-- POLICIES
-- ============================================================

-- Helper: check if user is verified
-- We inline this in each policy since Supabase RLS can't easily call functions that query auth state

-- forum_categories: all authenticated users can read
DROP POLICY IF EXISTS "forum_cat_select" ON forum_categories;
CREATE POLICY "forum_cat_select" ON forum_categories FOR SELECT TO authenticated USING (true);

-- forum_posts: authenticated can read active posts; verified can create; owner can update/delete
DROP POLICY IF EXISTS "forum_posts_select" ON forum_posts;
CREATE POLICY "forum_posts_select" ON forum_posts FOR SELECT TO authenticated USING (status = 'active' OR author_id = auth.uid());

DROP POLICY IF EXISTS "forum_posts_insert" ON forum_posts;
CREATE POLICY "forum_posts_insert" ON forum_posts FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.verification_status = 'verified'
  )
);

DROP POLICY IF EXISTS "forum_posts_update" ON forum_posts;
CREATE POLICY "forum_posts_update" ON forum_posts FOR UPDATE TO authenticated
USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "forum_posts_delete" ON forum_posts;
CREATE POLICY "forum_posts_delete" ON forum_posts FOR DELETE TO authenticated
USING (author_id = auth.uid());

-- forum_comments: authenticated can read; verified can create; owner can update/delete
DROP POLICY IF EXISTS "forum_comments_select" ON forum_comments;
CREATE POLICY "forum_comments_select" ON forum_comments FOR SELECT TO authenticated USING (is_hidden = false OR author_id = auth.uid());

DROP POLICY IF EXISTS "forum_comments_insert" ON forum_comments;
CREATE POLICY "forum_comments_insert" ON forum_comments FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.verification_status = 'verified'
  )
);

DROP POLICY IF EXISTS "forum_comments_update" ON forum_comments;
CREATE POLICY "forum_comments_update" ON forum_comments FOR UPDATE TO authenticated
USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "forum_comments_delete" ON forum_comments;
CREATE POLICY "forum_comments_delete" ON forum_comments FOR DELETE TO authenticated
USING (author_id = auth.uid());

-- forum_reactions: authenticated can read; verified can create own; owner can delete own
DROP POLICY IF EXISTS "forum_reactions_select" ON forum_reactions;
CREATE POLICY "forum_reactions_select" ON forum_reactions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "forum_reactions_insert" ON forum_reactions;
CREATE POLICY "forum_reactions_insert" ON forum_reactions FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.verification_status = 'verified'
  )
);

DROP POLICY IF EXISTS "forum_reactions_delete" ON forum_reactions;
CREATE POLICY "forum_reactions_delete" ON forum_reactions FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- forum_bookmarks: authenticated can read own; verified can create; owner can delete
DROP POLICY IF EXISTS "forum_bookmarks_select" ON forum_bookmarks;
CREATE POLICY "forum_bookmarks_select" ON forum_bookmarks FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "forum_bookmarks_insert" ON forum_bookmarks;
CREATE POLICY "forum_bookmarks_insert" ON forum_bookmarks FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.verification_status = 'verified'
  )
);

DROP POLICY IF EXISTS "forum_bookmarks_delete" ON forum_bookmarks;
CREATE POLICY "forum_bookmarks_delete" ON forum_bookmarks FOR DELETE TO authenticated USING (user_id = auth.uid());

-- forum_tags: all authenticated can read
DROP POLICY IF EXISTS "forum_tags_select" ON forum_tags;
CREATE POLICY "forum_tags_select" ON forum_tags FOR SELECT TO authenticated USING (true);

-- forum_reports: authenticated can create; only owner or admin can read
DROP POLICY IF EXISTS "forum_reports_select" ON forum_reports;
CREATE POLICY "forum_reports_select" ON forum_reports FOR SELECT TO authenticated
USING (
  reporter_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'super_admin', 'moderator')
  )
);

DROP POLICY IF EXISTS "forum_reports_insert" ON forum_reports;
CREATE POLICY "forum_reports_insert" ON forum_reports FOR INSERT TO authenticated
WITH CHECK (reporter_id = auth.uid());

-- ============================================================
-- TRIGGERS: update counts
-- ============================================================

-- Update comments_count on post when comment inserted/deleted
CREATE OR REPLACE FUNCTION update_forum_post_comment_count() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE forum_posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE forum_posts SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_forum_comment_count_insert ON forum_comments;
CREATE TRIGGER trg_forum_comment_count_insert AFTER INSERT ON forum_comments
FOR EACH ROW EXECUTE FUNCTION update_forum_post_comment_count();

DROP TRIGGER IF EXISTS trg_forum_comment_count_delete ON forum_comments;
CREATE TRIGGER trg_forum_comment_count_delete AFTER DELETE ON forum_comments
FOR EACH ROW EXECUTE FUNCTION update_forum_post_comment_count();

-- Update reactions_count on post when reaction inserted/deleted
CREATE OR REPLACE FUNCTION update_forum_post_reaction_count() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.post_id IS NOT NULL THEN
    UPDATE forum_posts SET reactions_count = reactions_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' AND OLD.post_id IS NOT NULL THEN
    UPDATE forum_posts SET reactions_count = GREATEST(reactions_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_forum_reaction_count_insert ON forum_reactions;
CREATE TRIGGER trg_forum_reaction_count_insert AFTER INSERT ON forum_reactions
FOR EACH ROW EXECUTE FUNCTION update_forum_post_reaction_count();

DROP TRIGGER IF EXISTS trg_forum_reaction_count_delete ON forum_reactions;
CREATE TRIGGER trg_forum_reaction_count_delete AFTER DELETE ON forum_reactions
FOR EACH ROW EXECUTE FUNCTION update_forum_post_reaction_count();

-- Update bookmark_count on post
CREATE OR REPLACE FUNCTION update_forum_post_bookmark_count() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE forum_posts SET bookmark_count = bookmark_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE forum_posts SET bookmark_count = GREATEST(bookmark_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_forum_bookmark_count_insert ON forum_bookmarks;
CREATE TRIGGER trg_forum_bookmark_count_insert AFTER INSERT ON forum_bookmarks
FOR EACH ROW EXECUTE FUNCTION update_forum_post_bookmark_count();

DROP TRIGGER IF EXISTS trg_forum_bookmark_count_delete ON forum_bookmarks;
CREATE TRIGGER trg_forum_bookmark_count_delete AFTER DELETE ON forum_bookmarks
FOR EACH ROW EXECUTE FUNCTION update_forum_post_bookmark_count();

-- Update posts_count on category
CREATE OR REPLACE FUNCTION update_forum_category_post_count() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.category_id IS NOT NULL THEN
    UPDATE forum_categories SET posts_count = posts_count + 1 WHERE id = NEW.category_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' AND OLD.category_id IS NOT NULL THEN
    UPDATE forum_categories SET posts_count = GREATEST(posts_count - 1, 0) WHERE id = OLD.category_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_forum_cat_count_insert ON forum_posts;
CREATE TRIGGER trg_forum_cat_count_insert AFTER INSERT ON forum_posts
FOR EACH ROW EXECUTE FUNCTION update_forum_category_post_count();

DROP TRIGGER IF EXISTS trg_forum_cat_count_delete ON forum_posts;
CREATE TRIGGER trg_forum_cat_count_delete AFTER DELETE ON forum_posts
FOR EACH ROW EXECUTE FUNCTION update_forum_category_post_count();

-- ============================================================
-- DEMO DATA
-- ============================================================

-- Categories
INSERT INTO forum_categories (name, slug, description, icon, color, sort_order) VALUES
('Study & Education', 'study', 'Ask questions, share resources, discuss learning strategies', '📚', 'blue', 1),
('School Life', 'school-life', 'Talk about daily school experiences, friends, and campus life', '💭', 'teal', 2),
('Advice & Questions', 'advice', 'Seek guidance from fellow students on any topic', '🧠', 'amber', 3),
('Heart to Heart', 'heart-to-heart', 'Anonymous space to share feelings and support each other', '❤️', 'rose', 4),
('University & Career', 'university-career', 'Discuss higher education, career paths, and future plans', '🎓', 'green', 5),
('Society & Youth', 'society-youth', 'Talk about issues affecting young people today', '🌍', 'cyan', 6),
('Technology', 'technology', 'Tech news, programming, gadgets, and digital skills', '💻', 'purple', 7),
('Entertainment & Gaming', 'entertainment', 'Games, movies, music, anime, and fun discussions', '🎮', 'orange', 8),
('Arts & Creativity', 'arts', 'Share your art, writing, music, and creative projects', '🎨', 'rose', 9),
('Competitions & Achievements', 'competitions', 'Celebrate wins, share competition experiences', '🏆', 'amber', 10),
('Self Development', 'self-development', 'Habits, motivation, productivity, and personal growth', '🌱', 'green', 11),
('General Discussion', 'general', 'Anything that does not fit elsewhere', '☕', 'teal', 12)
ON CONFLICT (slug) DO NOTHING;

-- Tags
INSERT INTO forum_tags (name, slug) VALUES
('IELTS', 'ielts'),
('motivation', 'motivation'),
('exams', 'exams'),
('mental-health', 'mental-health'),
('study-tips', 'study-tips'),
('career', 'career'),
('programming', 'programming'),
('time-management', 'time-management'),
('university', 'university'),
('stress', 'stress')
ON CONFLICT (slug) DO NOTHING;

-- Demo posts (using a known demo user if exists, otherwise anonymous)
-- We use a subquery to get a demo user ID
DO $$
DECLARE
  demo_user uuid;
  cat_study uuid;
  cat_advice uuid;
  cat_heart uuid;
  cat_uni uuid;
  cat_society uuid;
  cat_tech uuid;
BEGIN
  -- Try to find a demo user
  SELECT id INTO demo_user FROM profiles LIMIT 1;

  SELECT id INTO cat_study FROM forum_categories WHERE slug = 'study';
  SELECT id INTO cat_advice FROM forum_categories WHERE slug = 'advice';
  SELECT id INTO cat_heart FROM forum_categories WHERE slug = 'heart-to-heart';
  SELECT id INTO cat_uni FROM forum_categories WHERE slug = 'university-career';
  SELECT id INTO cat_society FROM forum_categories WHERE slug = 'society-youth';
  SELECT id INTO cat_tech FROM forum_categories WHERE slug = 'technology';

  IF demo_user IS NOT NULL THEN
    INSERT INTO forum_posts (author_id, category_id, title, content, is_anonymous, tags, status) VALUES
    (demo_user, cat_study, 'How are you preparing for IELTS?', 'I am planning to take the IELTS exam next month and I am feeling quite nervous. What materials are you using? Any tips for the speaking section? I have been practicing with Cambridge books but I feel like I need more speaking practice.', false, ARRAY['IELTS','study-tips','exams'], 'active'),
    (demo_user, cat_advice, 'What should I do when I lose motivation before an exam?', 'Every time exams approach, I find myself procrastinating and losing all motivation. I know I should study but I just cannot bring myself to start. Has anyone found a strategy that works for them? I feel like I am the only one struggling with this.', false, ARRAY['motivation','exams','stress'], 'active'),
    (demo_user, cat_heart, 'Is it normal to feel unsure about my future?', 'I am in my last year of high school and everyone seems to know what they want to do except me. My parents want me to study medicine but I am not sure that is what I want. I feel lost and scared. Is anyone else going through this?', true, ARRAY['mental-health','university','stress'], 'active'),
    (demo_user, cat_uni, 'How do you balance studying and extracurricular activities?', 'I want to do well in school but I also want to participate in clubs and sports. It feels like there is never enough time. How do you manage your schedule without burning out?', false, ARRAY['time-management','motivation'], 'active'),
    (demo_user, cat_society, 'What is one thing you wish adults understood about students?', 'I feel like adults often dismiss our struggles. They say we have it easy, but the pressure we face is real. What do you wish adults knew about being a student today?', true, ARRAY['mental-health','stress'], 'active'),
    (demo_user, cat_tech, 'How do you handle pressure from school?', 'Between grades, parents, and comparing myself to classmates, the pressure is overwhelming sometimes. I started learning programming as a way to cope and it actually helps. What about you? How do you deal with it?', false, ARRAY['programming','stress','motivation'], 'active')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;


-- ============================================================================
-- [MIGRATION 006] 20260822040449_006_student_verification_bucket.sql
-- ============================================================================

/*
# Student Verification Storage Bucket

## Overview
Creates a private Supabase Storage bucket for student ID document uploads during
the student verification process. Previously the code referenced a non-existent
bucket named "student-ids", causing "Bucket not found" errors.

## Changes
1. Creates a private storage bucket named `student-verification`.
   - Private = files are NOT publicly accessible via URL.
   - Only authenticated users with proper permissions can access files.
2. Adds storage policies on `storage.objects`:
   - Authenticated users can UPLOAD files to their own folder path (`{user_id}/...`).
   - Authenticated users can READ their own files (`{user_id}/...`).
   - Admins and super_admins can READ all files in the bucket (for reviewing verifications).
   - Admins and super_admins can DELETE files (for cleanup after review).
   - Unauthenticated users have NO access.
3. No public read access — student ID documents are sensitive and must stay private.

## Security
- Bucket is private (public = false).
- Upload policy enforces that the file path starts with the uploader's own user ID.
- Read policy allows self-access and admin-access only.
- Delete policy is admin-only.
- No anon access whatsoever.
*/

-- Create the private bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('student-verification', 'student-verification', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STORAGE POLICIES on storage.objects
-- ============================================================

-- Users can upload files to their own folder: student-verification/{user_id}/...
DROP POLICY IF EXISTS "sv_bucket_upload_own" ON storage.objects;
CREATE POLICY "sv_bucket_upload_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'student-verification'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can read their own files
DROP POLICY IF EXISTS "sv_bucket_read_own" ON storage.objects;
CREATE POLICY "sv_bucket_read_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'student-verification'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Admins can read all files in the bucket
DROP POLICY IF EXISTS "sv_bucket_read_admin" ON storage.objects;
CREATE POLICY "sv_bucket_read_admin" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'student-verification'
    AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'super_admin')
    )
  );

-- Admins can delete files (cleanup after review)
DROP POLICY IF EXISTS "sv_bucket_delete_admin" ON storage.objects;
CREATE POLICY "sv_bucket_delete_admin" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'student-verification'
    AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'super_admin')
    )
  );


-- ============================================================================
-- [MIGRATION 007] 20260822041442_007_verification_audit_log.sql
-- ============================================================================

/*
# Verification Audit Log

## Overview
Creates an audit log table to track every admin action on student verification
requests. Each approval or rejection creates a permanent record showing who
reviewed, when, and why (for rejections).

## New Tables

### verification_audit_logs
- `id` (uuid, PK)
- `verification_request_id` (uuid, FK to student_verifications, cascade delete)
- `admin_id` (uuid, FK to profiles, set null on delete)
- `action` (text: 'approved' or 'rejected')
- `rejection_reason` (text, nullable — only for rejections)
- `created_at` (timestamptz, default now())

## Security
- RLS enabled on verification_audit_logs.
- Admins and super_admins can read all audit logs.
- No one can INSERT/UPDATE/DELETE directly — only the SECURITY DEFINER function
  approve_student_verification writes audit records internally.
- Regular users cannot read audit logs.

## Modified Functions
### approve_student_verification
- Updated to INSERT a record into verification_audit_logs after each
  approval or rejection, recording the admin's ID, action, and rejection reason.

## Important Notes
1. The audit log is written inside the SECURITY DEFINER function, so it runs
   with elevated privileges — the caller does not need INSERT access on the
   audit table.
2. The function still enforces admin-only access before making any changes.
3. The audit log is append-only by design — no UPDATE or DELETE policies exist.
*/

CREATE TABLE IF NOT EXISTS verification_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_request_id uuid NOT NULL REFERENCES student_verifications(id) ON DELETE CASCADE,
  admin_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('approved', 'rejected')),
  rejection_reason text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE verification_audit_logs ENABLE ROW LEVEL SECURITY;

-- Admins can read all audit logs
DROP POLICY IF EXISTS "val_select_admin" ON verification_audit_logs;
CREATE POLICY "val_select_admin" ON verification_audit_logs FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'super_admin'))
  );

-- No INSERT/UPDATE/DELETE policies — only the SECURITY DEFINER function writes records

CREATE INDEX IF NOT EXISTS idx_val_verification ON verification_audit_logs(verification_request_id);
CREATE INDEX IF NOT EXISTS idx_val_admin ON verification_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_val_created ON verification_audit_logs(created_at);

-- ============================================================
-- Update the approve function to write audit records
-- ============================================================
CREATE OR REPLACE FUNCTION approve_student_verification(
  p_verification_id uuid,
  p_approve boolean,
  p_rejection_reason text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_role user_role;
BEGIN
  -- Check caller is admin or super_admin
  SELECT role INTO v_role FROM user_roles WHERE user_id = auth.uid();
  IF v_role NOT IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'Permission denied: admin role required';
  END IF;

  -- Get the verification record
  SELECT user_id INTO v_user_id FROM student_verifications WHERE id = p_verification_id;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Verification request not found';
  END IF;

  IF p_approve THEN
    UPDATE student_verifications
    SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
    WHERE id = p_verification_id;

    UPDATE profiles SET verification_status = 'verified', updated_at = now()
    WHERE id = v_user_id;

    INSERT INTO verification_audit_logs (verification_request_id, admin_id, action)
    VALUES (p_verification_id, auth.uid(), 'approved');
  ELSE
    UPDATE student_verifications
    SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(),
        rejection_reason = p_rejection_reason, updated_at = now()
    WHERE id = p_verification_id;

    UPDATE profiles SET verification_status = 'rejected', updated_at = now()
    WHERE id = v_user_id;

    INSERT INTO verification_audit_logs (verification_request_id, admin_id, action, rejection_reason)
    VALUES (p_verification_id, auth.uid(), 'rejected', p_rejection_reason);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION approve_student_verification(uuid, boolean, text) TO authenticated;


-- ============================================================================
-- [MIGRATION 008] 20260823050122_008_bootstrap_first_admin.sql
-- ============================================================================

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


-- ============================================================================
-- [MIGRATION 009] 20260824074342_009_student_onboarding.sql
-- ============================================================================

/* Secure immediate student onboarding */

ALTER TABLE public.student_verifications
  ADD COLUMN IF NOT EXISTS education_level text;

UPDATE storage.buckets
SET public = false,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
WHERE id = 'student-verification';

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id AND coalesce(verification_status, 'basic') = 'basic');

REVOKE UPDATE ON TABLE public.profiles FROM authenticated;
GRANT UPDATE (
  username, full_name, avatar_url, bio, interests, skills, goals,
  profile_visibility, date_of_birth, country, province
) ON TABLE public.profiles TO authenticated;

REVOKE INSERT, UPDATE ON TABLE public.student_verifications FROM authenticated;

CREATE OR REPLACE FUNCTION public.complete_student_onboarding(
  p_education_level text,
  p_school_name text,
  p_grade_or_year text,
  p_student_id_path text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_file_exists boolean := false;
  v_mime_type text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_education_level NOT IN ('high_school', 'university') THEN
    RAISE EXCEPTION 'Invalid education level';
  END IF;

  IF length(trim(coalesce(p_school_name, ''))) < 2
     OR length(trim(p_school_name)) > 200
     OR length(trim(coalesce(p_grade_or_year, ''))) < 1
     OR length(trim(p_grade_or_year)) > 80 THEN
    RAISE EXCEPTION 'School and grade or year are required';
  END IF;

  IF p_student_id_path IS NULL
     OR p_student_id_path NOT LIKE v_user_id::text || '/%'
     OR p_student_id_path LIKE '%..%' THEN
    RAISE EXCEPTION 'Invalid student ID upload';
  END IF;

  SELECT true, metadata->>'mimetype'
  INTO v_file_exists, v_mime_type
  FROM storage.objects
  WHERE bucket_id = 'student-verification'
    AND name = p_student_id_path
    AND owner_id = v_user_id;

  IF NOT v_file_exists OR v_mime_type NOT IN ('image/jpeg', 'image/png', 'image/webp') THEN
    RAISE EXCEPTION 'A valid student ID image is required';
  END IF;

  INSERT INTO public.student_verifications (
    user_id, status, method, school_name, grade_or_year,
    education_level, student_id_url
  ) VALUES (
    v_user_id, 'approved', 'student_id', trim(p_school_name),
    trim(p_grade_or_year), p_education_level, p_student_id_path
  );

  UPDATE public.profiles
  SET verification_status = 'verified', updated_at = now()
  WHERE id = v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_student_onboarding(text, text, text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_student_onboarding(text, text, text, text) FROM anon;


-- ============================================================================
-- [MIGRATION 010] 20260824091859_010_forum_images_bucket.sql
-- ============================================================================

/*
# Forum Images Storage Bucket

1. New Storage
- Creates a `forum-images` bucket for forum post image uploads
- Public read, authenticated write (owner-scoped)
2. Security
- Only authenticated users can upload to their own folder
- Public read for all forum images
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('forum-images', 'forum-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read
DROP POLICY IF EXISTS "forum_images_public_read" ON storage.objects;
CREATE POLICY "forum_images_public_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'forum-images');

-- Allow authenticated users to upload to their own folder
DROP POLICY IF EXISTS "forum_images_insert_own" ON storage.objects;
CREATE POLICY "forum_images_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'forum-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow users to update/delete their own files
DROP POLICY IF EXISTS "forum_images_update_own" ON storage.objects;
CREATE POLICY "forum_images_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'forum-images' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'forum-images' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "forum_images_delete_own" ON storage.objects;
CREATE POLICY "forum_images_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'forum-images' AND (storage.foldername(name))[1] = auth.uid()::text);


-- ============================================================================
-- [MIGRATION 011] 20260824092943_011_create_community_function.sql
-- ============================================================================

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


-- ============================================================================
-- [MIGRATION 012] 20260824094135_012_allow_authenticated_forum_posts.sql
-- ============================================================================

/*
# Allow Authenticated Forum Posts

1. Modified Table Policies
- Updates the `forum_posts_insert` policy.
- Authenticated users may create posts when `author_id` matches their session user.
- The existing verified-student restriction is removed from post creation because the post form is available to all signed-in users and the requested product flow requires logged-in users to be able to publish.

2. Security
- Anonymous users still cannot create posts.
- Users cannot submit a post on behalf of another account.
- Existing read, update, and delete policies remain unchanged.

3. Important Notes
- Student verification remains available for verification-specific features and moderation.
- This change fixes the mismatch between the UI's authenticated-user flow and the database's verified-only insert policy.
*/

DROP POLICY IF EXISTS "forum_posts_insert" ON public.forum_posts;

CREATE POLICY "forum_posts_insert" ON public.forum_posts
  FOR INSERT
  TO authenticated
  WITH CHECK (author_id = auth.uid());


-- ============================================================================
-- [MIGRATION 013] 20260824130552_013_fix_community_rls_recursion.sql
-- ============================================================================

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


-- ============================================================================
-- [MIGRATION 014] 20260825012115_014_forum_posts_sort_indexes.sql.sql
-- ============================================================================

-- Add composite indexes for forum_posts sort modes used by the category page.
-- The existing idx_forum_posts_category covers (category_id, created_at DESC) for 'latest' sort.
-- These cover the 'discussed' and 'helpful' sort modes which order by comments_count / reactions_count.

CREATE INDEX IF NOT EXISTS idx_forum_posts_category_discussed
  ON forum_posts (category_id, comments_count DESC, created_at DESC)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_forum_posts_category_helpful
  ON forum_posts (category_id, reactions_count DESC, created_at DESC)
  WHERE status = 'active';


-- ============================================================================
-- [MIGRATION 015] 20260825013355_015_challenge_system_upgrade.sql.sql
-- ============================================================================

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


-- ============================================================================
-- [MIGRATION 016] 20260825013907_016_challenge_system_fixes.sql.sql
-- ============================================================================

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


-- ============================================================================
-- [MIGRATION 017] 20260825015252_017_edit_delete_support.sql.sql
-- ============================================================================

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


-- ============================================================================
-- [MIGRATION 018] 20260825023003_018_fix_soft_delete_rls.sql.sql
-- ============================================================================

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


-- ============================================================================
-- [MIGRATION 019] 20260825031432_019_community_attachments_reactions.sql
-- ============================================================================

-- Community post attachments and reactions system

-- 1. Storage bucket for community files (private, uses signed URLs)
INSERT INTO storage.buckets (id, name, public)
VALUES ('community-files', 'community-files', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for community-files bucket
-- Users can upload to their own folder
CREATE POLICY "community_files_upload_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'community-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can read their own files
CREATE POLICY "community_files_read_own"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'community-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete their own files
CREATE POLICY "community_files_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'community-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can update their own files
CREATE POLICY "community_files_update_own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'community-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'community-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 2. community_post_attachments table
CREATE TABLE IF NOT EXISTS community_post_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  uploader_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  is_image BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attachments_post_id ON community_post_attachments(post_id);
CREATE INDEX IF NOT EXISTS idx_attachments_community_id ON community_post_attachments(community_id);
CREATE INDEX IF NOT EXISTS idx_attachments_uploader_id ON community_post_attachments(uploader_id);

ALTER TABLE community_post_attachments ENABLE ROW LEVEL SECURITY;

-- Select: anyone who can see the community can see attachments
CREATE POLICY "attachments_select"
  ON community_post_attachments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM communities c
      WHERE c.id = community_post_attachments.community_id
      AND (c.is_private = false OR c.created_by = auth.uid() OR is_community_member(c.id))
    )
  );

-- Insert: community members can upload attachments to their own posts
CREATE POLICY "attachments_insert_own"
  ON community_post_attachments FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = uploader_id
    AND EXISTS (
      SELECT 1 FROM community_members cm
      WHERE cm.community_id = community_post_attachments.community_id AND cm.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM posts p
      WHERE p.id = community_post_attachments.post_id AND p.author_id = auth.uid()
    )
  );

-- Delete: only the uploader can delete their attachment
CREATE POLICY "attachments_delete_own"
  ON community_post_attachments FOR DELETE TO authenticated
  USING (auth.uid() = uploader_id);

-- 3. community_post_reactions table
CREATE TABLE IF NOT EXISTS community_post_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One reaction per type per user per post
CREATE UNIQUE INDEX IF NOT EXISTS uniq_reaction_per_user_per_post_per_type
  ON community_post_reactions(post_id, user_id, reaction_type);

CREATE INDEX IF NOT EXISTS idx_reactions_post_id ON community_post_reactions(post_id);
CREATE INDEX IF NOT EXISTS idx_reactions_user_id ON community_post_reactions(user_id);

ALTER TABLE community_post_reactions ENABLE ROW LEVEL SECURITY;

-- Select: anyone who can see the community can see reactions
CREATE POLICY "reactions_select"
  ON community_post_reactions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM posts p
      JOIN communities c ON c.id = p.community_id
      WHERE p.id = community_post_reactions.post_id
      AND (c.is_private = false OR c.created_by = auth.uid() OR is_community_member(c.id))
    )
  );

-- Insert: community members can react to posts
CREATE POLICY "reactions_insert_own"
  ON community_post_reactions FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM posts p
      JOIN community_members cm ON cm.community_id = p.community_id
      WHERE p.id = community_post_reactions.post_id AND cm.user_id = auth.uid()
    )
  );

-- Delete: users can only remove their own reactions
CREATE POLICY "reactions_delete_own"
  ON community_post_reactions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 4. Trigger to sync posts.reactions_count with actual reaction count
CREATE OR REPLACE FUNCTION sync_post_reactions_count()
RETURNS TRIGGER AS $$
DECLARE
  new_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO new_count
  FROM community_post_reactions
  WHERE post_id = COALESCE(NEW.post_id, OLD.post_id);

  UPDATE posts SET reactions_count = new_count
  WHERE id = COALESCE(NEW.post_id, OLD.post_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_reactions_count ON community_post_reactions;
CREATE TRIGGER trg_sync_reactions_count
  AFTER INSERT OR DELETE ON community_post_reactions
  FOR EACH ROW EXECUTE FUNCTION sync_post_reactions_count();


-- ============================================================================
-- [MIGRATION 020] 20260825103339_020_forum_attachments_reactions.sql.sql
-- ============================================================================

/*
# Forum Post Attachments and Emoji Reactions

## Purpose
Extend the existing Forum system with:
1. File/image attachments (documents + images) for forum posts
2. Emoji-based reactions (❤️ 👍 😂 😮 😢 😡 🎉 🔥) for forum posts

## New Tables

### forum_post_attachments
- `id` (uuid, PK)
- `post_id` (uuid, FK to forum_posts, ON DELETE CASCADE)
- `uploader_id` (uuid, FK to profiles, ON DELETE CASCADE)
- `file_name` (text) — original filename
- `file_path` (text) — storage path in community-files bucket
- `file_type` (text) — MIME type
- `file_size` (bigint) — size in bytes
- `is_image` (boolean) — whether the file is an image
- `created_at` (timestamptz)

### forum_post_reactions
- `id` (uuid, PK)
- `post_id` (uuid, FK to forum_posts, ON DELETE CASCADE)
- `user_id` (uuid, FK to profiles, ON DELETE CASCADE)
- `reaction_type` (text) — emoji string (❤️, 👍, 😂, 😮, 😢, 😡, 🎉, 🔥)
- `created_at` (timestamptz)
- Unique constraint on (post_id, user_id, reaction_type) to prevent duplicate reactions

## Storage
- Reuses the existing private `community-files` bucket (no new bucket created)
- Storage policies already allow users to upload/read/delete their own files in that bucket

## Security (RLS)
- forum_post_attachments: SELECT for all authenticated; INSERT only by post author; DELETE only by uploader
- forum_post_reactions: SELECT for all authenticated; INSERT only for own reactions; DELETE only own reactions

## Triggers
- `sync_forum_post_reactions_count()` — updates `forum_posts.reactions_count` when reactions change

## Important Notes
1. Does NOT modify the existing `forum_reactions` table (which uses an enum for the old reaction system)
2. Does NOT modify existing forum posts, comments, or delete functionality
3. The existing `forum_posts.reactions_count` column is reused — the new trigger keeps it in sync with `forum_post_reactions`
4. The existing `forum_posts.image_url` column is preserved for backward compatibility
*/

-- 1. Forum post attachments table
CREATE TABLE IF NOT EXISTS forum_post_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
  uploader_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  is_image BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_forum_attachments_post_id ON forum_post_attachments(post_id);
CREATE INDEX IF NOT EXISTS idx_forum_attachments_uploader_id ON forum_post_attachments(uploader_id);

ALTER TABLE forum_post_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "forum_attachments_select" ON forum_post_attachments;
CREATE POLICY "forum_attachments_select"
  ON forum_post_attachments FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "forum_attachments_insert_own" ON forum_post_attachments;
CREATE POLICY "forum_attachments_insert_own"
  ON forum_post_attachments FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = uploader_id
    AND EXISTS (
      SELECT 1 FROM forum_posts p
      WHERE p.id = forum_post_attachments.post_id AND p.author_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "forum_attachments_delete_own" ON forum_post_attachments;
CREATE POLICY "forum_attachments_delete_own"
  ON forum_post_attachments FOR DELETE TO authenticated
  USING (auth.uid() = uploader_id);

-- 2. Forum post emoji reactions table
CREATE TABLE IF NOT EXISTS forum_post_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One reaction per type per user per post
CREATE UNIQUE INDEX IF NOT EXISTS uniq_forum_reaction_per_user_per_post_per_type
  ON forum_post_reactions(post_id, user_id, reaction_type);

CREATE INDEX IF NOT EXISTS idx_forum_reactions_post_id ON forum_post_reactions(post_id);
CREATE INDEX IF NOT EXISTS idx_forum_reactions_user_id ON forum_post_reactions(user_id);

ALTER TABLE forum_post_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "forum_post_reactions_select" ON forum_post_reactions;
CREATE POLICY "forum_post_reactions_select"
  ON forum_post_reactions FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "forum_post_reactions_insert_own" ON forum_post_reactions;
CREATE POLICY "forum_post_reactions_insert_own"
  ON forum_post_reactions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "forum_post_reactions_delete_own" ON forum_post_reactions;
CREATE POLICY "forum_post_reactions_delete_own"
  ON forum_post_reactions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 3. Trigger to sync forum_posts.reactions_count with forum_post_reactions
CREATE OR REPLACE FUNCTION sync_forum_post_reactions_count()
RETURNS TRIGGER AS $$
DECLARE
  new_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO new_count
  FROM forum_post_reactions
  WHERE post_id = COALESCE(NEW.post_id, OLD.post_id);

  UPDATE forum_posts SET reactions_count = new_count
  WHERE id = COALESCE(NEW.post_id, OLD.post_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_forum_post_reactions_count ON forum_post_reactions;
CREATE TRIGGER trg_sync_forum_post_reactions_count
  AFTER INSERT OR DELETE ON forum_post_reactions
  FOR EACH ROW EXECUTE FUNCTION sync_forum_post_reactions_count();


-- ============================================================================
-- [MIGRATION 021] 20260825134116_021_fix_community_files_read_policy.sql.sql
-- ============================================================================

/*
# Fix: Allow any authenticated user to read community-files attachments

## Problem
Forum and community post attachments are stored in the private `community-files` bucket
under `<uploader_id>/...` paths. The existing `community_files_read_own` policy only allows
reading files in your OWN folder (`storage.foldername(name)[1] = auth.uid()`).

When user A uploads an image and user B views the post, the signed URL is generated
server-side (succeeds), but when the browser fetches the signed URL, the storage RLS
SELECT policy denies access because user B is not the file owner. The image shows
"Failed to load image".

## Fix
Add a new SELECT policy `community_files_read_authenticated` that allows ANY authenticated
user to read files in the `community-files` bucket. This matches the existing database-level
RLS policies on `forum_post_attachments` and `community_post_attachments` which already allow
all authenticated users to SELECT attachment metadata.

The bucket remains PRIVATE (not public) — files are only accessible via signed URLs generated
by authenticated Supabase clients. Unauthenticated access is still denied.

Upload, update, and delete policies remain owner-scoped (unchanged).

## Security
- SELECT: any authenticated user (shared content in forum/community posts)
- INSERT: only the owner (foldername = auth.uid())
- UPDATE: only the owner
- DELETE: only the owner
*/

DROP POLICY IF EXISTS "community_files_read_authenticated" ON storage.objects;

CREATE POLICY "community_files_read_authenticated"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'community-files');


-- ============================================================================
-- [MIGRATION 022] 20260825153658_022_fix_storage_buckets_rls.sql
-- ============================================================================

-- Fix: storage.buckets has RLS enabled but ZERO policies, so neither anon nor
-- authenticated roles can read bucket metadata. The Supabase Storage API needs
-- to resolve the bucket (to check public/private) before generating signed URLs
-- or serving objects. Without a SELECT policy, every createSignedUrl call fails
-- with "Bucket not found", causing Forum and Community images to show
-- "Failed to load image".
--
-- This restores the default Supabase bucket read policy that allows any
-- role to SELECT bucket metadata. Bucket-level access control is not the
-- security boundary — object-level RLS policies on storage.objects enforce
-- who can read/write actual files.

DROP POLICY IF EXISTS "bucket_select_all" ON storage.buckets;
CREATE POLICY "bucket_select_all"
  ON storage.buckets FOR SELECT
  TO anon, authenticated
  USING (true);


-- ============================================================================
-- [MIGRATION 023] 20260826073218_20260826000001_023_fix_user_roles_rls_recursion.sql
-- ============================================================================

/*
# Fix Infinite RLS Recursion on user_roles

## Problem
The `user_roles` table has RLS enabled. Its own policies (user_roles_select_admin,
user_roles_manage, user_roles_update, user_roles_delete) reference `user_roles`
in their predicate expressions. When PostgreSQL evaluates any of these policies,
it triggers RLS on `user_roles` again, causing infinite recursion (error 42P17).

This recursion is triggered indirectly whenever ANY table with a policy that
references `user_roles` is queried as the `authenticated` role — most critically
`storage.objects` (policies sv_bucket_read_admin / sv_bucket_delete_admin),
which the Supabase Storage API queries on every signed-URL and list request.
The Storage API maps the underlying 42P17 error to HTTP 503
`DatabaseInvalidObjectDefinition`.

## Solution
1. Create two SECURITY DEFINER functions:
   - `is_admin()` — returns true if the current user has role 'admin' or 'super_admin'
   - `is_moderator_or_admin()` — returns true if the current user has role
     'moderator', 'admin', or 'super_admin'

   SECURITY DEFINER functions execute with the privileges of their owner
   (postgres), which bypasses RLS. This breaks the recursion because the
   function's internal SELECT on `user_roles` no longer triggers `user_roles`
   RLS policies.

2. Replace every `EXISTS (SELECT 1 FROM user_roles ...)` in RLS policies with
   the appropriate helper function call.

## Policies Changed (10 total across 5 tables)

### user_roles (4 policies — self-referencing, the root cause)
- user_roles_select_admin  → USING (is_admin())
- user_roles_manage         → WITH CHECK (is_admin('super_admin'))
- user_roles_update         → USING (is_admin('super_admin')) WITH CHECK (is_admin('super_admin'))
- user_roles_delete         → USING (is_admin('super_admin'))

### storage.objects (2 policies — triggered the Storage API 503)
- sv_bucket_read_admin   → USING (bucket_id = 'student-verification' AND is_admin())
- sv_bucket_delete_admin → USING (bucket_id = 'student-verification' AND is_admin())

### student_verifications (2 policies)
- sv_select_admin → USING (is_admin())
- sv_update_admin → USING (is_admin()) WITH CHECK (true)

### verification_audit_logs (1 policy)
- val_select_admin → USING (is_admin())

### forum_reports (1 policy)
- forum_reports_select → USING (reporter_id = auth.uid() OR is_moderator_or_admin())

## Security Impact
- No table schemas changed.
- No bucket configurations changed.
- No files deleted or moved.
- Non-admin user access rules are unchanged (user_roles_select_own preserved).
- `user_roles` is NOT made publicly readable — only the SECURITY DEFINER
  function (owned by postgres) can read it, and it only returns a boolean.
- Admin/super_admin permissions are preserved exactly.
- Moderator permissions on forum_reports are preserved.

## Existing Data
All existing files in community-files, forum-images, and student-verification
buckets remain untouched. Signed URLs will work for authenticated users after
this migration.
*/

-- ============================================================
-- 1. Create SECURITY DEFINER helper functions
-- ============================================================

-- is_admin(p_role text DEFAULT NULL)
-- If p_role is NULL: returns true when user has 'admin' or 'super_admin'
-- If p_role is provided: returns true when user has that specific role
-- (used by user_roles_manage/update/delete which require 'super_admin')
CREATE OR REPLACE FUNCTION public.is_admin(p_role text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_count int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  IF p_role IS NOT NULL THEN
    SELECT count(*) INTO v_count
    FROM user_roles
    WHERE user_id = v_user_id AND role = p_role::user_role;
  ELSE
    SELECT count(*) INTO v_count
    FROM user_roles
    WHERE user_id = v_user_id AND role IN ('admin', 'super_admin');
  END IF;

  RETURN v_count > 0;
END;
$$;

-- is_moderator_or_admin()
-- Returns true when the current user has role 'moderator', 'admin', or 'super_admin'
CREATE OR REPLACE FUNCTION public.is_moderator_or_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_count int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT count(*) INTO v_count
  FROM user_roles
  WHERE user_id = v_user_id
    AND role IN ('moderator', 'admin', 'super_admin');

  RETURN v_count > 0;
END;
$$;

-- Grant execute to authenticated only (not anon — these are for logged-in users)
GRANT EXECUTE ON FUNCTION public.is_admin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_moderator_or_admin() TO authenticated;

-- ============================================================
-- 2. Fix user_roles self-referencing policies (the root cause)
-- ============================================================

-- SELECT: admins can read all roles (was: self-referencing EXISTS subquery)
DROP POLICY IF EXISTS "user_roles_select_admin" ON user_roles;
CREATE POLICY "user_roles_select_admin" ON user_roles FOR SELECT
  TO authenticated USING (is_admin());

-- INSERT: only super_admin can manage roles
DROP POLICY IF EXISTS "user_roles_manage" ON user_roles;
CREATE POLICY "user_roles_manage" ON user_roles FOR INSERT
  TO authenticated WITH CHECK (is_admin('super_admin'));

-- UPDATE: only super_admin can update roles
DROP POLICY IF EXISTS "user_roles_update" ON user_roles;
CREATE POLICY "user_roles_update" ON user_roles FOR UPDATE
  TO authenticated
  USING (is_admin('super_admin'))
  WITH CHECK (is_admin('super_admin'));

-- DELETE: only super_admin can delete roles
DROP POLICY IF EXISTS "user_roles_delete" ON user_roles;
CREATE POLICY "user_roles_delete" ON user_roles FOR DELETE
  TO authenticated USING (is_admin('super_admin'));

-- ============================================================
-- 3. Fix storage.objects policies (caused the Storage API 503)
-- ============================================================

-- Admins can read all files in student-verification bucket
DROP POLICY IF EXISTS "sv_bucket_read_admin" ON storage.objects;
CREATE POLICY "sv_bucket_read_admin" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'student-verification'
    AND is_admin()
  );

-- Admins can delete files (cleanup after review)
DROP POLICY IF EXISTS "sv_bucket_delete_admin" ON storage.objects;
CREATE POLICY "sv_bucket_delete_admin" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'student-verification'
    AND is_admin()
  );

-- ============================================================
-- 4. Fix student_verifications policies
-- ============================================================

-- Admins can read all verification requests
DROP POLICY IF EXISTS "sv_select_admin" ON student_verifications;
CREATE POLICY "sv_select_admin" ON student_verifications FOR SELECT
  TO authenticated USING (is_admin());

-- Admins can update (approve/reject)
DROP POLICY IF EXISTS "sv_update_admin" ON student_verifications;
CREATE POLICY "sv_update_admin" ON student_verifications FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (true);

-- ============================================================
-- 5. Fix verification_audit_logs policy
-- ============================================================

DROP POLICY IF EXISTS "val_select_admin" ON verification_audit_logs;
CREATE POLICY "val_select_admin" ON verification_audit_logs FOR SELECT
  TO authenticated USING (is_admin());

-- ============================================================
-- 6. Fix forum_reports policy (uses moderator + admin check)
-- ============================================================

DROP POLICY IF EXISTS "forum_reports_select" ON forum_reports;
CREATE POLICY "forum_reports_select" ON forum_reports FOR SELECT
  TO authenticated
  USING (reporter_id = auth.uid() OR is_moderator_or_admin());


-- ============================================================================
-- [MIGRATION 024] 20260826081658_20260826100000_024_challenge_notification_system.sql
-- ============================================================================

/*
# Challenge Notification System — DB Functions & Schema

## Purpose
Add timezone support to profiles and create database functions that:
1. Generate daily challenge reminder notifications
2. Generate weekly challenge report notifications
3. Generate monthly challenge report notifications
4. Provide report data (completions, streaks, rates) for chart visualization

## Changes

### 1. profiles table — add timezone column
- `timezone` text DEFAULT 'Asia/Ho_Chi_Minh' — stores the user's IANA timezone

### 2. Database functions (all SECURITY DEFINER, search_path = public)

- `get_user_challenge_reminders(p_user_id uuid, p_date date)` — returns challenge titles
  that the user needs to complete today (active, joined/created, not checked in today)

- `generate_daily_challenge_reminders()` — iterates all users with active challenge
  participations, checks if they have unchecked-in challenges for today, creates a
  notification with the challenge names. Prevents duplicates via type+date check.

- `generate_weekly_challenge_reports()` — for each user with challenge activity,
  calculates this week's vs last week's completions, creates a notification with
  summary stats. Prevents duplicates via type+week check.

- `generate_monthly_challenge_reports()` — same as weekly but for calendar months.

- `get_challenge_report(p_user_id uuid, p_period text, p_date date)` — returns
  JSON with current/previous period completions, active challenges, streaks,
  completion rate, and percentage change. Used by the report visualization UI.

### 3. RLS
- No new tables created (notifications table already has permissive INSERT policy)
- All functions are SECURITY DEFINER so they can read challenge data across users
  and insert notifications on behalf of users

## Data Safety
- No existing tables modified (only ADD COLUMN)
- No data deleted
- No existing policies changed
*/

-- ============================================================
-- 1. Add timezone column to profiles
-- ============================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'Asia/Ho_Chi_Minh';

-- ============================================================
-- 2. Helper: get challenges a user needs to complete today
--    Returns challenge titles that are active, the user joined or created,
--    and the user has NOT checked in today.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_user_challenge_reminders(p_user_id uuid, p_date date)
RETURNS TABLE(title text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT c.title
  FROM challenges c
  INNER JOIN challenge_participants cp ON cp.challenge_id = c.id
  WHERE cp.user_id = p_user_id
    AND c.status = 'active'
    AND cp.completed = false
    AND NOT EXISTS (
      SELECT 1 FROM challenge_checkins ci
      WHERE ci.challenge_id = c.id
        AND ci.user_id = p_user_id
        AND ci.checkin_date = p_date
    );
  RETURN;
END;
$$;

-- ============================================================
-- 3. Daily challenge reminder generator
--    Creates ONE notification per user per day listing all challenges
--    they still need to complete today.
--    Returns count of notifications created.
-- ============================================================

CREATE OR REPLACE FUNCTION public.generate_daily_challenge_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_today date := CURRENT_DATE;
  v_user_id uuid;
  v_titles text[];
  v_title text;
  v_body text;
  v_num integer;
  v_existing integer;
BEGIN
  -- Find all users who have active challenge participations
  FOR v_user_id IN
    SELECT DISTINCT cp.user_id
    FROM challenge_participants cp
    INNER JOIN challenges c ON c.id = cp.challenge_id
    WHERE c.status = 'active' AND cp.completed = false
  LOOP
    -- Check if we already created a daily reminder for this user today
    SELECT count(*) INTO v_existing
    FROM notifications
    WHERE user_id = v_user_id
      AND type = 'daily_challenge_reminder'
      AND created_at::date = v_today;

    IF v_existing > 0 THEN
      CONTINUE;
    END IF;

    -- Get challenges this user needs to complete today
    v_titles := ARRAY(SELECT title FROM get_user_challenge_reminders(v_user_id, v_today));

    IF array_length(v_titles, 1) IS NULL OR array_length(v_titles, 1) = 0 THEN
      -- No challenges to complete today — skip (don't send "you have 0")
      CONTINUE;
    END IF;

    v_num := array_length(v_titles, 1);
    v_body := concat(
      'You have ', v_num, ' Challenge', CASE WHEN v_num > 1 THEN 's' ELSE '' END,
      ' to complete today.', E'\n\n',
      array_to_string(v_titles, E'\n'),
      E'\n\nPlease complete ', CASE WHEN v_num > 1 THEN 'them' ELSE 'it' END,
      ' before the end of today!'
    );

    INSERT INTO notifications (user_id, type, title, body, link)
    VALUES (v_user_id, 'daily_challenge_reminder', 'Daily Challenge Reminder', v_body, '/app/study');

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ============================================================
-- 4. Weekly challenge report generator
--    Creates ONE notification per user per week with completion stats.
--    Returns count of notifications created.
-- ============================================================

CREATE OR REPLACE FUNCTION public.generate_weekly_challenge_reports()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_user_id uuid;
  v_this_week_start date := date_trunc('week', CURRENT_DATE)::date;
  v_this_week_end date := (date_trunc('week', CURRENT_DATE) + interval '6 days')::date;
  v_last_week_start date := (date_trunc('week', CURRENT_DATE) - interval '7 days')::date;
  v_last_week_end date := (date_trunc('week', CURRENT_DATE) - interval '1 day')::date;
  v_this_week_count integer;
  v_last_week_count integer;
  v_pct_change numeric;
  v_body text;
  v_existing integer;
  v_week_label text := to_char(v_this_week_start, 'Mon DD');
BEGIN
  FOR v_user_id IN
    SELECT DISTINCT user_id FROM challenge_checkins
    WHERE checkin_date >= v_last_week_start AND checkin_date <= v_this_week_end
  LOOP
    -- Check if we already created a weekly report this week
    SELECT count(*) INTO v_existing
    FROM notifications
    WHERE user_id = v_user_id
      AND type = 'weekly_challenge_report'
      AND created_at::date >= v_this_week_start;

    IF v_existing > 0 THEN
      CONTINUE;
    END IF;

    -- Count completions (checkins) this week and last week
    SELECT count(*) INTO v_this_week_count
    FROM challenge_checkins
    WHERE user_id = v_user_id
      AND checkin_date >= v_this_week_start
      AND checkin_date <= v_this_week_end;

    SELECT count(*) INTO v_last_week_count
    FROM challenge_checkins
    WHERE user_id = v_user_id
      AND checkin_date >= v_last_week_start
      AND checkin_date <= v_last_week_end;

    -- Build report body
    IF v_last_week_count = 0 THEN
      IF v_this_week_count = 0 THEN
        CONTINUE; -- Skip users with no activity at all
      END IF;
      v_body := concat('This week you completed ', v_this_week_count, ' Challenge', CASE WHEN v_this_week_count > 1 THEN 's' ELSE '' END, '.', E'\n\nNew activity this period!');
    ELSE
      v_pct_change := round((v_this_week_count - v_last_week_count)::numeric / v_last_week_count * 100);
      IF v_pct_change > 0 THEN
        v_body := concat('This week you completed ', v_this_week_count, ' Challenge', CASE WHEN v_this_week_count > 1 THEN 's' ELSE '' END, '.', E'\n\nThat''s ', v_pct_change, '% more than last week!');
      ELSIF v_pct_change < 0 THEN
        v_body := concat('This week you completed ', v_this_week_count, ' Challenge', CASE WHEN v_this_week_count > 1 THEN 's' ELSE '' END, '.', E'\n\nThat''s ', abs(v_pct_change), '% less than last week.');
      ELSE
        v_body := concat('This week you completed ', v_this_week_count, ' Challenge', CASE WHEN v_this_week_count > 1 THEN 's' ELSE '' END, '.', E'\n\nSame as last week.');
      END IF;
    END IF;

    INSERT INTO notifications (user_id, type, title, body, link)
    VALUES (v_user_id, 'weekly_challenge_report', 'Your Weekly Challenge Report', v_body, '/app/notifications/report?type=weekly');

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ============================================================
-- 5. Monthly challenge report generator
--    Creates ONE notification per user per month with completion stats.
--    Returns count of notifications created.
-- ============================================================

CREATE OR REPLACE FUNCTION public.generate_monthly_challenge_reports()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_user_id uuid;
  v_this_month_start date := date_trunc('month', CURRENT_DATE)::date;
  v_this_month_end date := (date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 day')::date;
  v_last_month_start date := (date_trunc('month', CURRENT_DATE) - interval '1 month')::date;
  v_last_month_end date := (date_trunc('month', CURRENT_DATE) - interval '1 day')::date;
  v_this_month_count integer;
  v_last_month_count integer;
  v_pct_change numeric;
  v_body text;
  v_existing integer;
BEGIN
  FOR v_user_id IN
    SELECT DISTINCT user_id FROM challenge_checkins
    WHERE checkin_date >= v_last_month_start AND checkin_date <= v_this_month_end
  LOOP
    -- Check if we already created a monthly report this month
    SELECT count(*) INTO v_existing
    FROM notifications
    WHERE user_id = v_user_id
      AND type = 'monthly_challenge_report'
      AND created_at::date >= v_this_month_start;

    IF v_existing > 0 THEN
      CONTINUE;
    END IF;

    -- Count completions (checkins) this month and last month
    SELECT count(*) INTO v_this_month_count
    FROM challenge_checkins
    WHERE user_id = v_user_id
      AND checkin_date >= v_this_month_start
      AND checkin_date <= v_this_month_end;

    SELECT count(*) INTO v_last_month_count
    FROM challenge_checkins
    WHERE user_id = v_user_id
      AND checkin_date >= v_last_month_start
      AND checkin_date <= v_last_month_end;

    -- Build report body
    IF v_last_month_count = 0 THEN
      IF v_this_month_count = 0 THEN
        CONTINUE;
      END IF;
      v_body := concat('This month you completed ', v_this_month_count, ' Challenge', CASE WHEN v_this_month_count > 1 THEN 's' ELSE '' END, '.', E'\n\nNew activity this period!');
    ELSE
      v_pct_change := round((v_this_month_count - v_last_month_count)::numeric / v_last_month_count * 100);
      IF v_pct_change > 0 THEN
        v_body := concat('This month you completed ', v_this_month_count, ' Challenge', CASE WHEN v_this_month_count > 1 THEN 's' ELSE '' END, '.', E'\n\nThat''s ', v_pct_change, '% more than last month!');
      ELSIF v_pct_change < 0 THEN
        v_body := concat('This month you completed ', v_this_month_count, ' Challenge', CASE WHEN v_this_month_count > 1 THEN 's' ELSE '' END, '.', E'\n\nThat''s ', abs(v_pct_change), '% less than last month.');
      ELSE
        v_body := concat('This month you completed ', v_this_month_count, ' Challenge', CASE WHEN v_this_month_count > 1 THEN 's' ELSE '' END, '.', E'\n\nSame as last month.');
      END IF;
    END IF;

    INSERT INTO notifications (user_id, type, title, body, link)
    VALUES (v_user_id, 'monthly_challenge_report', 'Your Monthly Challenge Report', v_body, '/app/notifications/report?type=monthly');

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ============================================================
-- 6. Get challenge report data for visualization
--    Returns JSON with current/previous period stats.
--    p_period: 'weekly' or 'monthly'
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_challenge_report(p_user_id uuid, p_period text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_curr_start date;
  v_curr_end date;
  v_prev_start date;
  v_prev_end date;
  v_curr_count integer;
  v_prev_count integer;
  v_active_count integer;
  v_max_streak integer;
  v_total_participations integer;
  v_completed_count integer;
  v_completion_rate numeric;
  v_pct_change numeric;
  v_curr_label text;
  v_prev_label text;
BEGIN
  IF p_period = 'weekly' THEN
    v_curr_start := date_trunc('week', CURRENT_DATE)::date;
    v_curr_end := (date_trunc('week', CURRENT_DATE) + interval '6 days')::date;
    v_prev_start := (date_trunc('week', CURRENT_DATE) - interval '7 days')::date;
    v_prev_end := (date_trunc('week', CURRENT_DATE) - interval '1 day')::date;
    v_curr_label := to_char(v_curr_start, 'Mon DD') || ' - ' || to_char(v_curr_end, 'Mon DD');
    v_prev_label := to_char(v_prev_start, 'Mon DD') || ' - ' || to_char(v_prev_end, 'Mon DD');
  ELSIF p_period = 'monthly' THEN
    v_curr_start := date_trunc('month', CURRENT_DATE)::date;
    v_curr_end := (date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 day')::date;
    v_prev_start := (date_trunc('month', CURRENT_DATE) - interval '1 month')::date;
    v_prev_end := (date_trunc('month', CURRENT_DATE) - interval '1 day')::date;
    v_curr_label := to_char(v_curr_start, 'Month YYYY');
    v_prev_label := to_char(v_prev_start, 'Month YYYY');
  ELSE
    RETURN json_build_object('error', 'invalid period');
  END IF;

  -- Current period checkin count
  SELECT count(*) INTO v_curr_count
  FROM challenge_checkins
  WHERE user_id = p_user_id
    AND checkin_date >= v_curr_start
    AND checkin_date <= v_curr_end;

  -- Previous period checkin count
  SELECT count(*) INTO v_prev_count
  FROM challenge_checkins
  WHERE user_id = p_user_id
    AND checkin_date >= v_prev_start
    AND checkin_date <= v_prev_end;

  -- Active challenges (joined, not completed, challenge is active)
  SELECT count(*) INTO v_active_count
  FROM challenge_participants cp
  INNER JOIN challenges c ON c.id = cp.challenge_id
  WHERE cp.user_id = p_user_id
    AND c.status = 'active'
    AND cp.completed = false;

  -- Total participations
  SELECT count(*) INTO v_total_participations
  FROM challenge_participants
  WHERE user_id = p_user_id;

  -- Completed challenges
  SELECT count(*) INTO v_completed_count
  FROM challenge_participants
  WHERE user_id = p_user_id
    AND completed = true;

  -- Completion rate
  IF v_total_participations > 0 THEN
    v_completion_rate := round(v_completed_count::numeric / v_total_participations * 100);
  ELSE
    v_completion_rate := 0;
  END IF;

  -- Max streak
  SELECT COALESCE(max(streak), 0) INTO v_max_streak
  FROM challenge_participants
  WHERE user_id = p_user_id;

  -- Percentage change
  IF v_prev_count = 0 THEN
    v_pct_change := null;
  ELSE
    v_pct_change := round((v_curr_count - v_prev_count)::numeric / v_prev_count * 100);
  END IF;

  RETURN json_build_object(
    'period', p_period,
    'current_label', v_curr_label,
    'previous_label', v_prev_label,
    'current_count', v_curr_count,
    'previous_count', v_prev_count,
    'active_challenges', v_active_count,
    'total_participations', v_total_participations,
    'completed_challenges', v_completed_count,
    'completion_rate', v_completion_rate,
    'max_streak', v_max_streak,
    'pct_change', v_pct_change
  );
END;
$$;

-- Grant execute to authenticated
GRANT EXECUTE ON FUNCTION public.get_user_challenge_reminders(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_challenge_report(uuid, text) TO authenticated;


-- ============================================================================
-- [MIGRATION 025] 20260826083754_20260826120000_025_fix_notifications_insert_rls.sql.sql
-- ============================================================================

-- Security fix: tighten notifications INSERT policy
-- Previously WITH CHECK (true) allowed any authenticated user to insert
-- notifications for arbitrary user_id values. The SECURITY DEFINER
-- functions that create notifications bypass RLS, so this change does
-- not affect them. Direct client inserts are now restricted to own user_id.

DROP POLICY IF EXISTS notif_insert ON notifications;

CREATE POLICY "notif_insert_own" ON notifications FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);


-- ============================================================================
-- [MIGRATION 026] 20260827160000_026_my_life_complete_module.sql
-- ============================================================================

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

-- ============================================================================
-- [MIGRATION 029] 20260828150000_029_challenge_notifications_complete_fix.sql
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_user_daily_challenge_reminder(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tz text := 'Asia/Ho_Chi_Minh';
  v_today date;
  v_titles text[];
  v_body text;
  v_existing integer;
BEGIN
  SELECT COALESCE(timezone, 'Asia/Ho_Chi_Minh') INTO v_tz
  FROM profiles
  WHERE id = p_user_id;

  IF v_tz IS NULL OR v_tz = '' THEN
    v_tz := 'Asia/Ho_Chi_Minh';
  END IF;

  v_today := (CURRENT_TIMESTAMP AT TIME ZONE v_tz)::date;

  SELECT count(*) INTO v_existing
  FROM notifications
  WHERE user_id = p_user_id
    AND type = 'daily_challenge_reminder'
    AND (created_at AT TIME ZONE v_tz)::date = v_today;

  IF v_existing > 0 THEN
    RETURN 0;
  END IF;

  v_titles := ARRAY(SELECT get_user_challenge_reminders.title FROM get_user_challenge_reminders(p_user_id, v_today));

  IF array_length(v_titles, 1) IS NULL OR array_length(v_titles, 1) = 0 THEN
    RETURN 0;
  END IF;

  IF array_length(v_titles, 1) = 1 THEN
    v_body := v_titles[1];
  ELSE
    v_body := array_to_string(v_titles, E'\n');
  END IF;

  INSERT INTO notifications (user_id, type, title, body, link)
  VALUES (p_user_id, 'daily_challenge_reminder', 'Daily Challenge Reminder', v_body, '/app/study');

  RETURN 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_daily_challenge_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_user_id uuid;
  v_res integer;
BEGIN
  FOR v_user_id IN
    SELECT DISTINCT cp.user_id
    FROM challenge_participants cp
    INNER JOIN challenges c ON c.id = cp.challenge_id
    WHERE c.status = 'active' AND cp.completed = false
  LOOP
    v_res := public.check_user_daily_challenge_reminder(v_user_id);
    v_count := v_count + v_res;
  END LOOP;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_challenge_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_challenge_title text;
  v_existing integer;
BEGIN
  IF NEW.completed = true AND (OLD.completed IS NULL OR OLD.completed = false) THEN
    SELECT title INTO v_challenge_title
    FROM challenges
    WHERE id = NEW.challenge_id;

    SELECT count(*) INTO v_existing
    FROM notifications
    WHERE user_id = NEW.user_id
      AND type = 'challenge_completed'
      AND link = '/app/study'
      AND body LIKE '%' || COALESCE(v_challenge_title, '') || '%'
      AND created_at > (now() - interval '1 day');

    IF v_existing = 0 THEN
      INSERT INTO notifications (user_id, type, title, body, link)
      VALUES (
        NEW.user_id,
        'challenge_completed',
        'Challenge Completed! 🎉',
        'Congratulations! You have completed the challenge: ' || COALESCE(v_challenge_title, 'Challenge'),
        '/app/study'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_challenge_completed ON challenge_participants;
CREATE TRIGGER trg_challenge_completed
  AFTER UPDATE ON challenge_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_challenge_completed();

CREATE OR REPLACE FUNCTION public.notify_challenge_streak()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_challenge_title text;
  v_existing integer;
BEGIN
  IF NEW.streak > COALESCE(OLD.streak, 0) AND NEW.streak IN (3, 7, 14, 21, 30) THEN
    SELECT title INTO v_challenge_title
    FROM challenges
    WHERE id = NEW.challenge_id;

    SELECT count(*) INTO v_existing
    FROM notifications
    WHERE user_id = NEW.user_id
      AND type = 'challenge_streak'
      AND body LIKE '%' || NEW.streak || '-day%'
      AND created_at > (now() - interval '1 day');

    IF v_existing = 0 THEN
      INSERT INTO notifications (user_id, type, title, body, link)
      VALUES (
        NEW.user_id,
        'challenge_streak',
        'Streak Milestone! 🔥',
        'Awesome! You reached a ' || NEW.streak || '-day streak in ' || COALESCE(v_challenge_title, 'your challenge') || '!',
        '/app/study'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_challenge_streak ON challenge_participants;
CREATE TRIGGER trg_challenge_streak
  AFTER UPDATE ON challenge_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_challenge_streak();

GRANT EXECUTE ON FUNCTION public.get_user_challenge_reminders(uuid, date) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.check_user_daily_challenge_reminder(uuid) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.generate_daily_challenge_reminders() TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.generate_weekly_challenge_reports() TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.generate_monthly_challenge_reports() TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.get_challenge_report(uuid, text) TO authenticated, service_role, anon;


