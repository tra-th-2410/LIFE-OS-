'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth-provider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft,
  BookOpen,
  Clock,
  Plus,
  Sparkles,
  Pencil,
  Trash2,
  Layers,
  Search,
  CheckCircle2,
  Loader2,
  Filter,
} from 'lucide-react';
import { StudyRichText } from '@/components/study/study-rich-text';
import { SetDialog } from '@/components/study/set-dialog';
import { QuestionDialog } from '@/components/study/question-dialog';
import { AiGeneratorDialog } from '@/components/study/ai-generator-dialog';
import {
  fetchStudySetById,
  fetchStudyQuestions,
  updateStudySet,
  createStudyQuestion,
  updateStudyQuestion,
  deleteStudyQuestion,
  getSubjectMeta,
} from '@/lib/study';
import type { StudySet, StudyQuestion, QuestionType } from '@/lib/types';
import { toast } from 'sonner';

export default function StudySetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const setId = params.id as string;
  const { user } = useAuth();

  const [studySet, setStudySet] = useState<StudySet | null>(null);
  const [questions, setQuestions] = useState<StudyQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & search
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Modals state
  const [isEditSetOpen, setIsEditSetOpen] = useState(false);
  const [isAddQuestionOpen, setIsAddQuestionOpen] = useState(false);
  const [isAiGeneratorOpen, setIsAiGeneratorOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<StudyQuestion | null>(null);

  const loadData = useCallback(async () => {
    if (!setId) return;
    setLoading(true);
    try {
      const [setData, questionsData] = await Promise.all([
        fetchStudySetById(setId),
        fetchStudyQuestions(setId),
      ]);
      setStudySet(setData);
      setQuestions(questionsData);
    } catch (err) {
      console.error('Error loading study set details:', err);
      toast.error('Không thể tải thông tin bộ học');
    } finally {
      setLoading(false);
    }
  }, [setId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handlers
  const handleUpdateSet = async (data: {
    title: string;
    subject: string;
    topic: string;
    description: string;
    default_type?: QuestionType;
  }) => {
    if (!studySet) return;
    await updateStudySet(studySet.id, data);
    setStudySet((prev) => (prev ? { ...prev, ...data } : null));
    toast.success('Đã cập nhật thông tin bộ học');
  };

  const handleSaveQuestion = async (data: Omit<StudyQuestion, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      if (editingQuestion) {
        await updateStudyQuestion(editingQuestion.id, data);
        setQuestions((prev) =>
          prev.map((q) =>
            q.id === editingQuestion.id ? { ...q, ...data, updated_at: new Date().toISOString() } : q
          )
        );
        toast.success('Đã cập nhật câu hỏi thành công');
      } else {
        const newQuestion = await createStudyQuestion(data);
        setQuestions((prev) => [...prev.filter((q) => q.id !== newQuestion.id), newQuestion]);
        setStudySet((prev) =>
          prev ? { ...prev, questions_count: (prev.questions_count ?? 0) + 1 } : null
        );
        toast.success('Đã thêm câu hỏi mới vào bộ học');
      }
      setEditingQuestion(null);
      setIsAddQuestionOpen(false);
      // Background sync to ensure sorting and relations match
      loadData();
    } catch (err: unknown) {
      console.error('Error in handleSaveQuestion:', err);
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg || 'Có lỗi xảy ra khi lưu câu hỏi');
    }
  };

  const handleDeleteQuestion = async (qId: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa câu hỏi này không? Thao tác này không thể hoàn tác.')) return;
    try {
      await deleteStudyQuestion(qId);
      setQuestions((prev) => prev.filter((q) => q.id !== qId));
      setStudySet((prev) =>
        prev ? { ...prev, questions_count: Math.max(0, (prev.questions_count ?? 1) - 1) } : null
      );
      toast.success('Đã xóa câu hỏi');
    } catch (err: unknown) {
      console.error('Error in handleDeleteQuestion:', err);
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg || 'Không thể xóa câu hỏi');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!studySet) {
    return (
      <div className="max-w-xl mx-auto text-center py-20 space-y-4">
        <p className="text-lg font-medium">Không tìm thấy bộ câu hỏi này</p>
        <Link href="/app/study">
          <Button variant="outline">Quay lại danh sách</Button>
        </Link>
      </div>
    );
  }

  const subjectMeta = getSubjectMeta(studySet.subject);

  // Filter questions
  const filteredQuestions = questions.filter((q) => {
    const matchesSearch =
      !searchQuery ||
      q.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (q.answer && q.answer.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesType = typeFilter === 'all' || q.type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header Banner */}
      <div className="space-y-4">
        <Link
          href="/app/study"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Về danh sách bộ câu hỏi
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-2xl">{subjectMeta.icon}</span>
              <Badge variant="outline" className="text-xs font-semibold bg-muted/40">
                {subjectMeta.labelVi}
              </Badge>
              {studySet.is_system ? (
                <Badge variant="secondary" className="text-xs font-semibold bg-primary/10 text-primary border-primary/20">
                  🏛️ Mẫu chuẩn hệ thống
                </Badge>
              ) : studySet.default_type ? (
                <Badge variant="outline" className="text-xs text-muted-foreground bg-muted/20">
                  {studySet.default_type === 'multiple_choice'
                    ? '🔘 Trắc nghiệm'
                    : studySet.default_type === 'fill_blank'
                    ? '✏️ Điền từ'
                    : '🃏 Flashcard'}
                </Badge>
              ) : null}
              {studySet.topic && (
                <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20">
                  {studySet.topic}
                </Badge>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold font-display text-foreground">{studySet.title}</h1>
            {studySet.description && (
              <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">{studySet.description}</p>
            )}
          </div>

          {/* Quick Edit (Only for personal sets) */}
          {!studySet.is_system && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditSetOpen(true)}
              className="rounded-xl shrink-0 text-xs self-start gap-1.5"
            >
              <Pencil className="h-3.5 w-3.5" /> Chỉnh sửa bộ
            </Button>
          )}
        </div>

        {/* Action Bar */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Link href={`/app/study/sets/${studySet.id}/practice`}>
            <Button disabled={questions.length === 0} className="rounded-xl font-medium gap-2 h-11 px-5">
              <BookOpen className="h-4 w-4" /> Luyện tập ({questions.length})
            </Button>
          </Link>

          <Link href={`/app/study/sets/${studySet.id}/exam`}>
            <Button
              variant="outline"
              disabled={questions.length === 0}
              className="rounded-xl font-medium gap-2 h-11 px-5 border-border/80"
            >
              <Clock className="h-4 w-4" /> Thi thử
            </Button>
          </Link>

          {!studySet.is_system && (
            <>
              <div className="h-6 w-px bg-border hidden sm:block mx-1" />

              <Button
                variant="outline"
                onClick={() => {
                  setEditingQuestion(null);
                  setIsAddQuestionOpen(true);
                }}
                className="rounded-xl text-xs gap-1.5 h-11"
              >
                <Plus className="h-4 w-4" /> Thêm câu hỏi
              </Button>

              <Button
                variant="outline"
                onClick={() => setIsAiGeneratorOpen(true)}
                className="rounded-xl text-xs gap-1.5 h-11 border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50"
              >
                <Sparkles className="h-4 w-4" /> Tạo bằng AI
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Questions Management List */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold font-display">Danh sách câu hỏi</h2>
            <Badge variant="outline" className="text-xs">
              {questions.length} câu
            </Badge>
          </div>

          {/* Filter & Search */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm câu hỏi..."
                className="h-9 pl-9 text-xs rounded-xl"
              />
            </div>

            <div className="flex items-center gap-1 p-0.5 rounded-lg bg-muted/60 border border-border/60">
              {[
                { id: 'all', label: 'Tất cả' },
                { id: 'flashcard', label: 'Flashcard' },
                { id: 'multiple_choice', label: 'Trắc nghiệm' },
                { id: 'fill_blank', label: 'Điền từ' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setTypeFilter(tab.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    typeFilter === tab.id
                      ? 'bg-background shadow-xs text-foreground font-semibold'
                      : 'text-muted-foreground'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* List */}
        {filteredQuestions.length === 0 ? (
          <Card className="border-dashed border-2 border-border/70 p-12 text-center space-y-4">
            <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center mx-auto text-muted-foreground">
              <Layers className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-semibold">Chưa có câu hỏi nào</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Hãy thêm câu hỏi thủ công hoặc sử dụng AI để tự động trích xuất câu hỏi từ bài học.
              </p>
            </div>
            <div className="flex justify-center gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditingQuestion(null);
                  setIsAddQuestionOpen(true);
                }}
                className="rounded-xl text-xs gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" /> Thêm thủ công
              </Button>
              <Button
                size="sm"
                onClick={() => setIsAiGeneratorOpen(true)}
                className="rounded-xl text-xs gap-1.5 font-medium"
              >
                <Sparkles className="h-3.5 w-3.5" /> Tạo bằng AI
              </Button>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredQuestions.map((q, idx) => (
              <Card key={q.id} className="border-border/80 shadow-xs hover:border-border transition-colors">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-muted-foreground">#{idx + 1}</span>
                      <Badge variant="outline" className="text-[10px] font-semibold uppercase">
                        {q.type === 'multiple_choice'
                          ? 'Trắc nghiệm'
                          : q.type === 'fill_blank'
                          ? 'Điền từ'
                          : 'Flashcard'}
                      </Badge>
                    </div>

                    {!studySet.is_system && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingQuestion(q);
                            setIsAddQuestionOpen(true);
                          }}
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteQuestion(q.id)}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Question text with LaTeX */}
                  <div className="text-base font-medium leading-relaxed">
                    <StudyRichText content={q.question} />
                  </div>

                  {/* Details depending on type */}
                  {q.type === 'multiple_choice' && q.options && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                      {(['A', 'B', 'C', 'D'] as const).map((key) => (
                        <div
                          key={key}
                          className={`p-2.5 rounded-lg border flex items-center gap-2 ${
                            q.correct_option === key
                              ? 'border-emerald-500 bg-emerald-500/10 text-emerald-900 dark:text-emerald-300 font-semibold'
                              : 'border-border/60 bg-muted/20 text-muted-foreground'
                          }`}
                        >
                          <span className="font-bold">{key}.</span>
                          <StudyRichText content={q.options?.[key]} inline />
                        </div>
                      ))}
                    </div>
                  )}

                  {q.type !== 'multiple_choice' && (
                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs sm:text-sm font-semibold text-primary">
                      <span className="text-muted-foreground font-normal">Đáp án: </span>
                      <StudyRichText content={q.answer} inline />
                    </div>
                  )}

                  {q.explanation && (
                    <p className="text-xs text-muted-foreground italic border-t border-border/40 pt-2">
                      Giải thích: <StudyRichText content={q.explanation} inline />
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <SetDialog
        open={isEditSetOpen}
        onOpenChange={setIsEditSetOpen}
        studySet={studySet}
        onSave={handleUpdateSet}
      />

      <QuestionDialog
        open={isAddQuestionOpen}
        onOpenChange={setIsAddQuestionOpen}
        question={editingQuestion}
        setId={studySet.id}
        defaultType={(studySet.default_type as QuestionType) || 'flashcard'}
        onSave={handleSaveQuestion}
      />

      <AiGeneratorDialog
        open={isAiGeneratorOpen}
        onOpenChange={setIsAiGeneratorOpen}
        studySet={studySet}
        onSuccess={loadData}
      />
    </div>
  );
}
