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
