'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Trophy,
  RotateCcw,
  BookOpen,
  Check,
  X,
  Filter,
} from 'lucide-react';
import { MultipleChoiceCard } from './multiple-choice-card';
import { FillBlankCard } from './fill-blank-card';
import { StudyRichText } from './study-rich-text';
import { smartAnswerCompare, saveStudySession, getSubjectMeta, recordQuestionProgress } from '@/lib/study';
import type { StudySet, StudyQuestion } from '@/lib/types';
import { useAuth } from '@/components/auth-provider';

interface ExamModeProps {
  studySet: StudySet;
  allQuestions: StudyQuestion[];
}

export function ExamMode({ studySet, allQuestions }: ExamModeProps) {
  const router = useRouter();
  const { user } = useAuth();
  const subjectMeta = getSubjectMeta(studySet.subject);

  // Config phase
  const [isStarted, setIsStarted] = useState(false);
  const [questionCount, setQuestionCount] = useState<number>(Math.min(20, allQuestions.length));
  const [durationMinutes, setDurationMinutes] = useState<number>(15);

  // Exam phase
  const [examQuestions, setExamQuestions] = useState<StudyQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<string>>(new Set());
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);
  const [isSubmitConfirmOpen, setIsSubmitConfirmOpen] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<number>(0);

  // Results filter
  const [resultFilter, setResultFilter] = useState<'all' | 'wrong' | 'correct'>('all');

  // Start Exam
  const handleStartExam = () => {
    // Shuffle and pick questions
    const shuffled = [...allQuestions].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, Math.min(questionCount, allQuestions.length));
    setExamQuestions(selected);
    setCurrentIndex(0);
    setUserAnswers({});
    setFlaggedQuestions(new Set());
    setSecondsRemaining(durationMinutes * 60);
    setSessionStartTime(Date.now());
    setIsStarted(true);
    setIsCompleted(false);
  };

  // Timer tick
  useEffect(() => {
    if (!isStarted || isCompleted || secondsRemaining <= 0) return;

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmitExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isStarted, isCompleted, secondsRemaining]);

  const toggleFlag = (qId: string) => {
    setFlaggedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(qId)) next.delete(qId);
      else next.add(qId);
      return next;
    });
  };

  const handleAnswerChange = (qId: string, answer: string) => {
    setUserAnswers((prev) => ({ ...prev, [qId]: answer }));
  };

  // Calculate results
  const examResults = useMemo(() => {
    if (!isCompleted || examQuestions.length === 0) return null;

    let correctCount = 0;
    let incorrectCount = 0;
    let skippedCount = 0;

    const details = examQuestions.map((q) => {
      const uAns = userAnswers[q.id] || '';
      let isCorrect = false;

      if (!uAns.trim()) {
        skippedCount++;
      } else if (q.type === 'multiple_choice') {
        isCorrect = uAns === q.correct_option;
        if (isCorrect) correctCount++;
        else incorrectCount++;
      } else if (q.type === 'fill_blank') {
        isCorrect = q.answer ? smartAnswerCompare(uAns, q.answer) : false;
        if (isCorrect) correctCount++;
        else incorrectCount++;
      } else {
        // flashcard
        isCorrect = q.answer ? smartAnswerCompare(uAns, q.answer) : false;
        if (isCorrect) correctCount++;
        else incorrectCount++;
      }

      return {
        question: q,
        userAnswer: uAns,
        isCorrect,
        isSkipped: !uAns.trim(),
      };
    });

    const total = examQuestions.length;
    const score = total > 0 ? Number(((correctCount / total) * 10).toFixed(1)) : 0;
    const percentage = total > 0 ? Math.round((correctCount / total) * 100) : 0;

    return {
      total,
      correctCount,
      incorrectCount,
      skippedCount,
      score,
      percentage,
      details,
    };
  }, [isCompleted, examQuestions, userAnswers]);

  // Submit Exam Handler
  const handleSubmitExam = useCallback(async () => {
    setIsSubmitConfirmOpen(false);
    setIsCompleted(true);

    const timeSpent = Math.round((Date.now() - sessionStartTime) / 1000);

    // Save session and question progress
    let correct = 0;
    let incorrect = 0;

    examQuestions.forEach((q) => {
      const uAns = userAnswers[q.id] || '';
      let isCorr = false;
      if (q.type === 'multiple_choice') {
        isCorr = uAns === q.correct_option;
      } else if (q.answer) {
        isCorr = smartAnswerCompare(uAns, q.answer);
      }
      if (isCorr) correct++;
      else incorrect++;

      if (user) {
        recordQuestionProgress(user.id, q.id, isCorr ? 'medium' : 'hard', isCorr);
      }
    });

    const totalQ = examQuestions.length;
    const finalScore = totalQ > 0 ? Number(((correct / totalQ) * 10).toFixed(1)) : 0;

    if (user) {
      await saveStudySession({
        user_id: user.id,
        set_id: studySet.id,
        mode: 'exam',
        started_at: new Date(sessionStartTime).toISOString(),
        completed_at: new Date().toISOString(),
        duration_seconds: timeSpent,
        total_questions: totalQ,
        correct_answers: correct,
        incorrect_answers: incorrect,
        score: finalScore,
      });
    }
  }, [examQuestions, userAnswers, sessionStartTime, user, studySet.id]);

  const currentQ = examQuestions[currentIndex];

  // 1. CONFIGURATION SCREEN
  if (!isStarted) {
    return (
      <div className="max-w-xl mx-auto py-8 px-4">
        <Card className="border-border/80 shadow-md">
          <div className="bg-primary/10 py-6 px-6 border-b border-primary/20 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-display text-foreground">Cấu hình bài thi thử</h2>
              <p className="text-xs text-muted-foreground">{studySet.title}</p>
            </div>
          </div>

          <CardContent className="p-6 space-y-6">
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Số lượng câu hỏi:</Label>
              <div className="grid grid-cols-4 gap-2">
                {[10, 15, 20, allQuestions.length].map((count, idx) => {
                  const label = idx === 3 ? `Tất cả (${allQuestions.length})` : `${count} câu`;
                  const actualVal = Math.min(count, allQuestions.length);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setQuestionCount(actualVal)}
                      className={`p-3 rounded-xl border text-xs font-semibold transition-all ${
                        questionCount === actualVal
                          ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary'
                          : 'border-border/70 hover:bg-muted/50 text-muted-foreground'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-semibold">Thời gian làm bài:</Label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {[5, 10, 15, 30, 45, 60].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setDurationMinutes(mins)}
                    className={`p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                      durationMinutes === mins
                        ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary'
                        : 'border-border/70 hover:bg-muted/50 text-muted-foreground'
                    }`}
                  >
                    {mins} phút
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl bg-muted/40 p-4 border border-border/70 text-xs space-y-1 text-muted-foreground">
              <p className="font-semibold text-foreground">Quy chế thi thử:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Không hiển thị đáp án và lời giải trong lúc làm bài.</li>
                <li>Có thể tự do chuyển đổi giữa các câu và đánh dấu câu chưa chắc chắn.</li>
                <li>Hệ thống tự động nộp bài khi hết giờ.</li>
              </ul>
            </div>

            <div className="flex gap-3 pt-2">
              <Link href={`/app/study/sets/${studySet.id}`} className="flex-1">
                <Button variant="outline" className="w-full rounded-xl h-11">
                  Hủy
                </Button>
              </Link>
              <Button onClick={handleStartExam} className="flex-1 rounded-xl h-11 font-medium">
                Bắt đầu làm bài
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 2. EXAM REPORT / RESULTS SCREEN
  if (isCompleted && examResults) {
    const timeSpent = Math.round((Date.now() - sessionStartTime) / 1000);
    const mSpent = Math.floor(timeSpent / 60);
    const sSpent = timeSpent % 60;

    const filteredDetails = examResults.details.filter((item) => {
      if (resultFilter === 'wrong') return !item.isCorrect;
      if (resultFilter === 'correct') return item.isCorrect;
      return true;
    });

    return (
      <div className="max-w-3xl mx-auto py-8 px-4 space-y-6 animate-in fade-in duration-400">
        {/* Top Summary Card */}
        <Card className="border-border/80 shadow-lg text-center overflow-hidden">
          <div className="bg-primary/10 py-8 px-6 border-b border-primary/20 flex flex-col items-center">
            <div className="h-16 w-16 rounded-2xl bg-primary/20 text-primary flex items-center justify-center text-3xl mb-3">
              <Trophy className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold font-display text-foreground">Kết quả bài thi</h2>
            <p className="text-sm text-muted-foreground mt-1">{studySet.title}</p>
          </div>

          <CardContent className="p-6 sm:p-8 space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-border/70 bg-muted/40 p-3.5">
                <p className="text-xs text-muted-foreground">Điểm số</p>
                <p className="text-2xl font-bold text-primary mt-1">
                  {examResults.score} <span className="text-xs text-muted-foreground font-normal">/ 10</span>
                </p>
              </div>

              <div className="rounded-xl border border-border/70 bg-muted/40 p-3.5">
                <p className="text-xs text-muted-foreground">Đúng</p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                  {examResults.correctCount} <span className="text-xs text-muted-foreground font-normal">/ {examResults.total}</span>
                </p>
              </div>

              <div className="rounded-xl border border-border/70 bg-muted/40 p-3.5">
                <p className="text-xs text-muted-foreground">Sai / Bỏ trống</p>
                <p className="text-2xl font-bold text-rose-500 mt-1">
                  {examResults.incorrectCount + examResults.skippedCount}
                </p>
              </div>

              <div className="rounded-xl border border-border/70 bg-muted/40 p-3.5">
                <p className="text-xs text-muted-foreground">Thời gian làm</p>
                <p className="text-2xl font-bold text-foreground mt-1">
                  {mSpent > 0 ? `${mSpent}m ` : ''}{sSpent}s
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button variant="outline" onClick={handleStartExam} className="flex-1 rounded-xl h-11">
                <RotateCcw className="h-4 w-4 mr-2" /> Thi lại
              </Button>
              <Link href={`/app/study/sets/${studySet.id}/practice`} className="flex-1">
                <Button variant="outline" className="w-full rounded-xl h-11">
                  <BookOpen className="h-4 w-4 mr-2" /> Luyện tập bộ này
                </Button>
              </Link>
              <Link href={`/app/study/sets/${studySet.id}`} className="flex-1">
                <Button className="w-full rounded-xl h-11 font-medium">
                  Về trang bộ học
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Detailed Question Review Breakdown */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <h3 className="font-semibold text-base sm:text-lg flex items-center gap-2">
              <span>Xem lại chi tiết từng câu hỏi</span>
              <Badge variant="outline" className="text-xs">
                {filteredDetails.length} câu
              </Badge>
            </h3>

            {/* Filter Buttons */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/60 border border-border/60">
              <button
                onClick={() => setResultFilter('all')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  resultFilter === 'all' ? 'bg-background shadow-xs text-foreground font-semibold' : 'text-muted-foreground'
                }`}
              >
                Tất cả ({examResults.total})
              </button>
              <button
                onClick={() => setResultFilter('wrong')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  resultFilter === 'wrong' ? 'bg-background shadow-xs text-rose-500 font-semibold' : 'text-muted-foreground'
                }`}
              >
                Câu sai ({examResults.incorrectCount + examResults.skippedCount})
              </button>
              <button
                onClick={() => setResultFilter('correct')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  resultFilter === 'correct' ? 'bg-background shadow-xs text-emerald-500 font-semibold' : 'text-muted-foreground'
                }`}
              >
                Câu đúng ({examResults.correctCount})
              </button>
            </div>
          </div>

          {/* List of Questions with Explanation */}
          <div className="space-y-4">
            {filteredDetails.map((item, idx) => (
              <Card
                key={item.question.id}
                className={`border shadow-xs ${
                  item.isCorrect ? 'border-emerald-500/40 bg-card' : 'border-rose-500/40 bg-card'
                }`}
              >
                <CardContent className="p-5 sm:p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <Badge
                      className={`text-xs font-medium gap-1 ${
                        item.isCorrect
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                          : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                      }`}
                      variant="outline"
                    >
                      {item.isCorrect ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      {item.isCorrect ? 'Đúng' : item.isSkipped ? 'Chưa trả lời' : 'Sai'}
                    </Badge>

                    <span className="text-xs text-muted-foreground">
                      {item.question.type === 'multiple_choice'
                        ? 'Trắc nghiệm'
                        : item.question.type === 'fill_blank'
                        ? 'Điền từ'
                        : 'Flashcard'}
                    </span>
                  </div>

                  <div className="text-base font-medium leading-relaxed">
                    <StudyRichText content={item.question.question} />
                  </div>

                  {/* Answers Comparison */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-sm">
                    <div className="p-3 rounded-xl border border-border/70 bg-muted/40">
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Lựa chọn của bạn:</p>
                      <p className={`font-medium ${item.isCorrect ? 'text-emerald-600' : 'text-rose-500'}`}>
                        {item.userAnswer || <span className="text-muted-foreground italic">(Chưa chọn)</span>}
                      </p>
                    </div>

                    <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5">
                      <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-1">Đáp án đúng:</p>
                      <div className="font-semibold text-emerald-700 dark:text-emerald-300">
                        {item.question.type === 'multiple_choice' ? (
                          <span>
                            {item.question.correct_option}. {item.question.options?.[item.question.correct_option as 'A' | 'B' | 'C' | 'D']}
                          </span>
                        ) : (
                          <StudyRichText content={item.question.answer} inline />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Explanation */}
                  {item.question.explanation && (
                    <div className="rounded-xl bg-muted/60 p-4 border border-border/60 text-sm space-y-1.5">
                      <p className="text-xs font-semibold text-foreground">Giải thích chi tiết:</p>
                      <div className="text-muted-foreground text-xs sm:text-sm leading-relaxed">
                        <StudyRichText content={item.question.explanation} />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 3. RUNNING EXAM UI
  const timerMins = Math.floor(secondsRemaining / 60);
  const timerSecs = secondsRemaining % 60;
  const isTimeCritical = secondsRemaining < 60;
  const isTimeWarning = secondsRemaining < 300;

  const answeredCount = Object.keys(userAnswers).filter((k) => userAnswers[k]?.trim()).length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Sticky Exam Header with Timer & Palette */}
      <div className="sticky top-16 z-20 glass p-4 rounded-2xl border border-border/70 shadow-sm flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-xs font-medium">
            {subjectMeta.icon} {studySet.title}
          </Badge>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            Đã làm: {answeredCount}/{examQuestions.length} câu
          </span>
        </div>

        {/* Countdown Timer */}
        <div
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-mono text-sm font-bold border transition-colors ${
            isTimeCritical
              ? 'bg-rose-500 text-white border-rose-600 animate-pulse'
              : isTimeWarning
              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
              : 'bg-muted/80 text-foreground border-border/70'
          }`}
        >
          <Clock className="h-4 w-4" />
          <span>
            {String(timerMins).padStart(2, '0')}:{String(timerSecs).padStart(2, '0')}
          </span>
        </div>

        {/* Submit button */}
        <Button
          size="sm"
          onClick={() => setIsSubmitConfirmOpen(true)}
          className="rounded-xl px-4 font-medium"
        >
          Nộp bài
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Question Area (3 cols) */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-base">
              Câu {currentIndex + 1} <span className="text-xs font-normal text-muted-foreground">/ {examQuestions.length}</span>
            </span>

            {/* Flag button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => toggleFlag(currentQ.id)}
              className={`rounded-xl text-xs gap-1.5 ${
                flaggedQuestions.has(currentQ.id)
                  ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold'
                  : 'text-muted-foreground'
              }`}
            >
              <Flag className={`h-3.5 w-3.5 ${flaggedQuestions.has(currentQ.id) ? 'fill-current' : ''}`} />
              {flaggedQuestions.has(currentQ.id) ? 'Đã đánh dấu' : 'Đánh dấu câu'}
            </Button>
          </div>

          {/* Render Question */}
          {currentQ.type === 'multiple_choice' ? (
            <MultipleChoiceCard
              question={currentQ}
              selectedOption={userAnswers[currentQ.id] as 'A' | 'B' | 'C' | 'D' | undefined}
              onSelectOption={(opt) => handleAnswerChange(currentQ.id, opt)}
              showFeedback={false}
            />
          ) : currentQ.type === 'fill_blank' ? (
            <FillBlankCard
              question={currentQ}
              userAnswer={userAnswers[currentQ.id] || ''}
              onAnswerChange={(val) => handleAnswerChange(currentQ.id, val)}
              showFeedback={false}
            />
          ) : (
            <Card className="border-border/80 shadow-sm p-6 space-y-4">
              <Badge variant="outline" className="text-xs">
                Thẻ ghi nhớ • Điền câu trả lời
              </Badge>
              <div className="text-base font-medium leading-relaxed">
                <StudyRichText content={currentQ.question} />
              </div>
              <div className="space-y-2 pt-2">
                <Label className="text-xs font-semibold">Đáp án của bạn:</Label>
                <Input
                  value={userAnswers[currentQ.id] || ''}
                  onChange={(e) => handleAnswerChange(currentQ.id, e.target.value)}
                  placeholder="Nhập câu trả lời..."
                  className="h-11 rounded-xl"
                />
              </div>
            </Card>
          )}

          {/* Navigation Controls */}
          <div className="flex items-center justify-between pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentIndex((p) => Math.max(0, p - 1))}
              disabled={currentIndex === 0}
              className="rounded-xl px-4"
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Câu trước
            </Button>

            <Button
              size="sm"
              onClick={() => {
                if (currentIndex < examQuestions.length - 1) {
                  setCurrentIndex((p) => p + 1);
                } else {
                  setIsSubmitConfirmOpen(true);
                }
              }}
              className="rounded-xl px-4 font-medium"
            >
              {currentIndex === examQuestions.length - 1 ? 'Xem lại & Nộp bài' : 'Câu tiếp'} <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>

        {/* Question Palette Sidebar (1 col) */}
        <div className="lg:col-span-1">
          <Card className="border-border/70 shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border/50">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Danh sách câu</span>
              <span className="text-xs font-semibold text-primary">
                {answeredCount}/{examQuestions.length}
              </span>
            </div>

            <div className="grid grid-cols-5 gap-1.5">
              {examQuestions.map((q, idx) => {
                const isAnswered = Boolean(userAnswers[q.id]?.trim());
                const isFlagged = flaggedQuestions.has(q.id);
                const isCurrent = currentIndex === idx;

                let btnStyle = 'border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted';
                if (isCurrent) {
                  btnStyle = 'ring-2 ring-primary border-primary bg-primary/10 text-primary font-bold';
                } else if (isAnswered) {
                  btnStyle = 'bg-primary text-primary-foreground font-semibold border-primary';
                }

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setCurrentIndex(idx)}
                    className={`relative h-9 rounded-lg text-xs font-medium transition-all flex items-center justify-center border ${btnStyle}`}
                  >
                    {idx + 1}
                    {isFlagged && (
                      <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-amber-500" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-border/50 space-y-1 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded bg-primary" /> Đã trả lời
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded border border-border bg-muted/30" /> Chưa làm
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-amber-500" /> Đã gắn cờ
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Confirmation Dialog before Submitting */}
      <Dialog open={isSubmitConfirmOpen} onOpenChange={setIsSubmitConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Xác nhận nộp bài thi</DialogTitle>
            <DialogDescription>
              Bạn đã hoàn thành <strong className="text-foreground">{answeredCount}</strong> / {examQuestions.length} câu.
              {answeredCount < examQuestions.length && (
                <span className="block text-rose-500 mt-2 font-medium">
                  Cảnh báo: Bạn vẫn còn {examQuestions.length - answeredCount} câu chưa trả lời.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsSubmitConfirmOpen(false)}>
              Tiếp tục làm bài
            </Button>
            <Button onClick={handleSubmitExam} className="font-medium">
              Nộp bài ngay
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
