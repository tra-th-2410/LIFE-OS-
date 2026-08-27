'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Heart,
  TrendingUp,
  BookOpen,
  Target,
  Sparkles,
  Plus,
  Loader2,
  Calendar,
  CheckCircle2,
} from 'lucide-react';
import { JournalFeed } from '@/components/my-life/journal-feed';
import { HabitTracker } from '@/components/my-life/habit-tracker';
import { MoodCheckin } from '@/components/my-life/mood-checkin';
import { MoodHistoryChart } from '@/components/my-life/mood-history-chart';
import { MoodWeeklySummaryCard } from '@/components/my-life/mood-weekly-summary';
import { getISODate, getPast7Days } from '@/lib/helpers';
import type { Goal, Habit, MoodEntry } from '@/lib/types';
import { toast } from 'sonner';

type SectionTab = 'journal' | 'habits' | 'mood';

export default function MyLifePage() {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState<SectionTab>('journal');
  const [habits, setHabits] = useState<Habit[]>([]);
  const [moodEntries, setMoodEntries] = useState<MoodEntry[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [newGoal, setNewGoal] = useState('');
  const [addingGoal, setAddingGoal] = useState(false);
  const [loading, setLoading] = useState(true);

  const past7Days = getPast7Days();
  const todayStr = getISODate(new Date());

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const [hRes, mRes, gRes] = await Promise.all([
        supabase
          .from('habits')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('mood_entries')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(30),
        supabase
          .from('goals')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
      ]);

      setHabits((hRes.data as Habit[]) ?? []);
      setMoodEntries((mRes.data as MoodEntry[]) ?? []);
      setGoals((gRes.data as Goal[]) ?? []);
    } catch {
      // Error fallback
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newGoal.trim()) return;
    setAddingGoal(true);
    try {
      const { data, error } = await supabase
        .from('goals')
        .insert({ user_id: user.id, title: newGoal.trim(), progress: 0, category: 'personal' })
        .select()
        .single();

      if (error) throw error;
      setGoals((prev) => [data as Goal, ...prev]);
      setNewGoal('');
      toast.success('Đã thêm mục tiêu mới!');
    } catch {
      toast.error('Không thể thêm mục tiêu');
    } finally {
      setAddingGoal(false);
    }
  };

  const handleMoodSaved = (newEntry: MoodEntry) => {
    setMoodEntries((prev) => [newEntry, ...prev]);
  };

  const todayMoodEntry = moodEntries.find((e) => {
    const d = new Date(e.created_at).toISOString().split('T')[0];
    return d === todayStr;
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-display font-bold">My Life</h1>
            <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
              <Sparkles className="h-3 w-3 mr-1" /> Phát triển bản thân
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Không gian riêng quản lý hành trình học tập, rèn luyện thói quen và chăm sóc sức khỏe tinh thần.
          </p>
        </div>

        {/* Section Navigation Tabs */}
        <div className="flex items-center bg-muted/50 p-1.5 rounded-2xl border border-border/60 shadow-sm">
          <button
            onClick={() => setActiveSection('journal')}
            className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all flex items-center gap-2 ${
              activeSection === 'journal'
                ? 'bg-card text-foreground shadow-sm scale-102 font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <BookOpen className="h-4 w-4 text-primary" />
            <span>Nhật ký</span>
          </button>

          <button
            onClick={() => setActiveSection('habits')}
            className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all flex items-center gap-2 ${
              activeSection === 'habits'
                ? 'bg-card text-foreground shadow-sm scale-102 font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            <span>Thói quen</span>
          </button>

          <button
            onClick={() => setActiveSection('mood')}
            className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all flex items-center gap-2 ${
              activeSection === 'mood'
                ? 'bg-card text-foreground shadow-sm scale-102 font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Heart className="h-4 w-4 text-rose-500" />
            <span>Tâm trạng</span>
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="animate-in fade-in duration-300">
        {activeSection === 'journal' && <JournalFeed />}

        {activeSection === 'habits' && <HabitTracker />}

        {activeSection === 'mood' && (
          <div className="space-y-6">
            {/* Daily Mood Checkin */}
            <MoodCheckin
              onMoodSaved={handleMoodSaved}
              existingTodayEntry={todayMoodEntry}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              {/* 7-Day History Chart */}
              <MoodHistoryChart entries={moodEntries} />

              {/* AI Weekly Summary Card with User Habits Integration */}
              <MoodWeeklySummaryCard
                moodEntries={moodEntries}
                userHabits={habits}
              />
            </div>
          </div>
        )}
      </div>

      {/* Goals section preserved at bottom */}
      <div className="pt-6 border-t border-border/40 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5 text-primary" /> Mục tiêu cá nhân ({goals.length})
          </p>
        </div>

        <Card className="border-border/50 bg-card/40">
          <CardContent className="p-4 space-y-3">
            <form onSubmit={handleAddGoal} className="flex gap-2">
              <Input
                value={newGoal}
                onChange={(e) => setNewGoal(e.target.value)}
                placeholder="Thêm mục tiêu mới (VD: Đạt 7.0 IELTS, Hoàn thành dự án AI...)"
                className="text-xs bg-background/50 h-8"
              />
              <Button type="submit" size="sm" disabled={addingGoal || !newGoal.trim()} className="h-8 text-xs gap-1 px-3">
                {addingGoal ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Thêm
              </Button>
            </form>

            {goals.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {goals.map((g) => (
                  <div
                    key={g.id}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-border/40 bg-card/60 text-xs"
                  >
                    <span className="font-medium text-foreground truncate pr-2">{g.title}</span>
                    <Badge variant="outline" className="text-[10px] capitalize shrink-0">
                      {g.category || 'personal'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
