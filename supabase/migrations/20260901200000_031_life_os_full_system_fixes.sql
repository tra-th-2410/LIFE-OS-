/*
# Migration: 031_life_os_full_system_fixes.sql
# Description: Full System Architecture & Security Fixes:
# 1. Automatic Profile & Gamification Creation Trigger on auth.users (Signup/OAuth)
# 2. Backfill existing auth.users without profiles
# 3. Notification System Upgrade: Friendship triggers, direct notification helpers, safe RLS
# 4. Chat & Direct Messaging Engine: 1-on-1 direct rooms support, get_or_create_direct_room helper
# 5. Study Library: Storage Bucket & Policies, mime_type column
# 6. Journal Social Visibility RLS Verification & Constraints
# 7. Supabase Realtime Publications & Replica Identities
*/

-- ============================================================================
-- 1. AUTOMATIC PROFILE & GAMIFICATION CREATION TRIGGER (AUTH.USERS)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username text;
  v_display_name text;
  v_avatar_url text;
  v_base_username text;
  v_count integer := 0;
BEGIN
  -- Extract username from metadata or email
  v_base_username := COALESCE(
    NEW.raw_user_meta_data->>'user_name',
    NEW.raw_user_meta_data->>'username',
    NULLIF(split_part(NEW.email, '@', 1), ''),
    'user_' || substr(NEW.id::text, 1, 6)
  );

  -- Sanitize username (alphanumeric and underscore only)
  v_base_username := regexp_replace(v_base_username, '[^a-zA-Z0-9_]', '', 'g');
  IF v_base_username IS NULL OR v_base_username = '' THEN
    v_base_username := 'user_' || substr(NEW.id::text, 1, 6);
  END IF;

  v_username := v_base_username;

  -- Ensure username uniqueness
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = v_username AND id != NEW.id) LOOP
    v_count := v_count + 1;
    v_username := v_base_username || '_' || v_count;
  END LOOP;

  -- Extract display name & full name
  v_display_name := COALESCE(
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    v_username
  );

  -- Extract avatar URL
  v_avatar_url := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture',
    NULL
  );

  -- 1. Insert/Update Profile
  INSERT INTO public.profiles (
    id,
    username,
    display_name,
    full_name,
    avatar_url,
    verification_status,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    v_username,
    v_display_name,
    v_display_name,
    v_avatar_url,
    'basic',
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name),
    full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
    avatar_url = COALESCE(public.profiles.avatar_url, EXCLUDED.avatar_url),
    updated_at = now();

  -- 2. Insert Default Gamification Row if not exists
  INSERT INTO public.user_gamification (
    user_id,
    xp,
    level,
    streak_days,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    0,
    1,
    0,
    now(),
    now()
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never abort auth signup even if profile trigger meets conflict
  RAISE WARNING 'handle_new_user error for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- Drop and recreate trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Backfill all existing auth.users without profiles
DO $$
DECLARE
  r RECORD;
  v_uname text;
  v_dname text;
BEGIN
  FOR r IN 
    SELECT u.id, u.email, u.raw_user_meta_data 
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    WHERE p.id IS NULL
  LOOP
    v_uname := COALESCE(
      r.raw_user_meta_data->>'user_name',
      r.raw_user_meta_data->>'username',
      NULLIF(split_part(r.email, '@', 1), ''),
      'user_' || substr(r.id::text, 1, 6)
    );
    v_uname := regexp_replace(v_uname, '[^a-zA-Z0-9_]', '', 'g');
    IF v_uname IS NULL OR v_uname = '' THEN
      v_uname := 'user_' || substr(r.id::text, 1, 6);
    END IF;

    v_dname := COALESCE(
      r.raw_user_meta_data->>'display_name',
      r.raw_user_meta_data->>'full_name',
      r.raw_user_meta_data->>'name',
      v_uname
    );

    INSERT INTO public.profiles (
      id, username, display_name, full_name, avatar_url, verification_status, created_at, updated_at
    )
    VALUES (
      r.id, v_uname, v_dname, v_dname, r.raw_user_meta_data->>'avatar_url', 'basic', now(), now()
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.user_gamification (user_id, xp, level, streak_days, created_at, updated_at)
    VALUES (r.id, 0, 1, 0, now(), now())
    ON CONFLICT (user_id) DO NOTHING;
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;


-- ============================================================================
-- 2. NOTIFICATIONS SYSTEM UPGRADE & TRIGGERS
-- ============================================================================

-- Helper function to insert system/social notification safely
CREATE OR REPLACE FUNCTION public.create_system_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_link text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notif_id uuid;
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (p_user_id, p_type, p_title, p_body, p_link)
  RETURNING id INTO v_notif_id;

  RETURN v_notif_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_system_notification(uuid, text, text, text, text) TO authenticated, service_role;

-- Trigger: Notify on Friendship Events
CREATE OR REPLACE FUNCTION public.notify_friendship_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_name text;
  v_receiver_name text;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    SELECT COALESCE(display_name, username, 'Một người dùng') INTO v_sender_name
    FROM public.profiles WHERE id = NEW.user_id;

    PERFORM public.create_system_notification(
      NEW.friend_id,
      'friend_request',
      'Lời mời kết bạn mới 👋',
      v_sender_name || ' đã gửi cho bạn một lời mời kết bạn.',
      '/app/my-life'
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'accepted' THEN
    SELECT COALESCE(display_name, username, 'Một người dùng') INTO v_receiver_name
    FROM public.profiles WHERE id = NEW.friend_id;

    PERFORM public.create_system_notification(
      NEW.user_id,
      'friend_accepted',
      'Lời mời kết bạn được chấp nhận 🎉',
      v_receiver_name || ' đã đồng ý kết bạn! Giờ đây các bạn có thể trò chuyện và xem nhật ký của nhau.',
      '/app/my-life'
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_friendship_events ON public.friendships;
CREATE TRIGGER trg_friendship_events
  AFTER INSERT OR UPDATE ON public.friendships
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_friendship_events();

-- Ensure proper RLS on notifications table
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.notifications TO authenticated;

DROP POLICY IF EXISTS "notif_select_own" ON public.notifications;
CREATE POLICY "notif_select_own" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notif_insert_own" ON public.notifications;
DROP POLICY IF EXISTS "notif_insert" ON public.notifications;
CREATE POLICY "notif_insert_own" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notif_update_own" ON public.notifications;
CREATE POLICY "notif_update_own" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notif_delete_own" ON public.notifications;
CREATE POLICY "notif_delete_own" ON public.notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);


-- ============================================================================
-- 3. CHAT & DIRECT MESSAGES ARCHITECTURE
-- ============================================================================

-- Add 1-on-1 direct message support to study_groups
DO $$ BEGIN
  ALTER TABLE public.study_groups ADD COLUMN IF NOT EXISTS is_direct BOOLEAN NOT NULL DEFAULT false;
  ALTER TABLE public.study_groups ADD COLUMN IF NOT EXISTS direct_user1 UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
  ALTER TABLE public.study_groups ADD COLUMN IF NOT EXISTS direct_user2 UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_study_groups_direct ON public.study_groups(is_direct, direct_user1, direct_user2);

-- Function: get or create direct messaging room between 2 users
CREATE OR REPLACE FUNCTION public.get_or_create_direct_room(p_other_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_user_id UUID;
  v_u1 UUID;
  v_u2 UUID;
  v_room RECORD;
  v_other_profile RECORD;
  v_room_id UUID;
BEGIN
  v_current_user_id := auth.uid();
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_current_user_id = p_other_user_id THEN
    RAISE EXCEPTION 'Cannot create direct chat room with yourself';
  END IF;

  -- Ensure consistent ordering to find existing room
  IF v_current_user_id < p_other_user_id THEN
    v_u1 := v_current_user_id;
    v_u2 := p_other_user_id;
  ELSE
    v_u1 := p_other_user_id;
    v_u2 := v_current_user_id;
  END IF;

  -- Check if direct room already exists
  SELECT * INTO v_room
  FROM public.study_groups
  WHERE is_direct = true AND direct_user1 = v_u1 AND direct_user2 = v_u2
  LIMIT 1;

  IF v_room.id IS NOT NULL THEN
    -- Ensure both users are members in study_group_members
    INSERT INTO public.study_group_members (group_id, user_id, role)
    VALUES (v_room.id, v_current_user_id, 'member')
    ON CONFLICT (group_id, user_id) DO NOTHING;

    INSERT INTO public.study_group_members (group_id, user_id, role)
    VALUES (v_room.id, p_other_user_id, 'member')
    ON CONFLICT (group_id, user_id) DO NOTHING;

    RETURN to_jsonb(v_room);
  END IF;

  -- Get other user profile for room naming
  SELECT username, display_name INTO v_other_profile
  FROM public.profiles WHERE id = p_other_user_id;

  -- Create new direct chat room
  INSERT INTO public.study_groups (
    name,
    slug,
    description,
    subject,
    creator_id,
    is_direct,
    direct_user1,
    direct_user2,
    members_count
  )
  VALUES (
    COALESCE(v_other_profile.display_name, v_other_profile.username, 'Direct Chat'),
    'dm-' || v_u1 || '-' || v_u2 || '-' || extract(epoch from now())::bigint,
    'Trò chuyện trực tiếp',
    'general',
    v_current_user_id,
    true,
    v_u1,
    v_u2,
    2
  )
  RETURNING * INTO v_room;

  -- Add both users as members
  INSERT INTO public.study_group_members (group_id, user_id, role)
  VALUES
    (v_room.id, v_current_user_id, 'owner'),
    (v_room.id, p_other_user_id, 'member')
  ON CONFLICT (group_id, user_id) DO NOTHING;

  RETURN to_jsonb(v_room);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_direct_room(UUID) TO authenticated;

-- Upgrade RLS policies for study_groups to respect direct chats
DROP POLICY IF EXISTS "study_groups_select" ON public.study_groups;
CREATE POLICY "study_groups_select" ON public.study_groups
  FOR SELECT TO authenticated
  USING (
    is_direct = false
    OR auth.uid() = direct_user1
    OR auth.uid() = direct_user2
    OR auth.uid() = creator_id
  );

-- Trigger: Auto-notify receiver on new chat message in direct room
CREATE OR REPLACE FUNCTION public.notify_chat_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group RECORD;
  v_sender_name text;
  v_recipient_id uuid;
BEGIN
  SELECT is_direct, direct_user1, direct_user2, name INTO v_group
  FROM public.study_groups
  WHERE id = NEW.group_id;

  IF v_group.is_direct = true THEN
    IF NEW.sender_id = v_group.direct_user1 THEN
      v_recipient_id := v_group.direct_user2;
    ELSE
      v_recipient_id := v_group.direct_user1;
    END IF;

    IF v_recipient_id IS NOT NULL THEN
      SELECT COALESCE(display_name, username, 'Bạn bè') INTO v_sender_name
      FROM public.profiles WHERE id = NEW.sender_id;

      PERFORM public.create_system_notification(
        v_recipient_id,
        'chat_message',
        'Tin nhắn mới từ ' || v_sender_name || ' 💬',
        substr(NEW.content, 1, 100),
        '/app/community'
      );
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_chat_message ON public.study_group_messages;
CREATE TRIGGER trg_notify_chat_message
  AFTER INSERT ON public.study_group_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_chat_message();


-- ============================================================================
-- 4. STUDY LIBRARY (STORAGE BUCKET & TABLE UPGRADES)
-- ============================================================================

-- Add mime_type column to study_materials
DO $$ BEGIN
  ALTER TABLE public.study_materials ADD COLUMN IF NOT EXISTS mime_type TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Create Storage Bucket: study_materials
INSERT INTO storage.buckets (id, name, public)
VALUES ('study_materials', 'study_materials', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage Policies for study_materials bucket
DROP POLICY IF EXISTS "study_materials_storage_select" ON storage.objects;
CREATE POLICY "study_materials_storage_select" ON storage.objects
  FOR SELECT TO authenticated, anon
  USING (bucket_id = 'study_materials');

DROP POLICY IF EXISTS "study_materials_storage_insert" ON storage.objects;
CREATE POLICY "study_materials_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'study_materials');

DROP POLICY IF EXISTS "study_materials_storage_update" ON storage.objects;
CREATE POLICY "study_materials_storage_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'study_materials');

DROP POLICY IF EXISTS "study_materials_storage_delete" ON storage.objects;
CREATE POLICY "study_materials_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'study_materials');


-- ============================================================================
-- 5. JOURNAL PERMISSIONS & VISIBILITY POLICIES
-- ============================================================================

-- Enforce strict RLS on journal_entries
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.journal_entries TO authenticated;

DROP POLICY IF EXISTS "journal_select_social" ON public.journal_entries;
CREATE POLICY "journal_select_social" ON public.journal_entries
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR visibility = 'public'
    OR (visibility = 'friends' AND public.are_friends(auth.uid(), user_id))
  );

DROP POLICY IF EXISTS "journal_insert_own" ON public.journal_entries;
CREATE POLICY "journal_insert_own" ON public.journal_entries
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "journal_update_own" ON public.journal_entries;
CREATE POLICY "journal_update_own" ON public.journal_entries
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "journal_delete_own" ON public.journal_entries;
CREATE POLICY "journal_delete_own" ON public.journal_entries
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);


-- ============================================================================
-- 6. REALTIME PUBLICATIONS & REPLICA IDENTITY
-- ============================================================================

-- Enable REPLICA IDENTITY FULL for clean delete/update payloads
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.study_group_messages REPLICA IDENTITY FULL;
ALTER TABLE public.friendships REPLICA IDENTITY FULL;
ALTER TABLE public.journal_entries REPLICA IDENTITY FULL;
ALTER TABLE public.study_materials REPLICA IDENTITY FULL;

-- Add tables to supabase_realtime publication safely
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  EXCEPTION WHEN duplicate_object THEN NULL; WHEN OTHERS THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.study_group_messages;
  EXCEPTION WHEN duplicate_object THEN NULL; WHEN OTHERS THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;
  EXCEPTION WHEN duplicate_object THEN NULL; WHEN OTHERS THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.study_groups;
  EXCEPTION WHEN duplicate_object THEN NULL; WHEN OTHERS THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.journal_entries;
  EXCEPTION WHEN duplicate_object THEN NULL; WHEN OTHERS THEN NULL;
  END;
END $$;
