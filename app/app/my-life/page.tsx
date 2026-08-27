'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Target, Plus, TrendingUp, Heart, BookOpen, Check, Loader2, Flame } from 'lucide-react';
import type { Goal, Habit, MoodEntry, JournalEntry } from '@/lib/types';
import { moodEmoji, moodLabel, formatRelativeTime } from '@/lib/helpers';
import { toast } from 'sonner';

export default function MyLifePage() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [moodEntries, setMoodEntries] = useState<MoodEntry[]>([]);
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // New goal
  const [newGoal, setNewGoal] = useState('');
  const [addingGoal, setAddingGoal] = useState(false);

  // New habit
  const [newHabit, setNewHabit] = useState('');
  const [addingHabit, setAddingHabit] = useState(false);

  // New journal
  const [journalTitle, setJournalTitle] = useState('');
  const [journalContent, setJournalContent] = useState('');
  const [journalMood, setJournalMood] = useState(3);
  const [savingJournal, setSavingJournal] = useState(false);

  // Mood
  const [moodValue, setMoodValue] = useState(3);
  const [savingMood, setSavingMood] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    const [g, h, m, j] = await Promise.all([
      supabase.from('goals').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('habits').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('mood_entries').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(7),
      supabase.from('journal_entries').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
    ]);
    setGoals((g.data as Goal[]) ?? []);
    setHabits((h.data as Habit[]) ?? []);
    setMoodEntries((m.data as MoodEntry[]) ?? []);
    setJournals((j.data as JournalEntry[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newGoal.trim()) return;
    setAddingGoal(true);
    try {
      const { data, error } = await supabase.from('goals').insert({ user_id: user.id, title: newGoal }).select().single();
      if (error) throw error;
      setGoals([data as Goal, ...goals]);
      setNewGoal('');
      toast.success('Goal added!');
    } catch {
      toast.error('Failed to add goal');
    } finally {
      setAddingGoal(false);
    }
  };

  const handleAddHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newHabit.trim()) return;
    setAddingHabit(true);
    try {
      const { data, error } = await supabase.from('habits').insert({ user_id: user.id, name: newHabit }).select().single();
      if (error) throw error;
      setHabits([data as Habit, ...habits]);
      setNewHabit('');
      toast.success('Habit added!');
    } catch {
      toast.error('Failed to add habit');
    } finally {
      setAddingHabit(false);
    }
  };

  const handleToggleHabit = async (habitId: string) => {
    if (!user) return;
    try {
      await supabase.from('habit_logs').insert({ habit_id: habitId, user_id: user.id, completed_date: new Date().toISOString().split('T')[0] });
      await supabase.from('habits').update({ streak: 1 }).eq('id', habitId);
      setHabits(habits.map((h) => (h.id === habitId ? { ...h, streak: h.streak + 1 } : h)));
      toast.success('Habit completed for today!');
    } catch {
      toast.error('Already completed today or failed');
    }
  };

  const handleSaveMood = async () => {
    if (!user) return;
    setSavingMood(true);
    try {
      const { data, error } = await supabase.from('mood_entries').insert({ user_id: user.id, mood: moodValue }).select().single();
      if (error) throw error;
      setMoodEntries([data as MoodEntry, ...moodEntries]);
      toast.success('Mood saved!');
    } catch {
      toast.error('Failed to save mood');
    } finally {
      setSavingMood(false);
    }
  };

  const handleSaveJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !journalContent.trim()) return;
    setSavingJournal(true);
    try {
      const { data, error } = await supabase.from('journal_entries').insert({
        user_id: user.id,
        title: journalTitle || null,
        content: journalContent,
        mood: journalMood,
        is_private: true,
      }).select().single();
      if (error) throw error;
      setJournals([data as JournalEntry, ...journals]);
      setJournalTitle('');
      setJournalContent('');
      setJournalMood(3);
      toast.success('Journal entry saved!');
    } catch {
      toast.error('Failed to save journal');
    } finally {
      setSavingJournal(false);
    }
  };

  if (loading) {
    return <div className="max-w-4xl mx-auto space-y-4">{[1, 2, 3].map((i) => <div key={i} className="h-48 rounded-2xl animate-shimmer" />)}</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">My Life</h1>
        <p className="text-muted-foreground mt-1">Your personal dashboard for growth and well-being.</p>
      </div>

      {/* Mood check-in */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Heart className="h-4 w-4" /> How are you feeling?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-3">
            {[1, 2, 3, 4, 5].map((m) => (
              <button
                key={m}
                onClick={() => setMoodValue(m)}
                className={`text-3xl p-2 rounded-lg transition-all ${moodValue === m ? 'bg-primary/10 scale-110' : 'opacity-50 hover:opacity-100'}`}
              >
                {moodEmoji(m)}
              </button>
            ))}
            <span className="ml-2 text-sm font-medium">{moodLabel(moodValue)}</span>
          </div>
          <Button onClick={handleSaveMood} size="sm" disabled={savingMood}>
            {savingMood ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save mood'}
          </Button>
          {moodEntries.length > 0 && (
            <div className="mt-4 flex items-center gap-1">
              {moodEntries.slice(0, 7).reverse().map((m) => (
                <div key={m.id} className="flex flex-col items-center gap-1" title={moodLabel(m.mood)}>
                  <span className="text-lg">{moodEmoji(m.mood)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Goals */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4" /> Goals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form onSubmit={handleAddGoal} className="flex gap-2">
            <Input value={newGoal} onChange={(e) => setNewGoal(e.target.value)} placeholder="Add a new goal..." />
            <Button type="submit" size="icon" disabled={addingGoal || !newGoal.trim()}>
              {addingGoal ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </form>
          {goals.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No goals yet. Set your first goal above!</p>
          ) : (
            <div className="space-y-2">
              {goals.map((g) => (
                <div key={g.id} className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{g.title}</p>
                    <Badge variant="outline" className="text-xs mt-1 capitalize">{g.category}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${g.progress}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground">{g.progress}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Habits */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Habits</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form onSubmit={handleAddHabit} className="flex gap-2">
            <Input value={newHabit} onChange={(e) => setNewHabit(e.target.value)} placeholder="Add a new habit..." />
            <Button type="submit" size="icon" disabled={addingHabit || !newHabit.trim()}>
              {addingHabit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </form>
          {habits.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No habits yet. Start building one above!</p>
          ) : (
            <div className="space-y-2">
              {habits.map((h) => (
                <div key={h.id} className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
                  <button onClick={() => handleToggleHabit(h.id)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                    <Check className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <span className="flex-1 text-sm font-medium">{h.name}</span>
                  <Badge variant="outline" className="text-xs gap-1"><Flame className="h-3 w-3" /> {h.streak} day{h.streak !== 1 ? 's' : ''}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Journal */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><BookOpen className="h-4 w-4" /> Private Journal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form onSubmit={handleSaveJournal} className="space-y-3">
            <Input value={journalTitle} onChange={(e) => setJournalTitle(e.target.value)} placeholder="Title (optional)" />
            <Textarea value={journalContent} onChange={(e) => setJournalContent(e.target.value)} placeholder="What's on your mind? This is completely private." rows={3} />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((m) => (
                  <button key={m} type="button" onClick={() => setJournalMood(m)} className={`text-xl p-1 rounded ${journalMood === m ? 'bg-primary/10' : 'opacity-50'}`}>
                    {moodEmoji(m)}
                  </button>
                ))}
              </div>
              <Button type="submit" size="sm" disabled={savingJournal || !journalContent.trim()}>
                {savingJournal ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save entry'}
              </Button>
            </div>
          </form>
          {journals.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border/60">
              {journals.map((j) => (
                <div key={j.id} className="rounded-lg p-3 bg-muted/30">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    {j.mood && <span>{moodEmoji(j.mood)}</span>}
                    <span>{formatRelativeTime(j.created_at)}</span>
                  </div>
                  {j.title && <p className="text-sm font-medium">{j.title}</p>}
                  <p className="text-sm text-muted-foreground line-clamp-2">{j.content}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
