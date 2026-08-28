/*
# Challenge Notification System Complete Fix & Enhancements

## Purpose
1. Fix daily challenge reminder formatting: Body contains only Challenge name(s) (e.g., "7-Day English Challenge").
2. Support timezone-aware daily reminders (profiles.timezone).
3. Add user session check function: `check_user_daily_challenge_reminder(p_user_id uuid)`.
4. Add Database Trigger on `challenge_participants` for Challenge Completion (`challenge_completed`).
5. Add Database Trigger on `challenge_participants` for Streak Milestones (`challenge_streak`).
6. Add Database Trigger on `challenge_checkins` for Daily Check-in confirmation (`challenge_checkin`).
7. Enable RLS and proper grants for all challenge notification functions.
*/

-- ============================================================
-- 1. Helper: get challenges a user needs to complete today
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
-- 2. Check and generate daily challenge reminder for a specific user
--    Used both by background batch jobs and on-demand user session load.
-- ============================================================

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
  -- 1. Retrieve user's timezone (defaults to Asia/Ho_Chi_Minh)
  SELECT COALESCE(timezone, 'Asia/Ho_Chi_Minh') INTO v_tz
  FROM profiles
  WHERE id = p_user_id;

  IF v_tz IS NULL OR v_tz = '' THEN
    v_tz := 'Asia/Ho_Chi_Minh';
  END IF;

  v_today := (CURRENT_TIMESTAMP AT TIME ZONE v_tz)::date;

  -- 2. Check if a reminder was already created for today (in user's timezone)
  SELECT count(*) INTO v_existing
  FROM notifications
  WHERE user_id = p_user_id
    AND type = 'daily_challenge_reminder'
    AND (created_at AT TIME ZONE v_tz)::date = v_today;

  IF v_existing > 0 THEN
    RETURN 0;
  END IF;

  -- 3. Get list of active challenges requiring check-in today
  v_titles := ARRAY(SELECT title FROM public.get_user_challenge_reminders(p_user_id, v_today));

  IF array_length(v_titles, 1) IS NULL OR array_length(v_titles, 1) = 0 THEN
    RETURN 0;
  END IF;

  -- 4. Format body: strictly the Challenge name(s) as required
  IF array_length(v_titles, 1) = 1 THEN
    v_body := v_titles[1];
  ELSE
    v_body := array_to_string(v_titles, E'\n');
  END IF;

  -- 5. Insert notification
  INSERT INTO notifications (user_id, type, title, body, link)
  VALUES (p_user_id, 'daily_challenge_reminder', 'Daily Challenge Reminder', v_body, '/app/study');

  RETURN 1;
END;
$$;

-- ============================================================
-- 3. Batch Daily Challenge Reminder Generator
-- ============================================================

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

-- ============================================================
-- 4. Trigger: Challenge Completion Notification
-- ============================================================

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

    -- Avoid duplicate notification
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

-- ============================================================
-- 5. Trigger: Streak Milestone Notification
-- ============================================================

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

-- ============================================================
-- 6. Permissions and Grants
-- ============================================================

GRANT EXECUTE ON FUNCTION public.get_user_challenge_reminders(uuid, date) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.check_user_daily_challenge_reminder(uuid) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.generate_daily_challenge_reminders() TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.generate_weekly_challenge_reports() TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.generate_monthly_challenge_reports() TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.get_challenge_report(uuid, text) TO authenticated, service_role, anon;
