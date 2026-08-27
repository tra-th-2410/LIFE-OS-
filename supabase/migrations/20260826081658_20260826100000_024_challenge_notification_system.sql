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
