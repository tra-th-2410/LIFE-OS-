'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';
import { useLanguage } from '@/components/language-provider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles,
  ArrowRight,
  BookOpen,
  Target,
  Bot,
  Heart,
  Trophy,
  Flame,
  Check,
  Calendar,
  Clock,
  TrendingUp,
  Smile,
  Award,
  ChevronRight,
  Plus,
  Compass,
  CheckCircle2,
  Users,
} from 'lucide-react';
import { getDisplayName } from '@/lib/helpers';
import { getCalendarEvents, updateEventStatus } from '@/lib/calendar';
import type {
  SmartCalendarEvent,
  CalendarEventStatus,
  UserGamification,
  ChallengeParticipant,
  Challenge,
  Habit,
  HabitLog,
  MoodEntry,
  StudySession,
} from '@/lib/types';
import { toast } from 'sonner';

function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getPast7DaysArray(): { dateStr: string; label: string; shortDay: string }[] {
  const result: { dateStr: string; label: string; shortDay: string }[] = [];
  const dayNamesVi = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const dayNamesEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    result.push({
      dateStr,
      label: dayNamesVi[d.getDay()],
      shortDay: dayNamesEn[d.getDay()],
    });
  }
  return result;
}

export default function AppHomePage() {
  const { user, profile } = useAuth();
  const { language } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [gamification, setGamification] = useState<UserGamification | null>(null);
  const [todayTasks, setTodayTasks] = useState<SmartCalendarEvent[]>([]);
  const [sevenDaysSessions, setSevenDaysSessions] = useState<StudySession[]>([]);
  const [activeChallenge, setActiveChallenge] = useState<(ChallengeParticipant & { challenge?: Challenge }) | null>(null);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [todayHabitLogs, setTodayHabitLogs] = useState<HabitLog[]>([]);
  const [latestMood, setLatestMood] = useState<MoodEntry | null>(null);
  const [hasJournalToday, setHasJournalToday] = useState(false);
  const [goalsCount, setGoalsCount] = useState(0);
  const [lifetimeActivitiesCount, setLifetimeActivitiesCount] = useState(0);

  const todayStr = useMemo(() => getTodayString(), []);
  const past7Days = useMemo(() => getPast7DaysArray(), []);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      const startDate7DaysAgo = past7Days[0]?.dateStr ?? todayStr;

      const [
        gameRes,
        tasksRes,
        sessRes,
        chRes,
        habitsRes,
        hLogsRes,
        moodRes,
        journalRes,
        allTasksCountRes,
        allSessionsCountRes,
        allChallengesCountRes,
        allHabitsCountRes,
        allJournalsCountRes,
        allMoodsCountRes,
        goalsRes,
      ] = await Promise.all([
        // 1. Gamification
        supabase.from('user_gamification').select('*').eq('user_id', user.id).maybeSingle(),

        // 2. Today's smart calendar tasks
        getCalendarEvents(user.id, todayStr, todayStr),

        // 3. Study sessions for the last 7 days
        supabase
          .from('study_sessions')
          .select('*')
          .eq('user_id', user.id)
          .gte('started_at', `${startDate7DaysAgo}T00:00:00Z`),

        // 4. Active challenge
        supabase
          .from('challenge_participants')
          .select('*, challenge:challenges(*)')
          .eq('user_id', user.id)
          .eq('completed', false)
          .order('joined_at', { ascending: false })
          .limit(1),

        // 5. Habits
        supabase.from('habits').select('*').eq('user_id', user.id).is('archived_at', null),

        // 6. Today habit logs
        supabase.from('habit_logs').select('*').eq('user_id', user.id).eq('completed_date', todayStr),

        // 7. Latest mood entry
        supabase.from('mood_entries').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1),

        // 8. Journal today
        supabase
          .from('journal_entries')
          .select('id, created_at')
          .eq('user_id', user.id)
          .gte('created_at', `${todayStr}T00:00:00Z`)
          .limit(1),

        // 9. All lifetime tasks
        supabase.from('smart_calendar_events').select('id', { count: 'exact', head: true }).eq('user_id', user.id),

        // 10. All lifetime study sessions
        supabase.from('study_sessions').select('id', { count: 'exact', head: true }).eq('user_id', user.id),

        // 11. All lifetime challenge participants
        supabase.from('challenge_participants').select('id', { count: 'exact', head: true }).eq('user_id', user.id),

        // 12. All lifetime habits
        supabase.from('habits').select('id', { count: 'exact', head: true }).eq('user_id', user.id),

        // 13. All lifetime journal entries
        supabase.from('journal_entries').select('id', { count: 'exact', head: true }).eq('user_id', user.id),

        // 14. All lifetime mood entries
        supabase.from('mood_entries').select('id', { count: 'exact', head: true }).eq('user_id', user.id),

        // 15. Goals count
        supabase.from('goals').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      ]);

      setGamification((gameRes.data as UserGamification) ?? null);
      setTodayTasks(tasksRes ?? []);
      setSevenDaysSessions((sessRes.data as StudySession[]) ?? []);

      const chData = (chRes.data as (ChallengeParticipant & { challenge?: Challenge })[]) ?? [];
      setActiveChallenge(chData[0]?.challenge ? chData[0] : null);

      setHabits((habitsRes.data as Habit[]) ?? []);
      setTodayHabitLogs((hLogsRes.data as HabitLog[]) ?? []);
      setLatestMood(((moodRes.data as MoodEntry[]) ?? [])[0] ?? null);
      setHasJournalToday((journalRes.data?.length ?? 0) > 0);
      setGoalsCount(goalsRes.count ?? 0);

      const totalActivities =
        (allTasksCountRes.count ?? 0) +
        (allSessionsCountRes.count ?? 0) +
        (allChallengesCountRes.count ?? 0) +
        (allHabitsCountRes.count ?? 0) +
        (allJournalsCountRes.count ?? 0) +
        (allMoodsCountRes.count ?? 0) +
        (goalsRes.count ?? 0);

      setLifetimeActivitiesCount(totalActivities);
    } catch (err) {
      console.error('Error loading Life OS Home data:', err);
    } finally {
      setLoading(false);
    }
  }, [user, todayStr, past7Days]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Purely automatic detection of New User vs Active/Returning User
  const isNewUser = useMemo(() => {
    const xp = gamification?.xp ?? 0;
    const streak = gamification?.streak_days ?? 0;

    // Meaningful activity check from database
    const hasMeaningfulActivity = xp > 0 || streak > 0 || lifetimeActivitiesCount > 0;

    // Profile completeness check
    const hasProfileName = Boolean(profile?.full_name?.trim() || profile?.display_name?.trim());
    const hasPersonalization = Boolean(
      profile?.bio?.trim() ||
      (profile?.interests && profile.interests.length > 0) ||
      (profile?.skills && profile.skills.length > 0) ||
      (profile?.goals && profile.goals.length > 0)
    );
    const isProfileSetupComplete = hasProfileName && hasPersonalization;

    // Case 1: If user has no meaningful activity at all in the database, they are a NEW USER
    if (!hasMeaningfulActivity) {
      return true;
    }

    // If profile is incomplete and activity is completely 0, they are a NEW USER
    if (!isProfileSetupComplete && lifetimeActivitiesCount === 0 && xp === 0) {
      return true;
    }

    // Case 2 & 3: User has meaningful activity (tasks, study sessions, challenges, habits, journals, etc.) -> ACTIVE USER
    return false;
  }, [gamification, lifetimeActivitiesCount, profile]);

  // Toggle task status
  const handleToggleTask = async (task: SmartCalendarEvent) => {
    const nextStatus: CalendarEventStatus = task.status === 'completed' ? 'todo' : 'completed';
    setTodayTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t))
    );

    try {
      await updateEventStatus(task.id, nextStatus);
      if (nextStatus === 'completed') {
        toast.success(language === 'vi' ? 'Đã hoàn thành nhiệm vụ! 🎉' : 'Task completed! 🎉');
      }
    } catch (err) {
      console.error('Failed to update task status:', err);
      toast.error('Không thể cập nhật trạng thái');
      // Revert
      setTodayTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t))
      );
    }
  };

  // 7-day study minutes aggregation
  const dailyStudyMinutes = useMemo(() => {
    const map: Record<string, number> = {};
    past7Days.forEach((p) => {
      map[p.dateStr] = 0;
    });

    sevenDaysSessions.forEach((s) => {
      const sDate = s.started_at ? s.started_at.split('T')[0] : '';
      if (map[sDate] !== undefined) {
        map[sDate] += Math.round((s.duration_seconds || 0) / 60);
      }
    });

    // Also include today's completed tasks duration
    todayTasks.forEach((t) => {
      if (t.status === 'completed' && map[t.date] !== undefined) {
        map[t.date] += t.duration_minutes || 0;
      }
    });

    return past7Days.map((p) => ({
      dateStr: p.dateStr,
      label: language === 'vi' ? p.label : p.shortDay,
      minutes: map[p.dateStr] ?? 0,
    }));
  }, [past7Days, sevenDaysSessions, todayTasks, language]);

  const totalWeeklyMinutes = useMemo(() => {
    return dailyStudyMinutes.reduce((acc, curr) => acc + curr.minutes, 0);
  }, [dailyStudyMinutes]);

  const maxDailyMinute = useMemo(() => {
    const maxVal = Math.max(...dailyStudyMinutes.map((d) => d.minutes));
    return maxVal > 0 ? maxVal : 60;
  }, [dailyStudyMinutes]);

  // Primary focus task for active user
  const primaryTask = useMemo(() => {
    const uncompleted = todayTasks.find((t) => t.status !== 'completed');
    return uncompleted ?? todayTasks[0] ?? null;
  }, [todayTasks]);

  const completedTasksCount = useMemo(() => {
    return todayTasks.filter((t) => t.status === 'completed').length;
  }, [todayTasks]);

  // Greeting based on current time
  const currentHour = new Date().getHours();
  const greetingText = useMemo(() => {
    const name = getDisplayName(profile);
    if (language === 'vi') {
      if (currentHour >= 5 && currentHour < 12) return `Chào buổi sáng, ${name} 👋`;
      if (currentHour >= 12 && currentHour < 18) return `Chào buổi chiều, ${name} 👋`;
      return `Chào buổi tối, ${name} 👋`;
    } else {
      if (currentHour >= 5 && currentHour < 12) return `Good morning, ${name} 👋`;
      if (currentHour >= 12 && currentHour < 18) return `Good afternoon, ${name} 👋`;
      return `Good evening, ${name} 👋`;
    }
  }, [currentHour, profile, language]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="h-12 w-1/3 rounded-2xl bg-muted/60 animate-pulse" />
        <div className="h-44 w-full rounded-2xl bg-card border border-border animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-28 rounded-2xl bg-card border border-border animate-pulse" />
          <div className="h-28 rounded-2xl bg-card border border-border animate-pulse" />
          <div className="h-28 rounded-2xl bg-card border border-border animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-16">
      {isNewUser ? (
        /* ========================================================================= */
        /*                             NEW USER HOME                                 */
        /* ========================================================================= */
        <div className="space-y-8 animate-in fade-in duration-300">
          {/* Header */}
          <div className="space-y-1.5">
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">
              {language === 'vi'
                ? 'Chào mừng bạn đến với Life OS 👋'
                : 'Welcome to Life OS 👋'}
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground max-w-2xl">
              {language === 'vi'
                ? 'Đây là không gian để bạn học tập, xây dựng thói quen và quản lý cuộc sống theo cách của riêng mình.'
                : 'Your dedicated space to learn, build sustainable habits, and manage your life with clarity.'}
            </p>
          </div>

          {/* Hero Panel */}
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-7 sm:p-10 shadow-xs">
            {/* Subtle organic decorative shape */}
            <div className="absolute right-0 top-0 -mt-12 -mr-12 h-64 w-64 rounded-full bg-accent/40 dark:bg-primary/10 blur-2xl pointer-events-none" />
            <div className="absolute right-24 bottom-0 -mb-8 h-40 w-40 rounded-full bg-primary/10 blur-xl pointer-events-none" />

            <div className="relative z-10 max-w-xl space-y-4">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground text-2xl shadow-2xs">
                🌱
              </div>
              <div className="space-y-2">
                <h2 className="text-xl sm:text-2xl font-display font-bold text-foreground">
                  {language === 'vi' ? 'Xây dựng Life OS của bạn' : 'Build Your Personal Life OS'}
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {language === 'vi'
                    ? 'Thiết lập một vài điều đầu tiên để Life OS có thể đồng hành cùng bạn trong học tập và cuộc sống.'
                    : 'Configure your first few foundations so Life OS can guide and support your daily study and life goals.'}
                </p>
              </div>
              <div className="pt-2">
                <Link href="/app/calendar">
                  <Button className="px-6 py-2.5 rounded-xl font-medium shadow-xs gap-2">
                    {language === 'vi' ? 'Bắt đầu →' : 'Get Started →'}
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          {/* Get Started 4 Choices */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {language === 'vi' ? 'Bạn có thể bắt đầu từ đây' : 'You Can Start From Here'}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <QuickStartCard
                icon={BookOpen}
                title={language === 'vi' ? 'HỌC TẬP' : 'STUDY'}
                subtitle={language === 'vi' ? 'Tạo nhiệm vụ đầu tiên' : 'Create first task'}
                href="/app/calendar"
              />
              <QuickStartCard
                icon={Target}
                title={language === 'vi' ? 'MỤC TIÊU' : 'GOALS'}
                subtitle={language === 'vi' ? 'Đặt mục tiêu cho bản thân' : 'Set a personal goal'}
                href="/app/my-life"
              />
              <QuickStartCard
                icon={Bot}
                title={language === 'vi' ? 'AI STUDY' : 'AI STUDY'}
                subtitle={language === 'vi' ? 'Hỏi AI một câu hỏi' : 'Ask AI a question'}
                href="/app/ai"
              />
              <QuickStartCard
                icon={Heart}
                title={language === 'vi' ? 'CUỘC SỐNG' : 'MY LIFE'}
                subtitle={language === 'vi' ? 'Thiết lập thói quen' : 'Build a daily habit'}
                href="/app/my-life"
              />
            </div>
          </div>

          {/* Journey Section (3 Steps) */}
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-7 space-y-6 shadow-xs">
            <div className="space-y-1">
              <h3 className="font-display font-bold text-base sm:text-lg text-foreground">
                {language === 'vi' ? 'Xây dựng không gian của bạn' : 'Build Your Space'}
              </h3>
              <p className="text-xs text-muted-foreground">
                {language === 'vi'
                  ? '3 bước nền tảng để biến Life OS thành trợ lý cá nhân đắc lực'
                  : '3 core steps to activate your personal productivity center'}
              </p>
            </div>

            {/* Step Progress Line */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
              <JourneyStep
                stepNumber="01"
                title={language === 'vi' ? 'Thiết lập mục tiêu' : 'Set your goals'}
                description={language === 'vi' ? 'Xác định kỳ vọng học tập' : 'Define your study targets'}
                completed={goalsCount > 0}
                href="/app/my-life"
              />
              <JourneyStep
                stepNumber="02"
                title={language === 'vi' ? 'Tạo nhiệm vụ đầu tiên' : 'Create first task'}
                description={language === 'vi' ? 'Lên lịch buổi học hôm nay' : 'Schedule today’s sessions'}
                completed={todayTasks.length > 0}
                href="/app/calendar"
              />
              <JourneyStep
                stepNumber="03"
                title={language === 'vi' ? 'Bắt đầu học' : 'Start learning'}
                description={language === 'vi' ? 'Hoàn thành bài tập & nhận XP' : 'Complete work & earn XP'}
                completed={(gamification?.xp ?? 0) > 0 || sevenDaysSessions.length > 0}
                href="/app/study"
              />
            </div>
          </div>

          {/* AI Helper Compact Card */}
          <div className="rounded-2xl border border-border bg-card p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground text-2xl">
                🤖
              </div>
              <div className="space-y-0.5">
                <h4 className="font-semibold text-sm sm:text-base text-foreground">
                  {language === 'vi' ? 'Bạn cần trợ giúp?' : 'Need a study assistant?'}
                </h4>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {language === 'vi'
                    ? 'Hỏi AI về bài học, bài toán, essay hoặc project.'
                    : 'Ask AI about homework, complex math, essays, or study projects.'}
                </p>
              </div>
            </div>
            <Link href="/app/ai" className="shrink-0">
              <Button
                variant="outline"
                className="border-border bg-card text-foreground hover:bg-accent hover:text-accent-foreground rounded-xl font-medium text-xs sm:text-sm px-4 transition-colors"
              >
                {language === 'vi' ? 'Hỏi AI →' : 'Ask AI →'}
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /*                            ACTIVE USER HOME                               */
        /* ========================================================================= */
        <div className="space-y-8 animate-in fade-in duration-300">
          {/* Active User Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">
                {greetingText}
              </h1>
              <p className="text-sm text-muted-foreground">
                {language === 'vi'
                  ? 'Hôm nay bạn muốn hoàn thành điều gì?'
                  : 'What would you like to achieve today?'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {profile?.verification_status === 'verified' && (
                <Badge className="bg-accent text-accent-foreground border-primary/30 text-xs gap-1.5 py-1 px-3">
                  <Sparkles className="h-3 w-3 text-primary" />
                  {language === 'vi' ? 'Sinh viên đã xác thực' : 'Verified Student'}
                </Badge>
              )}
            </div>
          </div>

          {/* Primary Focus Card ("VIỆC QUAN TRỌNG NHẤT") */}
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-7 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-primary bg-accent/60 px-2.5 py-1 rounded-md">
                {language === 'vi' ? 'VIỆC QUAN TRỌNG NHẤT' : 'PRIMARY FOCUS'}
              </span>
              {primaryTask && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {primaryTask.start_time} - {primaryTask.end_time} ({primaryTask.duration_minutes}m)
                </span>
              )}
            </div>

            {primaryTask ? (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-primary uppercase">
                      {primaryTask.subject || 'HỌC TẬP'}
                    </span>
                    {primaryTask.topic && (
                      <>
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="text-xs text-muted-foreground">{primaryTask.topic}</span>
                      </>
                    )}
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-foreground mt-1">
                    {primaryTask.title}
                  </h2>
                  {primaryTask.description && (
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-2">
                      {primaryTask.description}
                    </p>
                  )}
                </div>

                {/* Progress bar */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {primaryTask.status === 'completed'
                        ? language === 'vi' ? 'Đã hoàn thành' : 'Completed'
                        : language === 'vi' ? 'Đang chờ thực hiện' : 'In Progress'}
                    </span>
                    <span className="font-semibold text-foreground">
                      {primaryTask.status === 'completed' ? '100%' : '80%'}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-border overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300"
                      style={{ width: primaryTask.status === 'completed' ? '100%' : '80%' }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <Button
                    onClick={() => handleToggleTask(primaryTask)}
                    className="rounded-xl text-sm font-medium px-5 gap-2"
                  >
                    {primaryTask.status === 'completed' ? (
                      <>
                        <Check className="h-4 w-4" /> {language === 'vi' ? 'Đã xong' : 'Done'}
                      </>
                    ) : (
                      <>
                        {language === 'vi' ? 'Hoàn thành →' : 'Mark Done →'}
                      </>
                    )}
                  </Button>
                  <Link href="/app/calendar">
                    <Button
                      variant="outline"
                      className="border-border text-foreground hover:bg-accent hover:text-accent-foreground rounded-xl text-sm transition-colors"
                    >
                      {language === 'vi' ? 'Chi tiết lịch' : 'Calendar view'}
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center space-y-3">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-primary">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">
                    {language === 'vi'
                      ? 'Bạn chưa có nhiệm vụ học tập hôm nay.'
                      : 'No study tasks scheduled for today.'}
                  </p>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    {language === 'vi'
                      ? 'Tạo một nhiệm vụ để duy trì nhịp điệu học tập và tích lũy XP.'
                      : 'Schedule a task to stay consistent and level up your Life OS.'}
                  </p>
                </div>
                <Link href="/app/calendar">
                  <Button className="text-xs sm:text-sm rounded-xl mt-2">
                    {language === 'vi' ? 'Tạo nhiệm vụ →' : 'Create Task →'}
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {/* Quick Stats (3 horizontal stats) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              icon={Flame}
              label={language === 'vi' ? 'Chuỗi học' : 'Study Streak'}
              value={`${gamification?.streak_days || 0} ${language === 'vi' ? 'ngày' : 'days'}`}
              sub={language === 'vi' ? 'Duy trì liên tục' : 'Current streak'}
            />
            <StatCard
              icon={Award}
              label={language === 'vi' ? 'Kinh nghiệm' : 'Experience'}
              value={`${(gamification?.xp || 0).toLocaleString()} XP`}
              sub={`${language === 'vi' ? 'Cấp' : 'Level'} ${gamification?.level || 1}`}
            />
            <StatCard
              icon={BookOpen}
              label={language === 'vi' ? 'Hôm nay' : 'Today'}
              value={`${completedTasksCount} / ${todayTasks.length} ${language === 'vi' ? 'nhiệm vụ' : 'tasks'}`}
              sub={
                todayTasks.length > 0 && completedTasksCount === todayTasks.length
                  ? language === 'vi' ? 'Hoàn thành tất cả' : 'All done'
                  : language === 'vi' ? 'Tiến độ hoàn thành' : 'Progress today'
              }
            />
          </div>

          {/* 2-Column Dashboard Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              {/* Today's Tasks ("VIỆC HÔM NAY") */}
              <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display font-bold text-base text-foreground">
                      {language === 'vi' ? 'VIỆC HÔM NAY' : "TODAY'S TASKS"}
                    </h3>
                    <Badge className="bg-accent text-accent-foreground text-[11px] font-semibold border-0">
                      {todayTasks.length}
                    </Badge>
                  </div>
                  <Link
                    href="/app/calendar"
                    className="text-xs font-medium text-primary hover:text-primary/80 hover:underline flex items-center gap-1 transition-colors"
                  >
                    {language === 'vi' ? 'Xem lịch →' : 'Open calendar →'}
                  </Link>
                </div>

                {todayTasks.length === 0 ? (
                  <div className="py-8 text-center space-y-2 border border-dashed border-border rounded-xl">
                    <p className="text-sm font-medium text-foreground">
                      {language === 'vi' ? 'Chưa có nhiệm vụ hôm nay.' : 'No tasks scheduled today.'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {language === 'vi' ? 'Bắt đầu ngày mới với một kế hoạch rõ ràng.' : 'Plan your study sessions for today.'}
                    </p>
                    <Link href="/app/calendar">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-border text-foreground hover:bg-accent hover:text-accent-foreground rounded-xl text-xs mt-2 transition-colors"
                      >
                        {language === 'vi' ? 'Tạo nhiệm vụ đầu tiên →' : 'Create first task →'}
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {todayTasks.slice(0, 5).map((task) => {
                      const isDone = task.status === 'completed';
                      return (
                        <div
                          key={task.id}
                          className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                            isDone
                              ? 'bg-muted/40 border-transparent text-muted-foreground'
                              : 'bg-card border-border hover:border-primary/40 text-card-foreground'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <button
                              onClick={() => handleToggleTask(task)}
                              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                                isDone
                                  ? 'bg-primary border-primary text-primary-foreground'
                                  : 'border-border hover:border-primary'
                              }`}
                              aria-label="Toggle task status"
                            >
                              {isDone && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                            </button>

                            <span className="text-xs font-mono text-muted-foreground shrink-0">
                              {task.start_time}
                            </span>

                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 border-border bg-accent/40 text-accent-foreground shrink-0 uppercase"
                            >
                              {task.subject || 'Study'}
                            </Badge>

                            <span
                              className={`text-sm truncate font-medium ${
                                isDone ? 'line-through text-muted-foreground' : 'text-foreground'
                              }`}
                            >
                              {task.title}
                            </span>
                          </div>

                          <span className="text-[11px] text-muted-foreground shrink-0 ml-2">
                            {task.duration_minutes}m
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Study Progress Chart ("TIẾN ĐỘ HỌC") */}
              <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-display font-bold text-base text-foreground">
                      {language === 'vi' ? 'TIẾN ĐỘ HỌC' : 'STUDY PROGRESS'}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {Math.floor(totalWeeklyMinutes / 60)}h {totalWeeklyMinutes % 60}m{' '}
                      {language === 'vi' ? 'tuần này' : 'this week'}
                    </p>
                  </div>
                  <Link
                    href="/app/study?tab=progress"
                    className="text-xs font-medium text-primary hover:text-primary/80 hover:underline transition-colors"
                  >
                    {language === 'vi' ? 'Chi tiết →' : 'Details →'}
                  </Link>
                </div>

                {/* 7-day Bar Chart */}
                <div className="pt-4">
                  <div className="grid grid-cols-7 gap-2 items-end h-32 border-b border-border pb-2">
                    {dailyStudyMinutes.map((day, idx) => {
                      const heightPercent =
                        day.minutes > 0
                          ? Math.max(12, Math.round((day.minutes / maxDailyMinute) * 100))
                          : 4;
                      return (
                        <div key={idx} className="flex flex-col items-center gap-1.5 h-full justify-end group">
                          <div className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity font-mono">
                            {day.minutes > 0 ? `${day.minutes}m` : '0'}
                          </div>
                          <div
                            className={`w-full max-w-[28px] rounded-t-md transition-all duration-300 group-hover:brightness-95 ${
                              day.minutes > 0 ? 'bg-primary' : 'bg-border dark:bg-muted'
                            }`}
                            style={{
                              height: `${heightPercent}%`,
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                  {/* Day labels */}
                  <div className="grid grid-cols-7 gap-2 pt-2 text-center">
                    {dailyStudyMinutes.map((day, idx) => (
                      <span key={idx} className="text-[11px] font-medium text-muted-foreground">
                        {day.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column (5 cols) */}
            <div className="lg:col-span-5 space-y-6">
              {/* Active Challenge Card */}
              <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                    {language === 'vi' ? 'THỬ THÁCH' : 'ACTIVE CHALLENGE'}
                  </span>
                  <Link
                    href="/app/study?tab=challenges"
                    className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {language === 'vi' ? 'Tất cả →' : 'All →'}
                  </Link>
                </div>

                {activeChallenge && activeChallenge.challenge ? (
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">
                        {activeChallenge.challenge.icon || '🏆'}
                      </span>
                      <div className="min-w-0">
                        <h4 className="font-semibold text-sm text-foreground truncate">
                          {activeChallenge.challenge.title}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {language === 'vi' ? 'Ngày' : 'Day'}{' '}
                          {Math.min(
                            activeChallenge.streak + 1,
                            activeChallenge.challenge.duration_days
                          )}{' '}
                          / {activeChallenge.challenge.duration_days}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{activeChallenge.progress || 0}%</span>
                        <span className="text-foreground font-medium">
                          🔥 {activeChallenge.streak || 0} {language === 'vi' ? 'ngày streak' : 'd streak'}
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-border overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${activeChallenge.progress || 0}%` }}
                        />
                      </div>
                    </div>

                    <Link href="/app/study?tab=challenges">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full border-border text-foreground hover:bg-accent hover:text-accent-foreground rounded-xl text-xs mt-1 transition-colors"
                      >
                        {language === 'vi' ? 'Xem thử thách →' : 'View challenge →'}
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="py-4 text-center space-y-2">
                    <p className="text-xs text-muted-foreground">
                      {language === 'vi'
                        ? 'Bạn chưa tham gia thử thách nào.'
                        : 'No active challenges joined yet.'}
                    </p>
                    <Link href="/app/study?tab=challenges">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-border text-foreground hover:bg-accent hover:text-accent-foreground rounded-xl text-xs transition-colors"
                      >
                        {language === 'vi' ? 'Khám phá thử thách →' : 'Explore challenges →'}
                      </Button>
                    </Link>
                  </div>
                )}
              </div>

              {/* AI Study Card */}
              <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent text-base text-accent-foreground">
                    🤖
                  </div>
                  <div>
                    <h4 className="font-semibold text-xs text-foreground">AI Study</h4>
                    <p className="text-[11px] text-muted-foreground">
                      {language === 'vi' ? 'Cần trợ giúp học tập?' : 'Need study help?'}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {language === 'vi'
                    ? 'Hỏi AI về bài học, bài toán, essay hoặc project.'
                    : 'Ask questions about complex lessons, math solutions, or essay feedback.'}
                </p>
                <Link href="/app/ai" className="block pt-1">
                  <Button
                    size="sm"
                    variant="ai"
                    className="w-full rounded-xl text-xs font-medium"
                  >
                    {language === 'vi' ? 'Hỏi AI →' : 'Ask AI →'}
                  </Button>
                </Link>
              </div>

              {/* My Life Preview ("CUỘC SỐNG") */}
              <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                    {language === 'vi' ? 'CUỘC SỐNG' : 'MY LIFE'}
                  </span>
                  <Link
                    href="/app/my-life"
                    className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {language === 'vi' ? 'Mở My Life →' : 'Open →'}
                  </Link>
                </div>

                <div className="space-y-2 text-xs">
                  {/* Journal */}
                  <Link
                    href="/app/my-life"
                    className="group flex items-center justify-between p-2.5 rounded-xl border border-border bg-card hover:bg-accent/40 transition-colors"
                  >
                    <span className="flex items-center gap-2 text-foreground font-medium">
                      🌿 {language === 'vi' ? 'Nhật ký' : 'Journal'}
                    </span>
                    <span className="text-xs text-muted-foreground group-hover:text-primary transition-colors flex items-center gap-1">
                      {hasJournalToday
                        ? language === 'vi' ? 'Đã viết hôm nay ✓' : 'Written today ✓'
                        : language === 'vi' ? 'Viết nhật ký hôm nay →' : 'Write today →'}
                    </span>
                  </Link>

                  {/* Habits */}
                  <Link
                    href="/app/my-life"
                    className="group flex items-center justify-between p-2.5 rounded-xl border border-border bg-card hover:bg-accent/40 transition-colors"
                  >
                    <span className="flex items-center gap-2 text-foreground font-medium">
                      ✓ {language === 'vi' ? 'Thói quen' : 'Habits'}
                    </span>
                    <span className="text-xs text-muted-foreground group-hover:text-primary transition-colors">
                      {todayHabitLogs.length} / {habits.length}{' '}
                      {language === 'vi' ? 'hoàn thành →' : 'completed →'}
                    </span>
                  </Link>

                  {/* Mood */}
                  <Link
                    href="/app/my-life"
                    className="group flex items-center justify-between p-2.5 rounded-xl border border-border bg-card hover:bg-accent/40 transition-colors"
                  >
                    <span className="flex items-center gap-2 text-foreground font-medium">
                      ☁ {language === 'vi' ? 'Tâm trạng' : 'Mood'}
                    </span>
                    <span className="text-xs text-muted-foreground group-hover:text-primary transition-colors">
                      {latestMood
                        ? `${latestMood.mood}/5`
                        : language === 'vi'
                        ? 'Hôm nay bạn thế nào?'
                        : 'How are you feeling?'}
                    </span>
                  </Link>
                </div>
              </div>

              {/* Community CTA */}
              <div className="rounded-2xl border border-border bg-card p-5 flex items-center justify-between shadow-xs">
                <div className="space-y-0.5">
                  <h4 className="font-semibold text-xs text-foreground">
                    {language === 'vi' ? 'Cộng đồng học sinh' : 'Student Community'}
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    {language === 'vi' ? 'Chia sẻ tài liệu & tìm bạn cùng học' : 'Share study decks & find study buddies'}
                  </p>
                </div>
                <Link href="/app/community">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-border text-foreground hover:bg-accent hover:text-accent-foreground rounded-xl text-xs shrink-0 transition-colors"
                  >
                    {language === 'vi' ? 'Khám phá →' : 'Explore →'}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 flex items-center gap-4 shadow-xs">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <p className="text-lg font-bold text-foreground tracking-tight">{value}</p>
        <p className="text-[11px] text-muted-foreground truncate">{sub}</p>
      </div>
    </div>
  );
}

function QuickStartCard({
  icon: Icon,
  title,
  subtitle,
  href,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  href: string;
}) {
  return (
    <Link href={href} className="block group">
      <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3.5 hover:border-primary/40 hover:bg-accent/30 transition-all shadow-2xs cursor-pointer">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0">
          <h4 className="text-[11px] font-bold text-primary tracking-wider uppercase">
            {title}
          </h4>
          <p className="text-xs font-medium text-foreground group-hover:text-primary transition-colors truncate">
            {subtitle}
          </p>
        </div>
      </div>
    </Link>
  );
}

function JourneyStep({
  stepNumber,
  title,
  description,
  completed,
  href,
}: {
  stepNumber: string;
  title: string;
  description: string;
  completed: boolean;
  href: string;
}) {
  return (
    <Link href={href} className="block group">
      <div
        className={`p-4 rounded-xl border transition-all ${
          completed
            ? 'border-primary/40 bg-accent/30'
            : 'border-border bg-card hover:border-primary/40 hover:bg-accent/20'
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-mono font-bold text-primary">
            {stepNumber}
          </span>
          <div
            className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
              completed
                ? 'bg-primary text-primary-foreground'
                : 'border border-border text-muted-foreground'
            }`}
          >
            {completed ? '✓' : '○'}
          </div>
        </div>
        <h4 className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
          {title}
        </h4>
        <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>
      </div>
    </Link>
  );
}
