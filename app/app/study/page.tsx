'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, Users, Calendar, Loader2, Check, Flame, Plus, Pencil, Trash2, PartyPopper, Zap } from 'lucide-react';
import type { Challenge, ChallengeParticipant, ChallengeCheckin, ChallengeCategory } from '@/lib/types';
import { toast } from 'sonner';

const CATEGORIES: { value: ChallengeCategory; label: string }[] = [
  { value: 'study', label: 'Study' },
  { value: 'ielts', label: 'IELTS' },
  { value: 'math', label: 'Math' },
  { value: 'physics', label: 'Physics' },
  { value: 'chemistry', label: 'Chemistry' },
  { value: 'english', label: 'English' },
  { value: 'reading', label: 'Reading' },
  { value: 'hsg', label: 'HSG' },
  { value: 'habit', label: 'Habit' },
  { value: 'other', label: 'Other' },
];

const PRESET_DURATIONS = [1, 3, 7, 14, 21, 30];

function getSuggestedDuration(current: number): number | null {
  if (current >= 30) return null;
  if (current < 3) return 3;
  if (current < 7) return 7;
  if (current < 14) return 14;
  if (current < 21) return 21;
  return 30;
}

// Local date in user's timezone as YYYY-MM-DD
function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDaysBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

// Calculate current streak from sorted check-in dates (descending)
function calculateStreak(checkinDates: string[], today: string): number {
  if (checkinDates.length === 0) return 0;
  const sorted = [...checkinDates].sort().reverse();
  // Streak counts from today backwards, allowing today to not be checked in yet
  let streak = 0;
  let cursor = today;
  for (const date of sorted) {
    if (date === cursor) {
      streak++;
      cursor = getDateStringOffset(cursor, -1);
    } else if (date < cursor) {
      // Gap found — check if the gap is just "today not yet checked in"
      // If cursor is today and no checkin today, allow starting from yesterday
      if (cursor === today) {
        cursor = getDateStringOffset(cursor, -1);
        if (date === cursor) {
          streak++;
          cursor = getDateStringOffset(cursor, -1);
          continue;
        }
      }
      break;
    }
  }
  return streak;
}

