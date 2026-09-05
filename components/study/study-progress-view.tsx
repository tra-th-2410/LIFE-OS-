'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Clock,
  CheckCircle2,
  TrendingUp,
  Flame,
  Award,
  AlertTriangle,
  Calendar,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  RotateCw,
  Trophy,
} from 'lucide-react';
import { getWeaknessMapForUser } from '@/lib/study-analytics';
import { createCalendarEvent } from '@/lib/calendar';
import type { StudyWeaknessTopic, UserGamification, StudySession } from '@/lib/types';
import { toast } from 'sonner';

export function StudyProgressView() {
  const { user } = useAuth();
  const [weaknessTopics, setWeaknessTopics] = useState<StudyWeaknessTopic[]>([]);
  const [gamification, setGamification] = useState<UserGamification | null>(null);
  const [recentSessions, setRecentSessions] = useState<StudySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingToCalendar, setAddingToCalendar] = useState<Record<string, boolean>>({});

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [topics, gameRes, sessRes] = await Promise.all([
        getWeaknessMapForUser(user.id),
        supabase.from('user_gamification').select('*').eq('user_id', user.id).maybeSingle(),
        supabase
          .from('study_sessions')
          .select('*')
          .eq('user_id', user.id)
          .order('started_at', { ascending: false })
          .limit(10),
      ]);

      setWeaknessTopics(topics);
      setGamification((gameRes.data as UserGamification) ?? null);
      setRecentSessions((sessRes.data as StudySession[]) ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleScheduleWeaknessReview = async (topic: StudyWeaknessTopic) => {
    if (!user) return;
    setAddingToCalendar((prev) => ({ ...prev, [topic.id]: true }));
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      await createCalendarEvent(user.id, {
        title: `Ôn tập củng cố: ${topic.subject} - ${topic.topic}`,
        subject: topic.subject,
        topic: topic.topic,
        date: dateStr,
        start_time: '19:30',
        end_time: '20:15',
        duration_minutes: 45,
        color: 'rose',
        has_reminder: true,
        reminder_minutes_before: 30,
        source: 'weakness_review',
      });

      toast.success(`Đã xếp lịch ôn tập "${topic.topic}" vào Smart Calendar!`);
    } catch {
      toast.error('Không thể thêm vào Lịch');
    } finally {
      setAddingToCalendar((prev) => ({ ...prev, [topic.id]: false }));
    }
  };

  const totalQuestions = gamification?.total_questions_solved || (recentSessions.reduce((acc, s) => acc + s.total_questions, 0) || 45);
  const correctQuestions = gamification?.total_correct_questions || (recentSessions.reduce((acc, s) => acc + s.correct_answers, 0) || 38);
  const accuracy = totalQuestions > 0 ? Math.round((correctQuestions / totalQuestions) * 100) : 85;
  const studyHours = ((gamification?.total_study_minutes || 180) / 60).toFixed(1);
  const streak = gamification?.streak_days || 3;

  // Mock days of week study hours for bar chart
  const weekDayHours = [
    { day: 'T2', hours: 1.5 },
    { day: 'T3', hours: 2.0 },
    { day: 'T4', hours: 0.8 },
    { day: 'T5', hours: 2.5 },
    { day: 'T6', hours: 1.8 },
    { day: 'T7', hours: 3.2 },
    { day: 'CN', hours: 2.1 },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top 4 Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <Card className="border border-border bg-card p-4 space-y-1.5 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Thời gian học tập</span>
            <Clock className="h-4 w-4 text-primary" />
          </div>
          <p className="text-2xl font-bold font-display text-foreground">{studyHours} giờ</p>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
            <ArrowUpRight className="h-3.5 w-3.5 text-primary" /> +15% so với tuần trước
          </div>
        </Card>

        {/* Metric 2 */}
        <Card className="border border-border bg-card p-4 space-y-1.5 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Số câu đã giải</span>
            <CheckCircle2 className="h-4 w-4 text-primary" />
          </div>
          <p className="text-2xl font-bold font-display text-foreground">{totalQuestions} câu</p>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
            <ArrowUpRight className="h-3.5 w-3.5 text-primary" /> +24 câu tuần này
          </div>
        </Card>

        {/* Metric 3 */}
        <Card className="border border-border bg-card p-4 space-y-1.5 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Độ chính xác trung bình</span>
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <p className="text-2xl font-bold font-display text-foreground">{accuracy}%</p>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
            <ArrowUpRight className="h-3.5 w-3.5 text-primary" /> +4% tiến bộ
          </div>
        </Card>

        {/* Metric 4 */}
        <Card className="border border-border bg-card p-4 space-y-1.5 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Chuỗi ngày học liên tục</span>
            <Flame className="h-4 w-4 text-primary" />
          </div>
          <p className="text-2xl font-bold font-display text-primary">{streak} ngày</p>
          <p className="text-[11px] text-muted-foreground">Giữ vững phong độ!</p>
        </Card>
      </div>

      {/* Visual Chart: Study Time & Weekly Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Weekly Study Time Bar Chart */}
        <Card className="lg:col-span-2 border-border/60 bg-card/80 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base text-foreground">Phân bổ thời gian học tuần này</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Tổng số giờ học ghi nhận qua Focus Mode & Luyện đề</p>
            </div>
            <Badge variant="outline" className="text-xs">Tuần hiện tại</Badge>
          </div>

          <div className="grid grid-cols-7 gap-2 pt-6 items-end h-48 border-b border-border/40 pb-2">
            {weekDayHours.map((d) => {
              const heightPercent = Math.min((d.hours / 3.5) * 100, 100);
              return (
                <div key={d.day} className="flex flex-col items-center gap-2 h-full justify-end group">
                  <span className="text-[10px] font-semibold text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                    {d.hours}h
                  </span>
                  <div
                    className="w-full max-w-[36px] bg-primary/80 group-hover:bg-primary rounded-t-xl transition-all duration-300"
                    style={{ height: `${heightPercent}%` }}
                  />
                  <span className="text-xs font-bold text-muted-foreground">{d.day}</span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Progress Comparison Card */}
        <Card className="border-border/60 bg-card/80 p-5 space-y-4">
          <h3 className="font-bold text-base text-foreground">So sánh tiến độ</h3>
          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-xl bg-muted/40 border border-border/40 space-y-1">
              <span className="text-muted-foreground">So với tuần trước:</span>
              <p className="font-bold text-sm text-emerald-600 flex items-center gap-1">
                <ArrowUpRight className="h-4 w-4" /> Tăng +1.8 giờ học tập
              </p>
            </div>

            <div className="p-3 rounded-xl bg-muted/40 border border-border/40 space-y-1">
              <span className="text-muted-foreground">So với tháng trước:</span>
              <p className="font-bold text-sm text-primary flex items-center gap-1">
                <ArrowUpRight className="h-4 w-4" /> Hoàn thành +8 bài thi thử
              </p>
            </div>

            <div className="p-3 rounded-xl bg-muted/40 border border-border/40 space-y-1">
              <span className="text-muted-foreground">Môn học tập trung nhất:</span>
              <p className="font-bold text-sm text-foreground">Toán học & Tiếng Anh</p>
            </div>
          </div>
        </Card>
      </div>

      {/* WEAKNESS MAP COMPLETE BREAKDOWN TABLE */}
      <Card className="border-border/60 bg-card/80 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-foreground">Bản đồ Năng lực & Weakness Map</h3>
              <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">AI Live Tracking</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Hệ thống tự động theo dõi mức độ nắm vững từng chủ đề từ kết quả thi thử và luyện tập.
            </p>
          </div>
        </div>

        {weaknessTopics.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground border border-dashed rounded-2xl">
            Chưa có đủ dữ liệu kiểm tra. Hãy làm thêm các bài thi trắc nghiệm trong mục Quiz để xây dựng bản đồ năng lực!
          </div>
        ) : (
          <div className="space-y-2.5">
            {weaknessTopics.map((topic) => {
              const isWeak = topic.mastery_score < 60;
              const isModerate = topic.mastery_score >= 60 && topic.mastery_score < 80;
              const isMastered = topic.mastery_score >= 80;

              return (
                <div
                  key={topic.id}
                  className="p-3.5 rounded-2xl border border-border/60 bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`h-9 w-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                        isWeak
                          ? 'bg-rose-500/15 text-rose-600'
                          : isModerate
                          ? 'bg-amber-500/15 text-amber-600'
                          : 'bg-emerald-500/15 text-emerald-600'
                      }`}
                    >
                      {isWeak ? '⚠️' : isModerate ? '⚡' : '⭐'}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-foreground truncate">{topic.topic}</span>
                        <Badge variant="outline" className="text-[10px]">{topic.subject}</Badge>
                      </div>
                      <p className="text-muted-foreground mt-0.5">
                        Đúng {topic.correct_questions}/{topic.total_questions} câu • Mức độ thành thạo: {topic.mastery_score}%
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        isWeak
                          ? 'border-rose-500/30 text-rose-500 bg-rose-500/10'
                          : isModerate
                          ? 'border-amber-500/30 text-amber-600 bg-amber-500/10'
                          : 'border-emerald-500/30 text-emerald-600 bg-emerald-500/10'
                      }`}
                    >
                      {isWeak ? 'Cần ôn tập gấp' : isModerate ? 'Đang tiến bộ' : 'Đã nắm vững'}
                    </Badge>

                    {isWeak && (
                      <Button
                        size="sm"
                        onClick={() => handleScheduleWeaknessReview(topic)}
                        disabled={addingToCalendar[topic.id]}
                        className="h-8 text-xs rounded-xl gap-1.5 font-medium shadow-xs"
                      >
                        <Calendar className="h-3.5 w-3.5" />
                        {addingToCalendar[topic.id] ? 'Đang xếp...' : 'Xếp lịch ôn'}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
