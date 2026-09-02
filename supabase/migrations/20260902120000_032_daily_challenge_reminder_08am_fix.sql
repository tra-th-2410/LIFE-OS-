/*
# Migration: 032_daily_challenge_reminder_08am_fix.sql
# Description: Daily Study Challenge Reminder (08:00 AM) System Fix & Scheduler
# 1. get_user_challenge_reminders: gets active challenges needing checkin for a date
# 2. check_user_daily_challenge_reminder: timezone-aware (08:00 AM user time) single-user reminder with duplicate prevention
# 3. generate_daily_challenge_reminders: batch runner for cron / scheduled functions
# 4. Preserves independent Streak Milestone (challenge_streak) and Challenge Completed triggers
*/

-- ============================================================================
-- 1. Helper: get active challenges a user needs to complete for a given date
-- ============================================================================

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
    AND (c.start_date IS NULL OR c.start_date <= p_date)
    AND NOT EXISTS (
      SELECT 1 FROM challenge_checkins ci
      WHERE ci.challenge_id = c.id
        AND ci.user_id = p_user_id
        AND ci.checkin_date = p_date
    );
  RETURN;
END;
$$;

-- ============================================================================
-- 2. Check and generate daily challenge reminder for a specific user
--    - Timezone-aware: Uses profiles.timezone (default Asia/Ho_Chi_Minh)
--    - 08:00 AM condition: Only triggers when local hour >= 8 (unless p_force = true)
--    - Strict deduplication: Max 1 reminder per user per calendar day
--    - Clear Title: "📚 Time to study!"
--    - Clear Body: "You have a task to complete in {Challenge} today."
--    - Action Link: "/app/study"
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_user_daily_challenge_reminder(
  p_user_id uuid,
  p_force boolean DEFAULT false
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tz text := 'Asia/Ho_Chi_Minh';
  v_local_now timestamp with time zone;
  v_today date;
  v_hour integer;
  v_titles text[];
  v_body text;
  v_existing integer;
BEGIN
  -- 1. Retrieve user's timezone (defaults to Asia/Ho_Chi_Minh)
  SELECT COALESCE(timezone, 'Asia/Ho_Chi_Minh') INTO v_tz
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_tz IS NULL OR v_tz = '' THEN
    v_tz := 'Asia/Ho_Chi_Minh';
  END IF;

  -- 2. Compute local time in user's timezone
  BEGIN
    v_local_now := CURRENT_TIMESTAMP AT TIME ZONE v_tz;
  EXCEPTION WHEN OTHERS THEN
    v_tz := 'Asia/Ho_Chi_Minh';
    v_local_now := CURRENT_TIMESTAMP AT TIME ZONE v_tz;
  END;

  v_today := v_local_now::date;
  v_hour := EXTRACT(HOUR FROM v_local_now)::integer;

  -- 3. Check 08:00 AM threshold (skip if before 08:00 AM local time unless forced)
  IF NOT p_force AND v_hour < 8 THEN
    RETURN 0;
  END IF;

  -- 4. Check if a daily challenge reminder was already created for today
  SELECT count(*) INTO v_existing
  FROM public.notifications
  WHERE user_id = p_user_id
    AND type = 'daily_challenge_reminder'
    AND (created_at AT TIME ZONE v_tz)::date = v_today;

  IF v_existing > 0 THEN
    RETURN 0;
  END IF;

  -- 5. Get list of active challenges requiring check-in today
  v_titles := ARRAY(SELECT title FROM public.get_user_challenge_reminders(p_user_id, v_today));

  IF array_length(v_titles, 1) IS NULL OR array_length(v_titles, 1) = 0 THEN
    RETURN 0;
  END IF;

  -- 6. Format body message as requested
  IF array_length(v_titles, 1) = 1 THEN
    v_body := 'You have a task to complete in ' || v_titles[1] || ' today.';
  ELSE
    v_body := 'You have tasks to complete in ' || array_to_string(v_titles, ', ') || ' today.';
  END IF;

  -- 7. Insert notification into notifications table
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (
    p_user_id,
    'daily_challenge_reminder',
    '📚 Time to study!',
    v_body,
    '/app/study'
  );

  RETURN 1;
END;
$$;

-- Overload without arguments for backward compatibility
CREATE OR REPLACE FUNCTION public.check_user_daily_challenge_reminder(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.check_user_daily_challenge_reminder(p_user_id, false);
END;
$$;

-- ============================================================================
-- 3. Batch Daily Challenge Reminder Generator
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generate_daily_challenge_reminders(p_force boolean DEFAULT false)
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
    FROM public.challenge_participants cp
    INNER JOIN public.challenges c ON c.id = cp.challenge_id
    WHERE c.status = 'active' AND cp.completed = false
  LOOP
    v_res := public.check_user_daily_challenge_reminder(v_user_id, p_force);
    v_count := v_count + v_res;
  END LOOP;

  RETURN v_count;
END;
$$;

-- Overload without arguments
CREATE OR REPLACE FUNCTION public.generate_daily_challenge_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.generate_daily_challenge_reminders(false);
END;
$$;

-- ============================================================================
-- 4. Permissions & Grants
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.get_user_challenge_reminders(uuid, date) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.check_user_daily_challenge_reminder(uuid, boolean) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.check_user_daily_challenge_reminder(uuid) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.generate_daily_challenge_reminders(boolean) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.generate_daily_challenge_reminders() TO authenticated, service_role, anon;
