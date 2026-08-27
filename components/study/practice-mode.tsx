'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  CheckCircle2,
  Trophy,
  Sparkles,
  Flame,
  Clock,
  BookOpen,
} from 'lucide-react';
import { FlashcardCard } from './flashcard-card';
import { MultipleChoiceCard } from './multiple-choice-card';
import { FillBlankCard } from './fill-blank-card';
import { recordQuestionProgress, saveStudySession, getSubjectMeta } from '@/lib/study';
import type { StudySet, StudyQuestion, ProgressDifficulty } from '@/lib/types';
import { useAuth } from '@/components/auth-provider';

interface PracticeModeProps {
  studySet: StudySet;
  initialQuestions: StudyQuestion[];
}

export function PracticeMode({ studySet, initialQuestions }: PracticeModeProps) {
  const router = useRouter();
  const { user } = useAuth();

  // Queue of questions (supports re-queueing hard questions at the end)
  const [queue, setQueue] = useState<StudyQuestion[]>(initialQuestions);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Practice state
  const [answers, setAnswers] = useState<Record<string, { selected?: string; isCorrect: boolean }>>({});
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [sessionStartTime] = useState(Date.now());
  const [isCompleted, setIsCompleted] = useState(false);
  const [ratingCounts, setRatingCounts] = useState({ easy: 0, medium: 0, hard: 0 });

  const currentQuestion = queue[currentIndex];
  const subjectMeta = getSubjectMeta(studySet.subject);

  const stats = useMemo(() => {
    let correct = 0;
    let incorrect = 0;
    Object.values(answers).forEach((a) => {
      if (a.isCorrect) correct++;
      else incorrect++;
    });
    return { correct, incorrect };
  }, [answers]);

  const progressPercent = queue.length > 0 ? Math.round(((currentIndex + 1) / queue.length) * 100) : 0;

  // Next question handler
  const handleNext = useCallback(() => {
    setIsCardFlipped(false);
    if (currentIndex < queue.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      finishPractice();
    }
  }, [currentIndex, queue.length]);

  // Previous question handler
  const handlePrev = () => {
    setIsCardFlipped(false);
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  // Handle Flashcard Spaced Repetition Rating
  const handleFlashcardRate = async (difficulty: ProgressDifficulty) => {
    if (!currentQuestion || !user) return;

    setRatingCounts((prev) => ({ ...prev, [difficulty]: prev[difficulty] + 1 }));
    const isCorrect = difficulty !== 'hard';

    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: { isCorrect },
    }));

    await recordQuestionProgress(user.id, currentQuestion.id, difficulty, isCorrect);

    // If hard, re-queue at end of queue
    if (difficulty === 'hard') {
      setQueue((prev) => [...prev, currentQuestion]);
    }

    setTimeout(() => {
      handleNext();
    }, 250);
  };

  // Handle Multiple Choice selection
  const handleMultipleChoiceSelect = async (option: 'A' | 'B' | 'C' | 'D') => {
    if (!currentQuestion || !user) return;
    if (answers[currentQuestion.id]?.selected) return; // already answered

    const isCorrect = option === currentQuestion.correct_option;
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: { selected: option, isCorrect },
    }));

    await recordQuestionProgress(user.id, currentQuestion.id, isCorrect ? 'medium' : 'hard', isCorrect);
  };

  // Handle Fill in the blank submit
  const handleFillBlankSubmit = async (val: string, isCorrect: boolean) => {
    if (!currentQuestion || !user) return;
    if (answers[currentQuestion.id]?.selected) return;

    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: { selected: val, isCorrect },
    }));

    await recordQuestionProgress(user.id, currentQuestion.id, isCorrect ? 'medium' : 'hard', isCorrect);
  };

  // Finish practice session
  const finishPractice = async () => {
    setIsCompleted(true);
    const durationSeconds = Math.round((Date.now() - sessionStartTime) / 1000);
    const totalQ = initialQuestions.length;
    const score = totalQ > 0 ? Number(((stats.correct / totalQ) * 10).toFixed(1)) : 0;

    if (user) {
      await saveStudySession({
        user_id: user.id,
        set_id: studySet.id,
        mode: 'practice',
        started_at: new Date(sessionStartTime).toISOString(),
        completed_at: new Date().toISOString(),
        duration_seconds: durationSeconds,
        total_questions: totalQ,
        correct_answers: stats.correct,
        incorrect_answers: stats.incorrect,
        score,
      });
    }
  };

  const handleRestart = () => {
    setQueue(initialQuestions);
    setCurrentIndex(0);
    setAnswers({});
    setIsCardFlipped(false);
    setIsCompleted(false);
    setRatingCounts({ easy: 0, medium: 0, hard: 0 });
  };

  if (queue.length === 0) {
    return (
      <div className="max-w-xl mx-auto text-center py-16 space-y-4">
        <p className="text-lg font-medium">Bộ câu hỏi này chưa có câu hỏi nào.</p>
        <Link href={`/app/study/sets/${studySet.id}`}>
          <Button variant="outline">Thêm câu hỏi ngay</Button>
        </Link>
      </div>
    );
  }

  // SUMMARY SCREEN
  if (isCompleted) {
    const durationSeconds = Math.round((Date.now() - sessionStartTime) / 1000);
    const minutes = Math.floor(durationSeconds / 60);
    const seconds = durationSeconds % 60;
    const accuracy = initialQuestions.length > 0 ? Math.round((stats.correct / initialQuestions.length) * 100) : 0;

    return (
      <div className="max-w-xl mx-auto py-8 px-4 animate-in fade-in zoom-in-95 duration-400">
        <Card className="border-border/80 shadow-lg text-center overflow-hidden">
          <div className="bg-primary/10 py-8 px-6 border-b border-primary/20 flex flex-col items-center">
            <div className="h-16 w-16 rounded-2xl bg-primary/20 text-primary flex items-center justify-center text-3xl mb-3 shadow-inner">
              <Trophy className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold font-display text-foreground">Hoàn thành phiên luyện tập!</h2>
            <p className="text-sm text-muted-foreground mt-1">{studySet.title}</p>
          </div>

          <CardContent className="p-6 sm:p-8 space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-border/70 bg-muted/40 p-3.5">
                <p className="text-xs text-muted-foreground">Độ chính xác</p>
                <p className="text-2xl font-bold text-primary mt-1">{accuracy}%</p>
              </div>

              <div className="rounded-xl border border-border/70 bg-muted/40 p-3.5">
                <p className="text-xs text-muted-foreground">Đúng / Tổng</p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                  {stats.correct} <span className="text-xs text-muted-foreground font-normal">/ {initialQuestions.length}</span>
                </p>
              </div>

              <div className="rounded-xl border border-border/70 bg-muted/40 p-3.5">
                <p className="text-xs text-muted-foreground">Thời gian</p>
                <p className="text-2xl font-bold text-foreground mt-1">
                  {minutes > 0 ? `${minutes}m ` : ''}{seconds}s
                </p>
              </div>
            </div>

            {/* Spaced repetition rating overview if any */}
            {(ratingCounts.easy > 0 || ratingCounts.medium > 0 || ratingCounts.hard > 0) && (
              <div className="rounded-xl border border-border/60 bg-card p-4 space-y-2 text-left">
                <p className="text-xs font-semibold text-muted-foreground">Đánh giá thẻ ghi nhớ:</p>
                <div className="flex gap-4 text-xs">
                  <span className="text-emerald-500 font-medium">Dễ: {ratingCounts.easy}</span>
                  <span className="text-amber-500 font-medium">Bình thường: {ratingCounts.medium}</span>
                  <span className="text-rose-500 font-medium">Khó: {ratingCounts.hard}</span>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button variant="outline" onClick={handleRestart} className="flex-1 rounded-xl h-11">
                <RotateCcw className="h-4 w-4 mr-2" /> Luyện tập lại
              </Button>
              <Link href={`/app/study/sets/${studySet.id}`} className="flex-1">
                <Button className="w-full rounded-xl h-11 font-medium">
                  Về bộ câu hỏi
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Top Navigation & Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Link
            href={`/app/study/sets/${studySet.id}`}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Về trang bộ học
          </Link>

          <Badge variant="outline" className="text-xs font-medium bg-muted/50">
            {subjectMeta.icon} {studySet.title}
          </Badge>
        </div>

        {/* Progress Bar & Counters */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-foreground">
              Câu {currentIndex + 1} <span className="text-muted-foreground font-normal">/ {queue.length}</span>
            </span>

            <div className="flex items-center gap-3">
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                Đúng: {stats.correct}
              </span>
              <span className="text-rose-500 font-medium">
                Sai: {stats.incorrect}
              </span>
            </div>
          </div>

          <Progress value={progressPercent} className="h-2 rounded-full" />
        </div>
      </div>

      {/* Main Question Card Area */}
      <div className="w-full">
        {currentQuestion.type === 'flashcard' ? (
          <FlashcardCard
            question={currentQuestion}
            isFlipped={isCardFlipped}
            onFlipChange={setIsCardFlipped}
            onRate={handleFlashcardRate}
            showControls={true}
          />
        ) : currentQuestion.type === 'multiple_choice' ? (
          <MultipleChoiceCard
            question={currentQuestion}
            selectedOption={answers[currentQuestion.id]?.selected as 'A' | 'B' | 'C' | 'D' | undefined}
            onSelectOption={handleMultipleChoiceSelect}
            showFeedback={true}
          />
        ) : (
          <FillBlankCard
            question={currentQuestion}
            userAnswer={answers[currentQuestion.id]?.selected}
            onSubmitAnswer={handleFillBlankSubmit}
            showFeedback={Boolean(answers[currentQuestion.id])}
          />
        )}
      </div>

      {/* Bottom Navigation Controls */}
      <div className="flex items-center justify-between pt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className="rounded-xl px-4"
        >
          <ChevronLeft className="h-4 w-4 mr-1" /> Câu trước
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={finishPractice}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Kết thúc phiên
        </Button>

        <Button
          size="sm"
          onClick={handleNext}
          className="rounded-xl px-4 font-medium"
        >
          {currentIndex === queue.length - 1 ? 'Hoàn thành' : 'Câu tiếp'} <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
