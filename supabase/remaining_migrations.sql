-- ============================================================================
-- NEXUS SOCIAL OS - COMPLETE IDEMPOTENT CONSOLIDATED MIGRATION (001 -> 026)
-- Target Database: Supabase Project dmabwszdcrisfvbmqiuq
-- File: supabase/remaining_migrations.sql
-- 
-- GUIDELINES:
-- 1. All CREATE TYPE statements are wrapped in DO $$ blocks with duplicate_object handlers.
-- 2. All CREATE TABLE statements use IF NOT EXISTS.
-- 3. All column additions use ALTER TABLE ... ADD COLUMN IF NOT EXISTS.
-- 4. All constraints check pg_constraint before adding.
-- 5. All functions use CREATE OR REPLACE FUNCTION.
-- 6. All triggers use DROP TRIGGER IF EXISTS before CREATE TRIGGER.
-- 7. All policies use DROP POLICY IF EXISTS before CREATE POLICY.
-- 8. Seed data uses ON CONFLICT DO NOTHING.
-- 9. No DROP TABLE, no DELETE, no secrets.
-- ============================================================================


-- ============================================================================
-- SECTION 1: ENUM TYPES (Migrations 001, 003, 005)
-- ============================================================================

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

-- 003 Enums
DO $$ BEGIN CREATE TYPE verification_status AS ENUM ('basic', 'pending', 'verified'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE verification_method AS ENUM ('school_email', 'student_id', 'school_verification'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE user_role AS ENUM ('user', 'moderator', 'admin', 'super_admin'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE verification_review_status AS ENUM ('pending', 'approved', 'rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 005 Enums
DO $$ BEGIN CREATE TYPE forum_post_status AS ENUM ('active','hidden','deleted','locked'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE forum_reaction_type AS ENUM ('helpful','understand','interesting','well_done'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE forum_report_status AS ENUM ('pending','reviewed','resolved','dismissed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================================
-- SECTION 2: CORE TABLES & STRUCTURAL EXTENSIONS (Migrations 001 - 026)
-- ============================================================================

-- 1. profiles
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

-- Profiles extensions (003, 024)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS date_of_birth date;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS province text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verification_status verification_status DEFAULT 'basic';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'Asia/Ho_Chi_Minh';

-- 2. communities
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

-- Communities extensions (017)
ALTER TABLE communities ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE communities ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- 3. community_members
CREATE TABLE IF NOT EXISTS community_members (
  community_id uuid REFERENCES communities(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  role community_role DEFAULT 'member',
  joined_at timestamptz DEFAULT now(),
  PRIMARY KEY (community_id, user_id)
);

-- 4. posts
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

-- Posts extensions (017)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- 5. comments
CREATE TABLE IF NOT EXISTS comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE,
  author_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES comments(id) ON DELETE CASCADE,
  content text NOT NULL,
  is_anonymous boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 6. goals
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

-- 7. habits
CREATE TABLE IF NOT EXISTS habits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  icon text DEFAULT '✅',
  frequency text DEFAULT 'daily',
  streak int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Habits extensions (026)
ALTER TABLE habits ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'study';
ALTER TABLE habits ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS target_days INT DEFAULT 7;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 8. habit_logs
CREATE TABLE IF NOT EXISTS habit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id uuid REFERENCES habits(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  completed_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

-- 9. mood_entries
CREATE TABLE IF NOT EXISTS mood_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  mood int NOT NULL,
  note text,
  tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- 10. journal_entries
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

-- Journal entries extensions (026)
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'friends' CHECK (visibility IN ('private', 'friends', 'public'));
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS reactions_count INT DEFAULT 0;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS comments_count INT DEFAULT 0;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 11. projects
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

-- 12. project_members
CREATE TABLE IF NOT EXISTS project_members (
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'Member',
  joined_at timestamptz DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

-- 13. project_tasks
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

-- 14. challenges
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

-- Challenges extensions (015, 017)
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS creator_id uuid REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'other';
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS parent_challenge_id uuid REFERENCES challenges(id) ON DELETE SET NULL;
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Challenges constraints (016)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_duration_range') THEN
    ALTER TABLE challenges ADD CONSTRAINT chk_duration_range CHECK (duration_days >= 1 AND duration_days <= 30);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_challenge_status') THEN
    ALTER TABLE challenges ADD CONSTRAINT chk_challenge_status CHECK (status IN ('active', 'completed', 'archived'));
  END IF;
END $$;

-- 15. challenge_participants
CREATE TABLE IF NOT EXISTS challenge_participants (
  challenge_id uuid REFERENCES challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  progress int DEFAULT 0,
  streak int DEFAULT 0,
  joined_at timestamptz DEFAULT now(),
  PRIMARY KEY (challenge_id, user_id)
);

-- Challenge participants extensions (015)
ALTER TABLE challenge_participants ADD COLUMN IF NOT EXISTS completed boolean NOT NULL DEFAULT false;
ALTER TABLE challenge_participants ADD COLUMN IF NOT EXISTS round int NOT NULL DEFAULT 1;

-- 16. challenge_checkins (015)
CREATE TABLE IF NOT EXISTS challenge_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  checkin_date date NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (challenge_id, user_id, checkin_date)
);

-- 17. notifications
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

-- 18. reports
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  reason text NOT NULL,
  status report_status DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

-- 19. ai_conversations
CREATE TABLE IF NOT EXISTS ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  bot_type text NOT NULL DEFAULT 'companion',
  title text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 20. ai_messages
CREATE TABLE IF NOT EXISTS ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role message_role NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 21. user_roles (003)
CREATE TABLE IF NOT EXISTS user_roles (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  role user_role DEFAULT 'user',
  created_at timestamptz DEFAULT now()
);

-- 22. student_verifications (003, 009)
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
ALTER TABLE student_verifications ADD COLUMN IF NOT EXISTS education_level text;

-- 23. verification_audit_logs (007)
CREATE TABLE IF NOT EXISTS verification_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_request_id uuid NOT NULL REFERENCES student_verifications(id) ON DELETE CASCADE,
  admin_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('approved', 'rejected')),
  rejection_reason text,
  created_at timestamptz DEFAULT now()
);

-- 24. forum_categories (005)
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

-- 25. forum_posts (005)
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

-- 26. forum_comments (005)
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

-- 27. forum_reactions (005)
CREATE TABLE IF NOT EXISTS forum_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES forum_posts(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES forum_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  reaction_type forum_reaction_type NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT forum_reaction_target CHECK (post_id IS NOT NULL OR comment_id IS NOT NULL)
);

-- 28. forum_bookmarks (005)
CREATE TABLE IF NOT EXISTS forum_bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (post_id, user_id)
);

-- 29. forum_tags (005)
CREATE TABLE IF NOT EXISTS forum_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  slug text UNIQUE NOT NULL,
  usage_count int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 30. forum_reports (005)
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

-- 31. community_post_attachments (019)
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

-- 32. community_post_reactions (019)
CREATE TABLE IF NOT EXISTS community_post_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 33. forum_post_attachments (020)
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

-- 34. forum_post_reactions (020)
CREATE TABLE IF NOT EXISTS forum_post_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 35. friendships (026)
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

-- 36. habit_templates (026)
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

-- 37. mood_weekly_summaries (026)
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

-- 38. journal_post_attachments (026)
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

-- 39. journal_post_reactions (026)
CREATE TABLE IF NOT EXISTS journal_post_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_journal_user_reaction UNIQUE (journal_id, user_id)
);

-- 40. journal_post_comments (026)
CREATE TABLE IF NOT EXISTS journal_post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES journal_post_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 41. journal_post_shares (026)
CREATE TABLE IF NOT EXISTS journal_post_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  shared_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  shared_to_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  caption TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================================
-- SECTION 3: ENABLE RLS ON ALL TABLES
-- ============================================================================

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
ALTER TABLE challenge_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_post_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_post_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_post_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_post_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE habit_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE mood_weekly_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_post_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_post_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_post_shares ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- SECTION 4: INDEXES
-- ============================================================================

-- 001
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

-- 003
CREATE INDEX IF NOT EXISTS idx_sv_user ON student_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_sv_status ON student_verifications(status);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);

-- 005
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

-- 007
CREATE INDEX IF NOT EXISTS idx_val_verification ON verification_audit_logs(verification_request_id);
CREATE INDEX IF NOT EXISTS idx_val_admin ON verification_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_val_created ON verification_audit_logs(created_at);

-- 014
CREATE INDEX IF NOT EXISTS idx_forum_posts_category_discussed
  ON forum_posts (category_id, comments_count DESC, created_at DESC)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_forum_posts_category_helpful
  ON forum_posts (category_id, reactions_count DESC, created_at DESC)
  WHERE status = 'active';

-- 015
CREATE INDEX IF NOT EXISTS idx_checkins_user_challenge ON challenge_checkins(user_id, challenge_id, checkin_date DESC);
CREATE INDEX IF NOT EXISTS idx_checkins_challenge ON challenge_checkins(challenge_id, checkin_date DESC);
CREATE INDEX IF NOT EXISTS idx_challenges_creator ON challenges(creator_id);
CREATE INDEX IF NOT EXISTS idx_challenges_status ON challenges(status);
CREATE INDEX IF NOT EXISTS idx_challenges_category ON challenges(category);

-- 017
CREATE INDEX IF NOT EXISTS idx_posts_deleted_at ON posts(deleted_at);
CREATE INDEX IF NOT EXISTS idx_communities_archived_at ON communities(archived_at);

-- 019
CREATE INDEX IF NOT EXISTS idx_attachments_post_id ON community_post_attachments(post_id);
CREATE INDEX IF NOT EXISTS idx_attachments_community_id ON community_post_attachments(community_id);
CREATE INDEX IF NOT EXISTS idx_attachments_uploader_id ON community_post_attachments(uploader_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_reaction_per_user_per_post_per_type
  ON community_post_reactions(post_id, user_id, reaction_type);
CREATE INDEX IF NOT EXISTS idx_reactions_post_id ON community_post_reactions(post_id);
CREATE INDEX IF NOT EXISTS idx_reactions_user_id ON community_post_reactions(user_id);

-- 020
CREATE INDEX IF NOT EXISTS idx_forum_attachments_post_id ON forum_post_attachments(post_id);
CREATE INDEX IF NOT EXISTS idx_forum_attachments_uploader_id ON forum_post_attachments(uploader_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_forum_reaction_per_user_per_post_per_type
  ON forum_post_reactions(post_id, user_id, reaction_type);
CREATE INDEX IF NOT EXISTS idx_forum_reactions_post_id ON forum_post_reactions(post_id);
CREATE INDEX IF NOT EXISTS idx_forum_reactions_user_id ON forum_post_reactions(user_id);

-- 026
CREATE INDEX IF NOT EXISTS idx_friendships_user ON friendships(user_id, status);
CREATE INDEX IF NOT EXISTS idx_friendships_friend ON friendships(friend_id, status);
CREATE INDEX IF NOT EXISTS idx_habit_templates_category ON habit_templates(category, sort_order);
CREATE INDEX IF NOT EXISTS idx_habits_user_archived ON habits(user_id, is_archived);
CREATE INDEX IF NOT EXISTS idx_habit_logs_user_date ON habit_logs(user_id, completed_date);
CREATE INDEX IF NOT EXISTS idx_mood_summaries_user_week ON mood_weekly_summaries(user_id, week_start_date DESC);
CREATE INDEX IF NOT EXISTS idx_journal_visibility ON journal_entries(visibility, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_journal_attachments_journal ON journal_post_attachments(journal_id);
CREATE INDEX IF NOT EXISTS idx_journal_reactions_journal ON journal_post_reactions(journal_id);
CREATE INDEX IF NOT EXISTS idx_journal_comments_journal ON journal_post_comments(journal_id, created_at);
CREATE INDEX IF NOT EXISTS idx_journal_shares_journal ON journal_post_shares(journal_id);


-- ============================================================================
-- SECTION 5: FUNCTIONS & PROCEDURES
-- ============================================================================

-- 1. Helper: is_admin (023)
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

-- 2. Helper: is_moderator_or_admin (023)
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

-- 3. Helper: is_community_member (013)
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

-- 4. Helper: are_friends (026)
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

-- 5. Student Verification: approve_student_verification (003, 007)
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
  SELECT role INTO v_role FROM user_roles WHERE user_id = auth.uid();
  IF v_role NOT IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'Permission denied: admin role required';
  END IF;

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

-- 6. Admin Bootstrap: bootstrap_first_admin (008)
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
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT count(*) INTO v_admin_count
  FROM user_roles
  WHERE role IN ('admin', 'super_admin');

  IF v_admin_count > 0 THEN
    RAISE EXCEPTION 'An admin already exists. Use the admin panel to manage roles.';
  END IF;

  SELECT username INTO v_username FROM profiles WHERE id = v_user_id;

  INSERT INTO user_roles (user_id, role)
  VALUES (v_user_id, 'super_admin')
  ON CONFLICT (user_id) DO UPDATE SET role = 'super_admin';

  RETURN v_username;
END;
$$;

-- 7. Onboarding: complete_student_onboarding (009)
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

-- 8. Community Creation: create_community (011)
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

-- 9. Challenge Helpers & Generators (024)
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
  v_body text;
  v_num integer;
  v_existing integer;
BEGIN
  FOR v_user_id IN
    SELECT DISTINCT cp.user_id
    FROM challenge_participants cp
    INNER JOIN challenges c ON c.id = cp.challenge_id
    WHERE c.status = 'active' AND cp.completed = false
  LOOP
    SELECT count(*) INTO v_existing
    FROM notifications
    WHERE user_id = v_user_id
      AND type = 'daily_challenge_reminder'
      AND created_at::date = v_today;

    IF v_existing > 0 THEN
      CONTINUE;
    END IF;

    v_titles := ARRAY(SELECT get_user_challenge_reminders.title FROM get_user_challenge_reminders(v_user_id, v_today));

    IF array_length(v_titles, 1) IS NULL OR array_length(v_titles, 1) = 0 THEN
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
BEGIN
  FOR v_user_id IN
    SELECT DISTINCT user_id FROM challenge_checkins
    WHERE checkin_date >= v_last_week_start AND checkin_date <= v_this_week_end
  LOOP
    SELECT count(*) INTO v_existing
    FROM notifications
    WHERE user_id = v_user_id
      AND type = 'weekly_challenge_report'
      AND created_at::date >= v_this_week_start;

    IF v_existing > 0 THEN
      CONTINUE;
    END IF;

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

    IF v_last_week_count = 0 THEN
      IF v_this_week_count = 0 THEN
        CONTINUE;
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
    SELECT count(*) INTO v_existing
    FROM notifications
    WHERE user_id = v_user_id
      AND type = 'monthly_challenge_report'
      AND created_at::date >= v_this_month_start;

    IF v_existing > 0 THEN
      CONTINUE;
    END IF;

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

  SELECT count(*) INTO v_curr_count
  FROM challenge_checkins
  WHERE user_id = p_user_id
    AND checkin_date >= v_curr_start
    AND checkin_date <= v_curr_end;

  SELECT count(*) INTO v_prev_count
  FROM challenge_checkins
  WHERE user_id = p_user_id
    AND checkin_date >= v_prev_start
    AND checkin_date <= v_prev_end;

  SELECT count(*) INTO v_active_count
  FROM challenge_participants cp
  INNER JOIN challenges c ON c.id = cp.challenge_id
  WHERE cp.user_id = p_user_id
    AND c.status = 'active'
    AND cp.completed = false;

  SELECT count(*) INTO v_total_participations
  FROM challenge_participants
  WHERE user_id = p_user_id;

  SELECT count(*) INTO v_completed_count
  FROM challenge_participants
  WHERE user_id = p_user_id
    AND completed = true;

  IF v_total_participations > 0 THEN
    v_completion_rate := round(v_completed_count::numeric / v_total_participations * 100);
  ELSE
    v_completion_rate := 0;
  END IF;

  SELECT COALESCE(max(streak), 0) INTO v_max_streak
  FROM challenge_participants
  WHERE user_id = p_user_id;

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

-- Function Grants
REVOKE ALL ON FUNCTION public.is_community_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_community_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_moderator_or_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_student_verification(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_first_admin() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.bootstrap_first_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.complete_student_onboarding(text, text, text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_student_onboarding(text, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_community(text, text, text, text, text, boolean) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_community(text, text, text, text, text, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_user_challenge_reminders(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_challenge_report(uuid, text) TO authenticated;


-- ============================================================================
-- SECTION 6: TRIGGER FUNCTIONS & TRIGGERS
-- ============================================================================

-- 1. Auto updated_at trigger (017)
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

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

-- 2. Forum Counts Triggers (005)
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

-- 3. Community Post Reactions Sync Trigger (019)
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

-- 4. Forum Post Reactions Sync Trigger (020)
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
-- SECTION 7: STORAGE BUCKETS & POLICIES
-- ============================================================================

-- 1. Create Buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('student-verification', 'student-verification', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('forum-images', 'forum-images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('community-files', 'community-files', false)
ON CONFLICT (id) DO NOTHING;

-- Bucket configurations (009)
UPDATE storage.buckets
SET public = false,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
WHERE id = 'student-verification';

-- Global bucket SELECT policy (022)
DROP POLICY IF EXISTS "bucket_select_all" ON storage.buckets;
CREATE POLICY "bucket_select_all"
  ON storage.buckets FOR SELECT
  TO anon, authenticated
  USING (true);

-- Student verification storage policies (006, 023)
DROP POLICY IF EXISTS "sv_bucket_upload_own" ON storage.objects;
CREATE POLICY "sv_bucket_upload_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'student-verification'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "sv_bucket_read_own" ON storage.objects;
CREATE POLICY "sv_bucket_read_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'student-verification'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "sv_bucket_read_admin" ON storage.objects;
CREATE POLICY "sv_bucket_read_admin" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'student-verification'
    AND is_admin()
  );

DROP POLICY IF EXISTS "sv_bucket_delete_admin" ON storage.objects;
CREATE POLICY "sv_bucket_delete_admin" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'student-verification'
    AND is_admin()
  );

-- Forum images storage policies (010)
DROP POLICY IF EXISTS "forum_images_public_read" ON storage.objects;
CREATE POLICY "forum_images_public_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'forum-images');

DROP POLICY IF EXISTS "forum_images_insert_own" ON storage.objects;
CREATE POLICY "forum_images_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'forum-images' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "forum_images_update_own" ON storage.objects;
CREATE POLICY "forum_images_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'forum-images' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'forum-images' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "forum_images_delete_own" ON storage.objects;
CREATE POLICY "forum_images_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'forum-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Community files storage policies (019, 021)
DROP POLICY IF EXISTS "community_files_upload_own" ON storage.objects;
CREATE POLICY "community_files_upload_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'community-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "community_files_read_own" ON storage.objects;
DROP POLICY IF EXISTS "community_files_read_authenticated" ON storage.objects;
CREATE POLICY "community_files_read_authenticated"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'community-files');

DROP POLICY IF EXISTS "community_files_delete_own" ON storage.objects;
CREATE POLICY "community_files_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'community-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "community_files_update_own" ON storage.objects;
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


-- ============================================================================
-- SECTION 8: TABLE ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- profiles (002, 009)
DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
CREATE POLICY "profiles_select_all" ON profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id AND coalesce(verification_status, 'basic') = 'basic');

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

REVOKE UPDATE ON TABLE public.profiles FROM authenticated;
GRANT UPDATE (
  username, full_name, avatar_url, bio, interests, skills, goals,
  profile_visibility, date_of_birth, country, province, timezone
) ON TABLE public.profiles TO authenticated;

-- communities (002, 013, 017, 018)
DROP POLICY IF EXISTS "communities_select" ON communities;
CREATE POLICY "communities_select" ON communities FOR SELECT TO authenticated
  USING (
    (archived_at IS NULL OR created_by = auth.uid())
    AND (
      is_private = false
      OR created_by = auth.uid()
      OR public.is_community_member(id)
    )
  );

DROP POLICY IF EXISTS "communities_insert_own" ON communities;
CREATE POLICY "communities_insert_own" ON communities FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "communities_update_own" ON communities;
CREATE POLICY "communities_update_own" ON communities FOR UPDATE TO authenticated USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "communities_delete_own" ON communities;
CREATE POLICY "communities_delete_own" ON communities FOR DELETE TO authenticated USING (auth.uid() = created_by);

-- community_members (002, 013)
DROP POLICY IF EXISTS "cm_select" ON community_members;
CREATE POLICY "cm_select" ON community_members FOR SELECT TO authenticated
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

DROP POLICY IF EXISTS "cm_insert_own" ON community_members;
CREATE POLICY "cm_insert_own" ON community_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "cm_delete_own" ON community_members;
CREATE POLICY "cm_delete_own" ON community_members FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- posts (002, 013, 017, 018)
DROP POLICY IF EXISTS "posts_select" ON posts;
CREATE POLICY "posts_select" ON posts FOR SELECT TO authenticated
  USING (
    (deleted_at IS NULL OR author_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM communities c WHERE c.id = posts.community_id
      AND (c.is_private = false OR c.created_by = auth.uid()
        OR public.is_community_member(c.id))
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

-- comments (002, 013)
DROP POLICY IF EXISTS "comments_select" ON comments;
CREATE POLICY "comments_select" ON comments FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM posts p JOIN communities c ON c.id = p.community_id
    WHERE p.id = comments.post_id
    AND (c.is_private = false OR c.created_by = auth.uid()
      OR public.is_community_member(c.id))
  )
);

DROP POLICY IF EXISTS "comments_insert_own" ON comments;
CREATE POLICY "comments_insert_own" ON comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "comments_update_own" ON comments;
CREATE POLICY "comments_update_own" ON comments FOR UPDATE TO authenticated USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "comments_delete_own" ON comments;
CREATE POLICY "comments_delete_own" ON comments FOR DELETE TO authenticated USING (auth.uid() = author_id);

-- goals (002)
DROP POLICY IF EXISTS "goals_select_own" ON goals;
CREATE POLICY "goals_select_own" ON goals FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "goals_insert_own" ON goals;
CREATE POLICY "goals_insert_own" ON goals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "goals_update_own" ON goals;
CREATE POLICY "goals_update_own" ON goals FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "goals_delete_own" ON goals;
CREATE POLICY "goals_delete_own" ON goals FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- habits (002)
DROP POLICY IF EXISTS "habits_select_own" ON habits;
CREATE POLICY "habits_select_own" ON habits FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "habits_insert_own" ON habits;
CREATE POLICY "habits_insert_own" ON habits FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "habits_update_own" ON habits;
CREATE POLICY "habits_update_own" ON habits FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "habits_delete_own" ON habits;
CREATE POLICY "habits_delete_own" ON habits FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- habit_logs (002)
DROP POLICY IF EXISTS "habit_logs_select_own" ON habit_logs;
CREATE POLICY "habit_logs_select_own" ON habit_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "habit_logs_insert_own" ON habit_logs;
CREATE POLICY "habit_logs_insert_own" ON habit_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "habit_logs_delete_own" ON habit_logs;
CREATE POLICY "habit_logs_delete_own" ON habit_logs FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- mood_entries (002)
DROP POLICY IF EXISTS "mood_select_own" ON mood_entries;
CREATE POLICY "mood_select_own" ON mood_entries FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "mood_insert_own" ON mood_entries;
CREATE POLICY "mood_insert_own" ON mood_entries FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "mood_delete_own" ON mood_entries;
CREATE POLICY "mood_delete_own" ON mood_entries FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- journal_entries (002, 026)
DROP POLICY IF EXISTS "journal_select_own" ON journal_entries;
DROP POLICY IF EXISTS "journal_select_social" ON journal_entries;
CREATE POLICY "journal_select_social" ON journal_entries
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR visibility = 'public'
    OR (visibility = 'friends' AND are_friends(auth.uid(), user_id))
  );

DROP POLICY IF EXISTS "journal_insert_own" ON journal_entries;
CREATE POLICY "journal_insert_own" ON journal_entries FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "journal_update_own" ON journal_entries;
CREATE POLICY "journal_update_own" ON journal_entries FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "journal_delete_own" ON journal_entries;
CREATE POLICY "journal_delete_own" ON journal_entries FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- projects (002)
DROP POLICY IF EXISTS "projects_select_all" ON projects;
CREATE POLICY "projects_select_all" ON projects FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "projects_insert_own" ON projects;
CREATE POLICY "projects_insert_own" ON projects FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "projects_update_own" ON projects;
CREATE POLICY "projects_update_own" ON projects FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "projects_delete_own" ON projects;
CREATE POLICY "projects_delete_own" ON projects FOR DELETE TO authenticated USING (auth.uid() = owner_id);

-- project_members (002)
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

-- project_tasks (002)
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

-- challenges (002, 015, 016, 017)
DROP POLICY IF EXISTS "challenges_select_all" ON challenges;
DROP POLICY IF EXISTS "challenges_select_visible" ON challenges;
CREATE POLICY "challenges_select_visible" ON challenges FOR SELECT
  TO authenticated USING (creator_id IS NULL OR creator_id = auth.uid());

DROP POLICY IF EXISTS "challenges_insert" ON challenges;
DROP POLICY IF EXISTS "challenges_insert_own" ON challenges;
CREATE POLICY "challenges_insert_own" ON challenges FOR INSERT
  TO authenticated WITH CHECK (creator_id = auth.uid());

DROP POLICY IF EXISTS "challenges_update_own" ON challenges;
CREATE POLICY "challenges_update_own" ON challenges FOR UPDATE
  TO authenticated USING (creator_id = auth.uid()) WITH CHECK (creator_id = auth.uid());

DROP POLICY IF EXISTS "challenges_delete_own" ON challenges;
CREATE POLICY "challenges_delete_own" ON challenges FOR DELETE
  TO authenticated USING (creator_id = auth.uid());

-- challenge_participants (002)
DROP POLICY IF EXISTS "cp_select_all" ON challenge_participants;
CREATE POLICY "cp_select_all" ON challenge_participants FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "cp_insert_own" ON challenge_participants;
CREATE POLICY "cp_insert_own" ON challenge_participants FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "cp_update_own" ON challenge_participants;
CREATE POLICY "cp_update_own" ON challenge_participants FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "cp_delete_own" ON challenge_participants;
CREATE POLICY "cp_delete_own" ON challenge_participants FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- challenge_checkins (015)
DROP POLICY IF EXISTS "checkins_select_own" ON challenge_checkins;
CREATE POLICY "checkins_select_own" ON challenge_checkins FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "checkins_insert_own" ON challenge_checkins;
CREATE POLICY "checkins_insert_own" ON challenge_checkins FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "checkins_delete_own" ON challenge_checkins;
CREATE POLICY "checkins_delete_own" ON challenge_checkins FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- notifications (002, 025)
DROP POLICY IF EXISTS "notif_select_own" ON notifications;
CREATE POLICY "notif_select_own" ON notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notif_insert" ON notifications;
DROP POLICY IF EXISTS "notif_insert_own" ON notifications;
CREATE POLICY "notif_insert_own" ON notifications FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notif_update_own" ON notifications;
CREATE POLICY "notif_update_own" ON notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notif_delete_own" ON notifications;
CREATE POLICY "notif_delete_own" ON notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- reports (002)
DROP POLICY IF EXISTS "reports_select_own" ON reports;
CREATE POLICY "reports_select_own" ON reports FOR SELECT TO authenticated USING (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "reports_insert_own" ON reports;
CREATE POLICY "reports_insert_own" ON reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);

-- ai_conversations (002)
DROP POLICY IF EXISTS "ai_conv_select_own" ON ai_conversations;
CREATE POLICY "ai_conv_select_own" ON ai_conversations FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "ai_conv_insert_own" ON ai_conversations;
CREATE POLICY "ai_conv_insert_own" ON ai_conversations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "ai_conv_update_own" ON ai_conversations;
CREATE POLICY "ai_conv_update_own" ON ai_conversations FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "ai_conv_delete_own" ON ai_conversations;
CREATE POLICY "ai_conv_delete_own" ON ai_conversations FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ai_messages (002)
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

-- user_roles (003, 023)
DROP POLICY IF EXISTS "user_roles_select_own" ON user_roles;
CREATE POLICY "user_roles_select_own" ON user_roles FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_roles_select_admin" ON user_roles;
CREATE POLICY "user_roles_select_admin" ON user_roles FOR SELECT
  TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "user_roles_manage" ON user_roles;
CREATE POLICY "user_roles_manage" ON user_roles FOR INSERT
  TO authenticated WITH CHECK (is_admin('super_admin'));

DROP POLICY IF EXISTS "user_roles_update" ON user_roles;
CREATE POLICY "user_roles_update" ON user_roles FOR UPDATE
  TO authenticated
  USING (is_admin('super_admin'))
  WITH CHECK (is_admin('super_admin'));

DROP POLICY IF EXISTS "user_roles_delete" ON user_roles;
CREATE POLICY "user_roles_delete" ON user_roles FOR DELETE
  TO authenticated USING (is_admin('super_admin'));

-- student_verifications (003, 009, 023)
DROP POLICY IF EXISTS "sv_select_own" ON student_verifications;
CREATE POLICY "sv_select_own" ON student_verifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "sv_select_admin" ON student_verifications;
CREATE POLICY "sv_select_admin" ON student_verifications FOR SELECT
  TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "sv_insert_own" ON student_verifications;
DROP POLICY IF EXISTS "sv_update_own" ON student_verifications;
REVOKE INSERT, UPDATE ON TABLE public.student_verifications FROM authenticated;

DROP POLICY IF EXISTS "sv_update_admin" ON student_verifications;
CREATE POLICY "sv_update_admin" ON student_verifications FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (true);

DROP POLICY IF EXISTS "sv_delete_own" ON student_verifications;
CREATE POLICY "sv_delete_own" ON student_verifications FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- verification_audit_logs (007, 023)
DROP POLICY IF EXISTS "val_select_admin" ON verification_audit_logs;
CREATE POLICY "val_select_admin" ON verification_audit_logs FOR SELECT
  TO authenticated USING (is_admin());

-- forum_categories (005)
DROP POLICY IF EXISTS "forum_cat_select" ON forum_categories;
CREATE POLICY "forum_cat_select" ON forum_categories FOR SELECT TO authenticated USING (true);

-- forum_posts (005, 012)
DROP POLICY IF EXISTS "forum_posts_select" ON forum_posts;
CREATE POLICY "forum_posts_select" ON forum_posts FOR SELECT TO authenticated USING (status = 'active' OR author_id = auth.uid());

DROP POLICY IF EXISTS "forum_posts_insert" ON forum_posts;
CREATE POLICY "forum_posts_insert" ON forum_posts FOR INSERT
  TO authenticated WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "forum_posts_update" ON forum_posts;
CREATE POLICY "forum_posts_update" ON forum_posts FOR UPDATE TO authenticated
  USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "forum_posts_delete" ON forum_posts;
CREATE POLICY "forum_posts_delete" ON forum_posts FOR DELETE TO authenticated
  USING (author_id = auth.uid());

-- forum_comments (005)
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

-- forum_reactions (005)
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

-- forum_bookmarks (005)
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

-- forum_tags (005)
DROP POLICY IF EXISTS "forum_tags_select" ON forum_tags;
CREATE POLICY "forum_tags_select" ON forum_tags FOR SELECT TO authenticated USING (true);

-- forum_reports (005, 023)
DROP POLICY IF EXISTS "forum_reports_select" ON forum_reports;
CREATE POLICY "forum_reports_select" ON forum_reports FOR SELECT
  TO authenticated
  USING (reporter_id = auth.uid() OR is_moderator_or_admin());

DROP POLICY IF EXISTS "forum_reports_insert" ON forum_reports;
CREATE POLICY "forum_reports_insert" ON forum_reports FOR INSERT TO authenticated
WITH CHECK (reporter_id = auth.uid());

-- community_post_attachments (019)
DROP POLICY IF EXISTS "attachments_select" ON community_post_attachments;
CREATE POLICY "attachments_select"
  ON community_post_attachments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM communities c
      WHERE c.id = community_post_attachments.community_id
      AND (c.is_private = false OR c.created_by = auth.uid() OR is_community_member(c.id))
    )
  );

DROP POLICY IF EXISTS "attachments_insert_own" ON community_post_attachments;
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

DROP POLICY IF EXISTS "attachments_delete_own" ON community_post_attachments;
CREATE POLICY "attachments_delete_own"
  ON community_post_attachments FOR DELETE TO authenticated
  USING (auth.uid() = uploader_id);

-- community_post_reactions (019)
DROP POLICY IF EXISTS "reactions_select" ON community_post_reactions;
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

DROP POLICY IF EXISTS "reactions_insert_own" ON community_post_reactions;
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

DROP POLICY IF EXISTS "reactions_delete_own" ON community_post_reactions;
CREATE POLICY "reactions_delete_own"
  ON community_post_reactions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- forum_post_attachments (020)
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

-- forum_post_reactions (020)
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

-- friendships (026)
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

-- habit_templates (026)
DROP POLICY IF EXISTS "habit_templates_select" ON habit_templates;
CREATE POLICY "habit_templates_select" ON habit_templates
  FOR SELECT TO authenticated
  USING (true);

-- mood_weekly_summaries (026)
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

-- journal_post_attachments (026)
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

-- journal_post_reactions (026)
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

-- journal_post_comments (026)
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

-- journal_post_shares (026)
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
-- SECTION 9: DEMO & SEED DATA (Idempotent: ON CONFLICT DO NOTHING)
-- ============================================================================

-- 1. Demo Communities (004)
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

-- 2. Demo Challenges (004)
INSERT INTO challenges (title, description, type, duration_days, icon, color, participants_count)
VALUES
  ('7-Day English Challenge', 'Learn 10 new English words every day for a week. Build your vocabulary one day at a time.', 'english', 7, '🌍', 'blue', 342),
  ('30-Day Reading Challenge', 'Read for at least 20 minutes every day for a month. Track your progress and share what you''re reading.', 'reading', 30, '📖', 'amber', 891),
  ('14-Day Coding Challenge', 'Solve one coding problem every day for two weeks. Build your problem-solving skills.', 'coding', 14, '⚡', 'purple', 527),
  ('21-Day Exercise Challenge', '15 minutes of movement every day for three weeks. Build a sustainable exercise habit.', 'exercise', 21, '🏃', 'green', 438),
  ('7-Day Study Challenge', 'Study for at least 2 hours every day for a week. Perfect before exams.', 'study', 7, '📝', 'teal', 612)
ON CONFLICT DO NOTHING;

-- 3. Forum Categories (005)
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

-- 4. Forum Tags (005)
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

-- 5. Predefined Student Habit Templates (026)
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