function getDateStringOffset(dateStr: string, offsetDays: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + offsetDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function StudyPage() {
  const { user } = useAuth();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [participations, setParticipations] = useState<Map<string, ChallengeParticipant>>(new Map());
  const [checkins, setCheckins] = useState<Map<string, Set<string>>>(new Map());
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingChallenge, setEditingChallenge] = useState<Challenge | null>(null);
  const [completedChallenge, setCompletedChallenge] = useState<Challenge | null>(null);
  const [deletingChallenge, setDeletingChallenge] = useState<Challenge | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('recommended');

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: chData } = await supabase.from('challenges').select('*').order('created_at', { ascending: false });
    const chList = (chData as Challenge[]) ?? [];
    setChallenges(chList);

    if (user) {
      const { data: partData } = await supabase
        .from('challenge_participants')
        .select('*')
        .eq('user_id', user.id);
      const partMap = new Map<string, ChallengeParticipant>();
      (partData as ChallengeParticipant[])?.forEach((p) => {
        partMap.set(p.challenge_id, p);
      });
      setParticipations(partMap);

      const challengeIds = chList.map((c) => c.id);
      if (challengeIds.length > 0) {
        const { data: checkinData } = await supabase
          .from('challenge_checkins')
          .select('*')
          .eq('user_id', user.id)
          .in('challenge_id', challengeIds);
        const checkinMap = new Map<string, Set<string>>();
        (checkinData as ChallengeCheckin[])?.forEach((c) => {
          const set = checkinMap.get(c.challenge_id) ?? new Set<string>();
          set.add(c.checkin_date);
          checkinMap.set(c.challenge_id, set);
        });
        setCheckins(checkinMap);
      }
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleJoin = async (challengeId: string) => {
    if (!user) return;
    try {
      const { error } = await supabase.from('challenge_participants').insert({
        challenge_id: challengeId,
        user_id: user.id,
        progress: 0,
        streak: 0,
        completed: false,
        round: 1,
      });
      if (error) throw error;
      await supabase.rpc('increment_challenge_participants', { challenge_id: challengeId }).then(() => {}, () => {});
      setParticipations(new Map(participations).set(challengeId, {
        challenge_id: challengeId, user_id: user.id, progress: 0, streak: 0,
        joined_at: new Date().toISOString(), completed: false, round: 1,
      }));
      toast.success('Challenge joined!');
    } catch {
      toast.error('Failed to join challenge');
    }
  };

  const handleCheckin = async (challengeId: string) => {
    if (!user) return;
    const today = getTodayString();
    const existingCheckins = checkins.get(challengeId);
    if (existingCheckins?.has(today)) {
      toast.error('Already completed today');
      return;
    }

    try {
      const { error } = await supabase.from('challenge_checkins').insert({
        challenge_id: challengeId,
        user_id: user.id,
        checkin_date: today,
      });
      if (error) throw error;

      const challenge = challenges.find((c) => c.id === challengeId);
      if (!challenge) return;
      const part = participations.get(challengeId);
      if (!part) return;

      // Build the new check-in set
      const allDates = new Set(existingCheckins ?? []);
      allDates.add(today);
      const dateArray = Array.from(allDates);

      // Streak: count consecutive days ending today (or yesterday if today not checked in)
      const newStreak = calculateStreak(dateArray, today);

      // Progress: based on actual check-in count, not days since start
      const completedDays = allDates.size;
      const newProgress = Math.min(100, Math.round((completedDays / challenge.duration_days) * 100));

      // Completion: only when user has actually checked in enough days
      const isComplete = completedDays >= challenge.duration_days;

      const { error: updateError } = await supabase
        .from('challenge_participants')
        .update({ progress: newProgress, streak: newStreak, completed: isComplete })
        .eq('challenge_id', challengeId)
        .eq('user_id', user.id);
      if (updateError) throw updateError;

      const newPartMap = new Map(participations);
      newPartMap.set(challengeId, { ...part, progress: newProgress, streak: newStreak, completed: isComplete });
      setParticipations(newPartMap);

      const newCheckinMap = new Map(checkins);
      newCheckinMap.set(challengeId, allDates);
      setCheckins(newCheckinMap);

      if (isComplete) {
        setCompletedChallenge(challenge);
      } else {
        toast.success(`Day ${completedDays} completed! Streak: ${newStreak}`);
      }
    } catch {
      toast.error('Failed to check in');
    }
  };

  const handleContinue = async (challenge: Challenge, newDuration: number) => {
    if (!user) return;
    try {
      const { data: newChallenge, error } = await supabase
        .from('challenges')
        .insert({
          title: challenge.title,
          description: challenge.description,
          type: challenge.type,
          duration_days: newDuration,
          icon: challenge.icon,
          color: challenge.color,
          creator_id: challenge.creator_id ?? user.id,
          category: challenge.category,
          start_date: getTodayString(),
          status: 'active',
          parent_challenge_id: challenge.id,
        })
        .select('*')
        .single();
      if (error) throw error;

      const newCh = newChallenge as Challenge;
      const newRound = (participations.get(challenge.id)?.round ?? 1) + 1;
      const { error: partError } = await supabase.from('challenge_participants').insert({
        challenge_id: newCh.id,
        user_id: user.id,
        progress: 0,
        streak: 0,
        completed: false,
        round: newRound,
      });
      if (partError) throw partError;

      await loadData();
      setCompletedChallenge(null);
      setActiveTab('my');
      toast.success(`Round ${newRound} started — ${newDuration} days!`);
    } catch {
      toast.error('Failed to continue challenge');
    }
  };

  const handleDelete = async () => {
    if (!user || !deletingChallenge) return;
    setDeleteLoading(true);
    try {
      const { error } = await supabase
        .from('challenges')
        .update({ status: 'archived' })
        .eq('id', deletingChallenge.id)
        .eq('creator_id', user.id);
      if (error) throw error;
      setChallenges(challenges.filter((c) => c.id !== deletingChallenge.id));
      setDeletingChallenge(null);
      toast.success('Challenge archived');
    } catch {
      toast.error('Failed to delete challenge');
    } finally {
      setDeleteLoading(false);
    }
  };

  const myChallenges = challenges.filter((c) => participations.has(c.id) && !participations.get(c.id)?.completed);
  const completedChallenges = challenges.filter((c) => participations.get(c.id)?.completed);
  const recommendedChallenges = challenges.filter((c) => !participations.has(c.id) && c.status !== 'archived' && c.status !== 'completed');

  if (loading) {
    return <div className="max-w-4xl mx-auto space-y-4">{[1, 2, 3, 4].map((i) => <div key={i} className="h-32 rounded-2xl animate-shimmer" />)}</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Study & Challenges</h1>
          <p className="text-muted-foreground mt-1">Join challenges, build habits, and track your learning progress.</p>
        </div>
        <Button onClick={() => { setEditingChallenge(null); setShowCreate(true); }} className="gap-1.5 shrink-0">
          <Plus className="h-4 w-4" /> Create Challenge
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="recommended">Recommended</TabsTrigger>
          <TabsTrigger value="my">My Challenges</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value="recommended" className="mt-4">
          {recommendedChallenges.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Trophy className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">No recommended challenges right now. Create your own!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recommendedChallenges.map((ch) => (
                <ChallengeCard
                  key={ch.id}
                  challenge={ch}
                  participation={null}
                  checkinDates={null}
                  onJoin={() => handleJoin(ch.id)}
                  onCheckin={() => handleCheckin(ch.id)}
                  canEdit={ch.creator_id === user?.id}
                  onEdit={() => { setEditingChallenge(ch); setShowCreate(true); }}
                  onDelete={() => setDeletingChallenge(ch)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="my" className="mt-4">
          {myChallenges.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Flame className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">No active challenges. Join one or create your own!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myChallenges.map((ch) => (
                <ChallengeCard
                  key={ch.id}
                  challenge={ch}
                  participation={participations.get(ch.id) ?? null}
                  checkinDates={checkins.get(ch.id) ?? null}
                  onJoin={() => handleJoin(ch.id)}
                  onCheckin={() => handleCheckin(ch.id)}
                  canEdit={ch.creator_id === user?.id}
                  onEdit={() => { setEditingChallenge(ch); setShowCreate(true); }}
                  onDelete={() => setDeletingChallenge(ch)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-4">
          {completedChallenges.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <PartyPopper className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">No completed challenges yet. Finish one to see it here!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {completedChallenges.map((ch) => (
                <ChallengeCard
                  key={ch.id}
                  challenge={ch}
                  participation={participations.get(ch.id) ?? null}
                  checkinDates={checkins.get(ch.id) ?? null}
                  onJoin={() => handleJoin(ch.id)}
                  onCheckin={() => handleCheckin(ch.id)}
                  canEdit={ch.creator_id === user?.id}
                  onEdit={() => { setEditingChallenge(ch); setShowCreate(true); }}
                  onDelete={() => setDeletingChallenge(ch)}
                  isCompleted
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <CreateChallengeDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        editing={editingChallenge}
        userId={user?.id ?? null}
        onCreated={loadData}
        lockProgressFields={!!editingChallenge && participations.has(editingChallenge.id)}
      />

      {deletingChallenge && (
        <Dialog open onOpenChange={() => setDeletingChallenge(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Delete this challenge?</DialogTitle>
              <DialogDescription>
                This will archive the challenge. Your check-in history and completion records will be preserved but the challenge will no longer appear in your list. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
                {deleteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {completedChallenge && (
        <CompletionDialog
          challenge={completedChallenge}
          onContinue={(duration) => handleContinue(completedChallenge, duration)}
          onClose={() => setCompletedChallenge(null)}
        />
      )}
    </div>
  );
}

function ChallengeCard({
  challenge: ch,
  participation,
  checkinDates,
  onJoin,
  onCheckin,
  canEdit,
  onEdit,
  onDelete,
  isCompleted,
}: {
  challenge: Challenge;
  participation: ChallengeParticipant | null;
  checkinDates: Set<string> | null;
  onJoin: () => void;
  onCheckin: () => void;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
  isCompleted?: boolean;
}) {
  const today = getTodayString();
  const checkedInToday = checkinDates?.has(today) ?? false;
  const completedDays = checkinDates?.size ?? 0;
  const isJoined = !!participation;

  return (
    <Card className={`border-border/60 hover:shadow-md transition-shadow ${isCompleted ? 'opacity-75' : ''}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/5 text-2xl">
              {ch.icon}
            </div>
            <div>
              <h3 className="font-semibold">{ch.title}</h3>
              {ch.parent_challenge_id && (
                <Badge variant="outline" className="text-xs mt-0.5 gap-1">
                  <Zap className="h-3 w-3" /> Round {participation?.round ?? 1}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1"><Calendar className="h-3 w-3" />{ch.duration_days} days</Badge>
            {canEdit && !isCompleted && (
              <>
                <button onClick={onEdit} className="text-muted-foreground hover:text-foreground transition-colors">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button onClick={onDelete} className="text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        </div>

        {ch.description && <p className="text-sm text-muted-foreground">{ch.description}</p>}

        <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {ch.participants_count} joined</span>
          <Badge variant="outline" className="text-xs capitalize">{ch.category}</Badge>
          {isJoined && (
            <Badge className="gap-1 bg-orange-500/10 text-orange-600 border-orange-500/20">
              <Flame className="h-3 w-3" /> {participation.streak} day streak
            </Badge>
          )}
        </div>

        {isJoined && !isCompleted && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-primary to-chart-2 transition-all duration-300" style={{ width: `${participation.progress}%` }} />
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">{completedDays}/{ch.duration_days} days</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Day {Math.min(completedDays + 1, ch.duration_days)} of {ch.duration_days}</span>
              {checkedInToday ? (
                <Badge className="gap-1 bg-success/10 text-success border-success/20">
                  <Check className="h-3 w-3" /> Today completed
                </Badge>
              ) : (
                <Button onClick={onCheckin} size="sm" className="gap-1.5">
                  <Check className="h-3.5 w-3.5" /> Complete Today
                </Button>
              )}
            </div>
          </div>
        )}

        {isCompleted && (
          <div className="mt-4">
            <Badge className="gap-1 bg-success/10 text-success border-success/20">
              <PartyPopper className="h-3.5 w-3.5" /> Completed — {completedDays}/{ch.duration_days} days
            </Badge>
          </div>
        )}

        {!isJoined && !isCompleted && (
          <Button onClick={onJoin} size="sm" className="mt-4 w-full gap-1.5">
            <Trophy className="h-3.5 w-3.5" /> Join Challenge
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function CreateChallengeDialog({
  open,
  onOpenChange,
  editing,
  userId,
  onCreated,
  lockProgressFields,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Challenge | null;
  userId: string | null;
  onCreated: () => void;
  lockProgressFields: boolean;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ChallengeCategory>('study');
  const [duration, setDuration] = useState(7);
  const [startDate, setStartDate] = useState(getTodayString());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setTitle(editing.title);
      setDescription(editing.description);
      setCategory(editing.category);
      setDuration(editing.duration_days);
      setStartDate(editing.start_date ?? getTodayString());
    } else {
      setTitle('');
      setDescription('');
      setCategory('study');
      setDuration(7);
      setStartDate(getTodayString());
    }
  }, [editing, open]);

  const handleSave = async () => {
    if (!userId) return;
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }
    if (!editing) {
      if (duration < 1 || duration > 30 || !Number.isInteger(duration)) {
        toast.error('Duration must be an integer between 1 and 30');
        return;
      }
    }
    setSaving(true);
    try {
      if (editing) {
        const updateData: Record<string, string | number> = {
          title: title.trim(),
          description: description.trim(),
          category,
        };
        if (!lockProgressFields) {
          updateData.duration_days = duration;
          updateData.start_date = startDate;
        }
        const { error } = await supabase
          .from('challenges')
          .update(updateData)
          .eq('id', editing.id)
          .eq('creator_id', userId);
        if (error) throw error;
        toast.success('Challenge updated!');
      } else {
        const { error } = await supabase.from('challenges').insert({
          title: title.trim(),
          description: description.trim(),
          type: 'custom',
          duration_days: duration,
          icon: '🎯',
          color: 'blue',
          creator_id: userId,
          category,
          start_date: startDate,
          status: 'active',
        });
        if (error) throw error;
        toast.success('Challenge created!');
      }
      onCreated();
      onOpenChange(false);
    } catch {
      toast.error('Failed to save challenge');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Challenge' : 'Create Challenge'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="title">Challenge Name *</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="IELTS 7-Day Challenge" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Practice IELTS Listening for at least 30 minutes every day." rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as ChallengeCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="start-date">Start Date</Label>
              <Input id="start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={lockProgressFields} />
            </div>
          </div>
          {(!editing || !lockProgressFields) && (
            <div className="space-y-1.5">
              <Label>Duration: {duration} days</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {PRESET_DURATIONS.map((d) => (
                  <Button
                    key={d}
                    size="sm"
                    variant={duration === d ? 'default' : 'outline'}
                    onClick={() => setDuration(d)}
                    className="h-8"
                    disabled={lockProgressFields}
                  >
                    {d}d
                  </Button>
                ))}
              </div>
              <Input
                type="number"
                min={1}
                max={30}
                value={duration}
                disabled={lockProgressFields}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!isNaN(v)) setDuration(Math.max(1, Math.min(30, v)));
                }}
              />
              {lockProgressFields && (
                <p className="text-xs text-muted-foreground">Duration and start date are locked once a challenge has participants.</p>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? 'Save' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CompletionDialog({
  challenge,
  onContinue,
  onClose,
}: {
  challenge: Challenge;
  onContinue: (duration: number) => void;
  onClose: () => void;
}) {
  const suggested = getSuggestedDuration(challenge.duration_days);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PartyPopper className="h-5 w-5 text-success" /> Challenge Complete!
          </DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-3">
          <p className="text-sm">
            You completed: <span className="font-semibold">{challenge.title}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            You completed all {challenge.duration_days} days! Great work.
          </p>
          {suggested ? (
            <>
              <p className="text-sm font-medium pt-2">Ready for the next level?</p>
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{challenge.duration_days} days</span>
                →
                <span className="font-semibold text-primary">{suggested} days</span>
              </div>
              <div className="flex gap-2 pt-2">
                <Button onClick={() => onContinue(suggested)} className="flex-1 gap-1.5">
                  <Zap className="h-4 w-4" /> Continue for {suggested} Days
                </Button>
                <Button variant="outline" onClick={onClose}>Maybe Later</Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm font-medium pt-2">You've reached the maximum challenge length!</p>
              <Button variant="outline" onClick={onClose} className="w-full">Close</Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
