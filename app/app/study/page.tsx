'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import {
  Trophy,
  Users,
  Calendar,
  Loader2,
  Check,
  Flame,
  Plus,
  Pencil,
  Trash2,
  PartyPopper,
  Zap,
  BookOpen,
  Sparkles,
  Search,
  Layers,
  GraduationCap,
  Brain,
  Edit3,
  TrendingUp,
  Clock,
  Target,
} from 'lucide-react';
import type { Challenge, ChallengeParticipant, ChallengeCheckin, ChallengeCategory, StudySet, QuestionType } from '@/lib/types';
import { fetchStudySets, createStudySet, updateStudySet, deleteStudySet, createStudyQuestionsBatch, STUDY_SUBJECTS } from '@/lib/study';
import { StudySetCard } from '@/components/study/study-set-card';
import { SetDialog } from '@/components/study/set-dialog';
import { AiCreateSetDialog } from '@/components/study/ai-create-set-dialog';
import { StudyProgressView } from '@/components/study/study-progress-view';
import { StudyLibraryView } from '@/components/study/study-library-view';
import { FocusModeDialog } from '@/components/study/focus-mode-dialog';
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

// Calculate current streak from sorted check-in dates (descending)
function calculateStreak(checkinDates: string[], today: string): number {
  if (checkinDates.length === 0) return 0;
  const sorted = [...checkinDates].sort().reverse();
  let streak = 0;
  let cursor = today;
  for (const date of sorted) {
    if (date === cursor) {
      streak++;
      cursor = getDateStringOffset(cursor, -1);
    } else if (date < cursor) {
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

  const router = useRouter();

  // Top-level Section Switcher: 'quiz' | 'library' | 'progress' | 'challenges'
  const [mainSection, setMainSection] = useState<'quiz' | 'library' | 'progress' | 'challenges'>('quiz');
  const [showFocusMode, setShowFocusMode] = useState(false);

  // Quiz / Flashcard State
  const [studySets, setStudySets] = useState<StudySet[]>([]);
  const [quizSearch, setQuizSearch] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [setTab, setSetTab] = useState<'all' | 'my' | 'system'>('all');

  // Modals state for Quiz creation
  const [isCreateSetOpen, setIsCreateSetOpen] = useState(false);
  const [isAiCreateSetOpen, setIsAiCreateSetOpen] = useState(false);
  const [editingSet, setEditingSet] = useState<StudySet | null>(null);

  // Challenges State
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [participations, setParticipations] = useState<Map<string, ChallengeParticipant>>(new Map());
  const [checkins, setCheckins] = useState<Map<string, Set<string>>>(new Map());
  const [loading, setLoading] = useState(true);
  const [showCreateChallenge, setShowCreateChallenge] = useState(false);
  const [editingChallenge, setEditingChallenge] = useState<Challenge | null>(null);
  const [completedChallenge, setCompletedChallenge] = useState<Challenge | null>(null);
  const [deletingChallenge, setDeletingChallenge] = useState<Challenge | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [activeChallengeTab, setActiveChallengeTab] = useState('recommended');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Load challenges
      const { data: chData } = await supabase.from('challenges').select('*').order('created_at', { ascending: false });
      const chList = (chData as Challenge[]) ?? [];
      setChallenges(chList);

      // 2. Load study sets (both user sets and system seed sets)
      const sets = await fetchStudySets(user?.id);
      setStudySets(sets);

      if (user) {
        // Load challenge participations
        const { data: partData } = await supabase
          .from('challenge_participants')
          .select('*')
          .eq('user_id', user.id);
        const partMap = new Map<string, ChallengeParticipant>();
        let hasActiveParticipation = false;
        (partData as ChallengeParticipant[])?.forEach((p) => {
          partMap.set(p.challenge_id, p);
          if (!p.completed) {
            hasActiveParticipation = true;
          }
        });
        setParticipations(partMap);

        // Default tab selection: If user has at least 1 active challenge -> 'my', else 'recommended'
        setActiveChallengeTab((prev) => {
          if (prev === 'completed') return 'completed';
          return hasActiveParticipation ? 'my' : 'recommended';
        });

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
    } catch (err) {
      console.error('Error loading study data:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Quiz Set Manual Creation / Update Handler
  const handleSaveSet = async (data: {
    title: string;
    subject: string;
    topic: string;
    description: string;
    default_type?: QuestionType;
    questions?: {
      type: QuestionType;
      question: string;
      answer: string;
      explanation?: string | null;
      options?: { A: string; B: string; C: string; D: string } | null;
      correct_option?: 'A' | 'B' | 'C' | 'D' | null;
    }[];
  }) => {
    if (!user) {
      toast.error('Vui lòng đăng nhập để lưu bộ học');
      return;
    }

    if (editingSet) {
      await updateStudySet(editingSet.id, {
        title: data.title,
        subject: data.subject,
        topic: data.topic,
        description: data.description,
        default_type: data.default_type,
      });
      setStudySets((prev) =>
        prev.map((s) => (s.id === editingSet.id ? { ...s, ...data } : s))
      );
      toast.success('Đã cập nhật bộ câu hỏi');
      setEditingSet(null);
    } else {
      let createdSetId: string | null = null;
      try {
        const newSet = await createStudySet({
          user_id: user.id,
          title: data.title,
          subject: data.subject,
          topic: data.topic,
          description: data.description,
          default_type: data.default_type || data.questions?.[0]?.type || 'flashcard',
        });
        createdSetId = newSet.id;

        if (data.questions && data.questions.length > 0) {
          const payload = data.questions.map((q, idx) => ({
            set_id: newSet.id,
            type: q.type,
            question: q.question,
            answer: q.answer,
            explanation: q.explanation || null,
            options: q.options || null,
            correct_option: q.correct_option || null,
            sort_order: idx,
            metadata: {},
          }));

          await createStudyQuestionsBatch(payload);
        }

        const completeSet: StudySet = {
          ...newSet,
          questions_count: data.questions?.length ?? 0,
          mastered_count: 0,
        };

        setStudySets((prev) => [completeSet, ...prev.filter((s) => s.id !== completeSet.id)]);
        toast.success(`Đã tạo thành công bộ học "${completeSet.title}" với ${data.questions?.length ?? 0} câu hỏi!`);
        setEditingSet(null);

        // Redirect to detail page of the new study set
        router.push(`/app/study/sets/${newSet.id}`);
      } catch (err: unknown) {
        console.error('Error creating study set with questions:', err);
        // Rollback created set to prevent orphaned empty set
        if (createdSetId) {
          try {
            await deleteStudySet(createdSetId);
          } catch (rbErr) {
            console.error('Rollback error:', rbErr);
          }
        }
        const msg = err instanceof Error ? err.message : String(err);
        toast.error(msg || 'Có lỗi xảy ra khi tạo bộ học');
        throw err;
      }
    }
  };

  // AI Creation Success Handler
  const handleAiSetSuccess = (newSet: StudySet) => {
    setStudySets((prev) => [newSet, ...prev.filter((s) => s.id !== newSet.id)]);
    if (user) {
      fetchStudySets(user.id).then((freshSets) => setStudySets(freshSets)).catch(console.error);
    }
  };

  const handleDeleteSet = async (setId: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa bộ câu hỏi này không? Mọi câu hỏi bên trong sẽ bị xóa.')) return;
    try {
      await deleteStudySet(setId);
      setStudySets((prev) => prev.filter((s) => s.id !== setId));
      toast.success('Đã xóa bộ câu hỏi');
    } catch (err) {
      toast.error('Không thể xóa bộ câu hỏi');
    }
  };

  // Challenge Handlers
  const handleJoinChallenge = async (challengeId: string) => {
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

  const handleCheckinChallenge = async (challengeId: string) => {
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

      const allDates = new Set(existingCheckins ?? []);
      allDates.add(today);
      const dateArray = Array.from(allDates);
      const newStreak = calculateStreak(dateArray, today);
      const completedDays = allDates.size;
      const newProgress = Math.min(100, Math.round((completedDays / challenge.duration_days) * 100));
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
        supabase.from('notifications').insert({
          user_id: user.id,
          type: 'challenge_completed',
          title: 'Challenge Completed! 🎉',
          body: `Congratulations! You have completed the challenge: ${challenge.title}`,
          link: '/app/study',
        }).then(() => {}, () => {});
      } else {
        toast.success(`Day ${completedDays} completed! Streak: ${newStreak}`);
        if ([3, 7, 14, 21, 30].includes(newStreak)) {
          supabase.from('notifications').insert({
            user_id: user.id,
            type: 'challenge_streak',
            title: 'Streak Milestone! 🔥',
            body: `Awesome! You reached a ${newStreak}-day streak in ${challenge.title}!`,
            link: '/app/study',
          }).then(() => {}, () => {});
        }
      }
    } catch {
      toast.error('Failed to check in');
    }
  };

  const handleContinueChallenge = async (challenge: Challenge, newDuration: number) => {
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
      setActiveChallengeTab('my');
      toast.success(`Round ${newRound} started — ${newDuration} days!`);
    } catch {
      toast.error('Failed to continue challenge');
    }
  };

  const handleDeleteChallenge = async () => {
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

  // Filtered Quiz Sets
  const filteredSets = studySets.filter((s) => {
    const matchesSearch =
      !quizSearch ||
      s.title.toLowerCase().includes(quizSearch.toLowerCase()) ||
      (s.topic && s.topic.toLowerCase().includes(quizSearch.toLowerCase())) ||
      (s.description && s.description.toLowerCase().includes(quizSearch.toLowerCase()));

    const matchesSubject = selectedSubject === 'all' || s.subject === selectedSubject;

    const matchesTab =
      setTab === 'all' ||
      (setTab === 'my' && !s.is_system && s.user_id === user?.id) ||
      (setTab === 'system' && s.is_system);

    return matchesSearch && matchesSubject && matchesTab;
  });

  const myChallenges = challenges.filter((c) => participations.has(c.id) && !participations.get(c.id)?.completed);
  const completedChallenges = challenges.filter((c) => participations.get(c.id)?.completed);
  const recommendedChallenges = challenges.filter((c) => !participations.has(c.id) && c.status !== 'archived' && c.status !== 'completed');

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 rounded-2xl animate-shimmer" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Level Section Navigation Pills */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-muted/60 border border-border/60 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setMainSection('quiz')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 ${
              mainSection === 'quiz'
                ? 'bg-background text-primary shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <GraduationCap className="h-4 w-4" /> Quiz & Flashcards ({studySets.length})
          </button>

          <button
            onClick={() => setMainSection('library')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 ${
              mainSection === 'library'
                ? 'bg-background text-primary shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <BookOpen className="h-4 w-4" /> Thư viện tài liệu
          </button>

          <button
            onClick={() => setMainSection('progress')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 ${
              mainSection === 'progress'
                ? 'bg-background text-primary shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <TrendingUp className="h-4 w-4 text-emerald-500" /> My Progress
          </button>

          <button
            onClick={() => setMainSection('challenges')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 ${
              mainSection === 'challenges'
                ? 'bg-background text-primary shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Flame className="h-4 w-4 text-orange-500" /> Thử thách ({myChallenges.length})
          </button>
        </div>

        {/* Focus Mode Quick Action */}
        <Button
          onClick={() => setShowFocusMode(true)}
          variant="outline"
          className="gap-2 rounded-xl border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary font-bold text-xs shadow-xs shrink-0 self-start sm:self-auto"
        >
          <Clock className="h-4 w-4 text-primary" /> Focus Mode (Pomodoro)
        </Button>
      </div>

      {/* ==================================================== */}
      {/* SECTION 1: QUIZ & FLASHCARDS                         */}
      {/* ==================================================== */}
      {mainSection === 'quiz' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">
                Quiz & Flashcards
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Luyện tập đa môn, trắc nghiệm 4 lựa chọn, điền từ, và thẻ ghi nhớ Spaced Repetition.
              </p>
            </div>
          </div>

          {/* TWO PROMINENT CREATION ACTION CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Action 1: Tự mình tạo */}
            <Card
              onClick={() => {
                setEditingSet(null);
                setIsCreateSetOpen(true);
              }}
              className="cursor-pointer border-border/80 hover:border-primary/60 hover:shadow-md transition-all duration-200 group bg-card hover:bg-muted/20"
            >
              <CardContent className="p-5 flex items-start gap-4">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Edit3 className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-foreground group-hover:text-primary transition-colors">
                      + Tự mình tạo
                    </h3>
                    <Badge variant="outline" className="text-[10px] font-normal">
                      Thủ công
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Tự soạn thảo câu hỏi, công thức Toán/Lý/Hóa LaTeX, trắc nghiệm 4 lựa chọn, điền từ và flashcard.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Action 2: AI Tạo */}
            <Card
              onClick={() => setIsAiCreateSetOpen(true)}
              className="cursor-pointer border-primary/30 hover:border-primary hover:shadow-md transition-all duration-200 group bg-gradient-to-br from-primary/5 via-card to-background hover:from-primary/10"
            >
              <CardContent className="p-5 flex items-start gap-4">
                <div className="h-12 w-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-foreground group-hover:text-primary transition-colors">
                      ✨ AI tạo bộ học
                    </h3>
                    <Badge className="text-[10px] bg-primary text-primary-foreground font-semibold">
                      Thông minh
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Nhập yêu cầu tự nhiên hoặc dán tài liệu bài học. AI tự động tạo câu hỏi, hỗ trợ Review & Edit trước khi lưu.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search, Filter Scope Tabs & Subject Filter Pills */}
          <div className="space-y-3 pt-2">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Search input */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={quizSearch}
                  onChange={(e) => setQuizSearch(e.target.value)}
                  placeholder="Tìm kiếm bộ câu hỏi, chủ đề..."
                  className="pl-10 h-10 rounded-xl text-xs sm:text-sm"
                />
              </div>

              {/* Scope Switcher: All / My Sets / System Sets */}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/60 border border-border/60 shrink-0">
                <button
                  onClick={() => setSetTab('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    setTab === 'all' ? 'bg-background shadow-xs text-foreground font-semibold' : 'text-muted-foreground'
                  }`}
                >
                  Tất cả ({studySets.length})
                </button>
                <button
                  onClick={() => setSetTab('my')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    setTab === 'my' ? 'bg-background shadow-xs text-foreground font-semibold' : 'text-muted-foreground'
                  }`}
                >
                  Của tôi ({studySets.filter((s) => !s.is_system && s.user_id === user?.id).length})
                </button>
                <button
                  onClick={() => setSetTab('system')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    setTab === 'system' ? 'bg-background shadow-xs text-foreground font-semibold' : 'text-muted-foreground'
                  }`}
                >
                  Mẫu chuẩn ({studySets.filter((s) => s.is_system).length})
                </button>
              </div>
            </div>

            {/* Subject Filters Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => setSelectedSubject('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium shrink-0 transition-all border ${
                  selectedSubject === 'all'
                    ? 'border-primary bg-primary/10 text-primary font-semibold'
                    : 'border-border/60 hover:bg-muted/50 text-muted-foreground'
                }`}
              >
                Tất cả môn
              </button>

              {STUDY_SUBJECTS.map((s) => {
                const count = studySets.filter((st) => st.subject === s.value).length;
                return (
                  <button
                    key={s.value}
                    onClick={() => setSelectedSubject(s.value)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium shrink-0 transition-all flex items-center gap-1.5 border ${
                      selectedSubject === s.value
                        ? 'border-primary bg-primary/10 text-primary font-semibold'
                        : 'border-border/60 hover:bg-muted/50 text-muted-foreground'
                    }`}
                  >
                    <span>{s.icon}</span>
                    <span>{s.labelVi}</span>
                    {count > 0 && <span className="opacity-70">({count})</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Study Sets Grid */}
          {filteredSets.length === 0 ? (
            <Card className="border-dashed border-2 p-12 text-center space-y-4">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto text-3xl">
                <GraduationCap className="h-8 w-8 text-primary" />
              </div>
              <div className="space-y-1">
                <p className="text-lg font-semibold">Chưa có bộ câu hỏi phù hợp</p>
                <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto">
                  Hãy thử tìm kiếm với từ khóa khác hoặc tạo bộ học mới bằng tay hoặc AI!
                </p>
              </div>
              <div className="flex justify-center gap-3 pt-2">
                <Button
                  onClick={() => {
                    setEditingSet(null);
                    setIsCreateSetOpen(true);
                  }}
                  variant="outline"
                  className="rounded-xl font-medium gap-1.5"
                >
                  <Plus className="h-4 w-4" /> Tự mình tạo
                </Button>
                <Button
                  onClick={() => setIsAiCreateSetOpen(true)}
                  className="rounded-xl font-medium gap-1.5"
                >
                  <Sparkles className="h-4 w-4" /> AI tạo bộ học
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSets.map((set) => (
                <StudySetCard
                  key={set.id}
                  studySet={set}
                  onEdit={(s) => {
                    setEditingSet(s);
                    setIsCreateSetOpen(true);
                  }}
                  onDelete={handleDeleteSet}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================================================== */}
      {/* SECTION 2: STUDY CHALLENGES                          */}
      {/* ==================================================== */}
      {mainSection === 'challenges' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-display font-bold">Thử thách học tập & Rèn luyện</h2>
              <p className="text-muted-foreground text-xs sm:text-sm mt-1">
                Tham gia thử thách, xây dựng thói quen và duy trì chuỗi ngày liên tục.
              </p>
            </div>
            <Button
              onClick={() => {
                setEditingChallenge(null);
                setShowCreateChallenge(true);
              }}
              className="gap-1.5 shrink-0 rounded-xl"
            >
              <Plus className="h-4 w-4" /> Tạo thử thách mới
            </Button>
          </div>

          <Tabs value={activeChallengeTab} onValueChange={setActiveChallengeTab}>
            <TabsList className="grid grid-cols-3 w-full max-w-md">
              <TabsTrigger value="recommended">Gợi ý</TabsTrigger>
              <TabsTrigger value="my">Của tôi ({myChallenges.length})</TabsTrigger>
              <TabsTrigger value="completed">Đã xong ({completedChallenges.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="recommended" className="mt-4">
              {recommendedChallenges.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                    <Trophy className="h-10 w-10 text-muted-foreground/40 mb-3" />
                    <p className="text-sm text-muted-foreground">Hiện chưa có thử thách gợi ý. Hãy tự tạo thử thách của riêng bạn!</p>
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
                      onJoin={() => handleJoinChallenge(ch.id)}
                      onCheckin={() => handleCheckinChallenge(ch.id)}
                      canEdit={ch.creator_id === user?.id}
                      onEdit={() => {
                        setEditingChallenge(ch);
                        setShowCreateChallenge(true);
                      }}
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
                    <p className="text-sm text-muted-foreground">Chưa có thử thách nào đang chạy. Tham gia ngay!</p>
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
                      onJoin={() => handleJoinChallenge(ch.id)}
                      onCheckin={() => handleCheckinChallenge(ch.id)}
                      canEdit={ch.creator_id === user?.id}
                      onEdit={() => {
                        setEditingChallenge(ch);
                        setShowCreateChallenge(true);
                      }}
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
                    <p className="text-sm text-muted-foreground">Chưa có thử thách nào hoàn thành.</p>
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
                      onJoin={() => handleJoinChallenge(ch.id)}
                      onCheckin={() => handleCheckinChallenge(ch.id)}
                      canEdit={ch.creator_id === user?.id}
                      onEdit={() => {
                        setEditingChallenge(ch);
                        setShowCreateChallenge(true);
                      }}
                      onDelete={() => setDeletingChallenge(ch)}
                      isCompleted
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>

          <CreateChallengeDialog
            open={showCreateChallenge}
            onOpenChange={setShowCreateChallenge}
            editing={editingChallenge}
            userId={user?.id ?? null}
            onCreated={loadData}
            lockProgressFields={!!editingChallenge && participations.has(editingChallenge.id)}
          />

          {deletingChallenge && (
            <Dialog open onOpenChange={() => setDeletingChallenge(null)}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Xóa thử thách này?</DialogTitle>
                  <DialogDescription>
                    Hành động này sẽ lưu trữ thử thách. Lịch sử điểm danh của bạn vẫn được bảo lưu.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Hủy</Button>
                  </DialogClose>
                  <Button variant="destructive" onClick={handleDeleteChallenge} disabled={deleteLoading}>
                    {deleteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Xóa'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          {completedChallenge && (
            <CompletionDialog
              challenge={completedChallenge}
              onContinue={(duration) => handleContinueChallenge(completedChallenge, duration)}
              onClose={() => setCompletedChallenge(null)}
            />
          )}
        </div>
      )}

      {/* ==================================================== */}
      {/* SECTION 3: STUDY LIBRARY                             */}
      {/* ==================================================== */}
      {mainSection === 'library' && <StudyLibraryView />}

      {/* ==================================================== */}
      {/* SECTION 4: MY PROGRESS & WEAKNESS MAP                */}
      {/* ==================================================== */}
      {mainSection === 'progress' && <StudyProgressView />}

      {/* Manual Set Create/Edit Dialog */}
      <SetDialog
        open={isCreateSetOpen}
        onOpenChange={setIsCreateSetOpen}
        studySet={editingSet}
        onSave={handleSaveSet}
      />

      {/* AI Set Create Dialog */}
      <AiCreateSetDialog
        open={isAiCreateSetOpen}
        onOpenChange={setIsAiCreateSetOpen}
        onSuccess={handleAiSetSuccess}
      />

      {/* Focus Mode Dialog */}
      <FocusModeDialog
        open={showFocusMode}
        onOpenChange={setShowFocusMode}
      />
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
  canEdit?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  isCompleted?: boolean;
}) {
  const isJoined = !!participation;
  const progress = participation?.progress ?? 0;
  const streak = participation?.streak ?? 0;
  const isCheckedToday = checkinDates?.has(getTodayString()) ?? false;
  const totalDays = ch.duration_days;
  const completedDays = checkinDates?.size ?? 0;

  return (
    <Card className="border-border/80 hover:shadow-md transition-all duration-200">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-2xl">
              {ch.icon || '🎯'}
            </div>
            <div>
              <h3 className="font-semibold text-base leading-tight">{ch.title}</h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-[10px] capitalize">
                  {ch.category}
                </Badge>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> {ch.duration_days} ngày
                </span>
                {participation?.round && participation.round > 1 && (
                  <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary">
                    Vòng {participation.round}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {canEdit && (
            <div className="flex gap-1">
              {onEdit && (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={onEdit}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
              {onDelete && (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={onDelete}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )}
        </div>

        {ch.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{ch.description}</p>
        )}

        {isJoined && (
          <div className="space-y-2 pt-2 border-t border-border/40">
            <div className="flex justify-between text-xs font-medium">
              <span className="flex items-center gap-1 text-muted-foreground">
                <Flame className={`h-3.5 w-3.5 ${streak > 0 ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground'}`} />
                {streak} ngày liên tiếp
              </span>
              <span>{completedDays} / {totalDays} ngày ({progress}%)</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Users className="h-3.5 w-3.5" /> {ch.participants_count} người tham gia
          </span>

          {!isJoined ? (
            <Button size="sm" onClick={onJoin} className="rounded-xl h-8 text-xs font-medium">
              Tham gia
            </Button>
          ) : isCompleted ? (
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs">
              <Check className="h-3 w-3 mr-1" /> Đã hoàn thành
            </Badge>
          ) : (
            <Button
              size="sm"
              variant={isCheckedToday ? 'outline' : 'default'}
              disabled={isCheckedToday}
              onClick={onCheckin}
              className={`rounded-xl h-8 text-xs font-medium gap-1 ${
                isCheckedToday ? 'border-emerald-500/30 text-emerald-600 bg-emerald-500/5' : ''
              }`}
            >
              <Check className="h-3.5 w-3.5" /> {isCheckedToday ? 'Đã hoàn thành hôm nay' : 'Điểm danh hôm nay'}
            </Button>
          )}
        </div>
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
  onOpenChange: (open: boolean) => void;
  editing: Challenge | null;
  userId: string | null;
  onCreated: () => void;
  lockProgressFields?: boolean;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ChallengeCategory>('study');
  const [duration, setDuration] = useState(7);
  const [icon, setIcon] = useState('🎯');
  const [startDate, setStartDate] = useState(getTodayString());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (editing) {
      setTitle(editing.title);
      setDescription(editing.description ?? '');
      setCategory(editing.category as ChallengeCategory);
      setDuration(editing.duration_days);
      setIcon(editing.icon ?? '🎯');
      setStartDate(editing.start_date ?? getTodayString());
    } else {
      setTitle('');
      setDescription('');
      setCategory('study');
      setDuration(7);
      setIcon('🎯');
      setStartDate(getTodayString());
    }
  }, [editing, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !userId) return;
    setSubmitting(true);
    try {
      if (editing) {
        const updatePayload: Record<string, unknown> = {
          title,
          description,
          icon,
        };
        if (!lockProgressFields) {
          updatePayload.category = category;
          updatePayload.duration_days = duration;
          updatePayload.start_date = startDate;
        }
        const { error } = await supabase
          .from('challenges')
          .update(updatePayload)
          .eq('id', editing.id);
        if (error) throw error;
        toast.success('Challenge updated!');
      } else {
        const { data: newChallenge, error: insertChError } = await supabase
          .from('challenges')
          .insert({
            title: title.trim(),
            description: description.trim(),
            type: 'milestone',
            duration_days: duration,
            icon,
            color: 'blue',
            creator_id: userId,
            category,
            start_date: startDate,
            status: 'active',
          })
          .select('*')
          .single();

        if (insertChError || !newChallenge) {
          throw insertChError || new Error('Không thể tạo thử thách');
        }

        // Check if participant already exists to prevent duplicate insertion
        const { data: existingPart } = await supabase
          .from('challenge_participants')
          .select('challenge_id')
          .eq('challenge_id', newChallenge.id)
          .eq('user_id', userId)
          .maybeSingle();

        if (!existingPart) {
          const { error: partError } = await supabase
            .from('challenge_participants')
            .insert({
              challenge_id: newChallenge.id,
              user_id: userId,
              progress: 0,
              streak: 0,
              completed: false,
              round: 1,
            });

          if (partError) {
            throw new Error(`Đã tạo thử thách nhưng không thể tham gia: ${partError.message}`);
          }

          // Increment challenge participants count
          await supabase.rpc('increment_challenge_participants', { challenge_id: newChallenge.id }).then(() => {}, () => {});
        }

        toast.success('Thử thách đã được tạo và bạn đã tham gia thành công!');
      }
      onOpenChange(false);
      onCreated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể lưu thử thách';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Challenge' : 'Create a Challenge'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="ch-title">Tên thử thách *</Label>
              <Input id="ch-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ch-desc">Mô tả</Label>
              <Textarea id="ch-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Danh mục</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as ChallengeCategory)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Thời gian (ngày)</Label>
                <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRESET_DURATIONS.map((d) => <SelectItem key={d} value={String(d)}>{d} ngày</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Hủy</Button></DialogClose>
            <Button type="submit" disabled={submitting || !title.trim()}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editing ? 'Lưu' : 'Tạo thử thách'}
            </Button>
          </DialogFooter>
        </form>
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
      <DialogContent className="max-w-md text-center">
        <div className="py-6 flex flex-col items-center">
          <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-3xl mb-4">
            <Trophy className="h-8 w-8" />
          </div>
          <DialogTitle className="text-xl font-bold">Chúc mừng bạn đã hoàn thành thử thách!</DialogTitle>
          <DialogDescription className="mt-2">
            Bạn đã xuất sắc hoàn thành {challenge.duration_days} ngày của <strong>{challenge.title}</strong>.
          </DialogDescription>
          {suggested && (
            <div className="mt-6 w-full">
              <Button onClick={() => onContinue(suggested)} className="w-full rounded-xl gap-2">
                <Zap className="h-4 w-4" /> Nâng cấp lên {suggested} ngày tiếp theo
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
