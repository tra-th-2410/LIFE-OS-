'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { STUDY_SUBJECTS } from '@/lib/study';
import { StudyRichText } from './study-rich-text';
import type { StudySet, QuestionType } from '@/lib/types';
import { Plus, Trash2, Check, Eye, Edit3, Loader2, Sparkles, Layers, BookOpen } from 'lucide-react';
import { toast } from 'sonner';

export interface DraftQuestionItem {
  id: string; // client temporary ID
  type: QuestionType;
  question: string;
  answer: string;
  explanation: string;
  options: { A: string; B: string; C: string; D: string };
  correct_option: 'A' | 'B' | 'C' | 'D';
  preview: boolean;
}

function createEmptyQuestion(index: number, defaultType: QuestionType = 'flashcard'): DraftQuestionItem {
  return {
    id: `draft-q-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 6)}`,
    type: defaultType,
    question: '',
    answer: '',
    explanation: '',
    options: { A: '', B: '', C: '', D: '' },
    correct_option: 'A',
    preview: false,
  };
}

interface SetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studySet?: StudySet | null;
  onSave: (data: {
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
  }) => Promise<void>;
}

export function SetDialog({ open, onOpenChange, studySet, onSave }: SetDialogProps) {
  const isEditing = !!studySet;

  // Study Set metadata state
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('math');
  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [defaultType, setDefaultType] = useState<QuestionType>('flashcard');

  // Multi-question list state (always initialized with Question 1)
  const [questions, setQuestions] = useState<DraftQuestionItem[]>([createEmptyQuestion(1, 'flashcard')]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (studySet) {
      setTitle(studySet.title || '');
      setSubject(studySet.subject || 'math');
      setTopic(studySet.topic || '');
      setDescription(studySet.description || '');
      setDefaultType((studySet.default_type as QuestionType) || 'flashcard');
    } else {
      setTitle('');
      setSubject('math');
      setTopic('');
      setDescription('');
      setDefaultType('flashcard');
      // Always reset with Question 1 for new set
      setQuestions([createEmptyQuestion(1, 'flashcard')]);
    }
  }, [studySet, open]);

  // Add Question handler
  const handleAddQuestion = () => {
    setQuestions((prev) => [...prev, createEmptyQuestion(prev.length + 1, defaultType)]);
  };

  // Delete Question handler (Must keep at least 1 question)
  const handleDeleteQuestion = (index: number) => {
    if (questions.length <= 1) {
      toast.error('Bộ học phải có ít nhất 1 câu hỏi');
      return;
    }
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  // Update specific question field
  const handleUpdateQuestion = (index: number, updates: Partial<DraftQuestionItem>) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, ...updates } : q))
    );
  };

  // Update option A, B, C, D for multiple choice
  const handleUpdateOption = (qIndex: number, optKey: 'A' | 'B' | 'C' | 'D', value: string) => {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIndex ? { ...q, options: { ...q.options, [optKey]: value } } : q
      )
    );
  };

  // Toggle Live Preview for a single question
  const toggleQuestionPreview = (index: number) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, preview: !q.preview } : q))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Validate Set Meta
    if (!title.trim()) {
      toast.error('Vui lòng nhập tên bộ học');
      return;
    }
    if (!subject) {
      toast.error('Vui lòng chọn môn học');
      return;
    }
    if (!topic.trim()) {
      toast.error('Vui lòng nhập chủ đề / chuyên đề');
      return;
    }

    // 2. Validate Questions (only if creating a new set)
    if (!isEditing) {
      if (questions.length === 0) {
        toast.error('Bộ học phải có ít nhất 1 câu hỏi');
        return;
      }

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const qNum = i + 1;

        if (!q.question.trim()) {
          toast.error(`Câu hỏi ${qNum}: Vui lòng nhập nội dung câu hỏi / đề bài`);
          return;
        }

        if (q.type === 'multiple_choice') {
          if (!q.options.A.trim() || !q.options.B.trim() || !q.options.C.trim() || !q.options.D.trim()) {
            toast.error(`Câu hỏi ${qNum} (Trắc nghiệm): Vui lòng nhập đầy đủ 4 lựa chọn A, B, C, D`);
            return;
          }
        } else if (q.type === 'fill_blank') {
          if (!q.answer.trim()) {
            toast.error(`Câu hỏi ${qNum} (Điền từ): Vui lòng nhập đáp án chính xác`);
            return;
          }
        } else {
          // flashcard
          if (!q.answer.trim()) {
            toast.error(`Câu hỏi ${qNum} (Flashcard): Vui lòng nhập đáp án mặt sau`);
            return;
          }
        }
      }
    }

    setSaving(true);
    try {
      if (isEditing) {
        await onSave({
          title: title.trim(),
          subject,
          topic: topic.trim(),
          description: description.trim(),
          default_type: defaultType,
        });
      } else {
        // Format questions payload
        const formattedQuestions = questions.map((q) => ({
          type: q.type,
          question: q.question.trim(),
          answer: q.type === 'multiple_choice' ? q.options[q.correct_option].trim() : q.answer.trim(),
          explanation: q.explanation.trim() || null,
          options: q.type === 'multiple_choice' ? q.options : null,
          correct_option: q.type === 'multiple_choice' ? q.correct_option : null,
        }));

        await onSave({
          title: title.trim(),
          subject,
          topic: topic.trim(),
          description: description.trim(),
          default_type: formattedQuestions[0]?.type || 'flashcard',
          questions: formattedQuestions,
        });
      }

      onOpenChange(false);
    } catch (err: unknown) {
      console.error('Error saving in SetDialog:', err);
      // Toast already shown or handled
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl lg:max-w-4xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="flex items-center gap-2 text-primary font-bold">
              <BookOpen className="h-5 w-5" />
              <DialogTitle>{isEditing ? 'Chỉnh sửa bộ câu hỏi' : 'Tự mình tạo bộ học mới'}</DialogTitle>
            </div>
            <DialogDescription>
              {isEditing
                ? 'Cập nhật tiêu đề, môn học và chuyên đề cho bộ câu hỏi.'
                : 'Nhập thông tin bộ học và soạn thảo các câu hỏi bên trong ngay trên cùng một form.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* ========================================================= */}
            {/* SECTION 1: THÔNG TIN BỘ HỌC                               */}
            {/* ========================================================= */}
            <div className="p-4 sm:p-5 rounded-2xl border border-border/80 bg-muted/20 space-y-4">
              <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                <Layers className="h-4 w-4 text-primary" /> Thông tin bộ học
              </div>

              {/* Set Title */}
              <div className="space-y-1.5">
                <Label htmlFor="set-title" className="text-xs font-semibold">
                  Tên bộ học <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="set-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ví dụ: Định lý Thales trong tam giác, Khảo sát hàm số 12..."
                  className="h-11 rounded-xl font-medium"
                  required
                />
              </div>

              {/* Subject & Topic */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="set-subject" className="text-xs font-semibold">
                    Môn học <span className="text-destructive">*</span>
                  </Label>
                  <Select value={subject} onValueChange={setSubject}>
                    <SelectTrigger id="set-subject" className="h-11 rounded-xl">
                      <SelectValue placeholder="Chọn môn học" />
                    </SelectTrigger>
                    <SelectContent>
                      {STUDY_SUBJECTS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.icon} {s.labelVi}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="set-topic" className="text-xs font-semibold">
                    Chủ đề / Chuyên đề <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="set-topic"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Ví dụ: Định lý Thales, Dao động cơ, Este..."
                    className="h-11 rounded-xl"
                    required
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label htmlFor="set-desc" className="text-xs font-semibold">
                  Mô tả thêm (tùy chọn):
                </Label>
                <Input
                  id="set-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Mô tả ngắn về nội dung hoặc mục tiêu bài học..."
                  className="h-10 rounded-xl text-xs sm:text-sm"
                />
              </div>
            </div>

            {/* ========================================================= */}
            {/* SECTION 2: DANH SÁCH CÂU HỎI (CHO FLOW TỰ TẠO)           */}
            {/* ========================================================= */}
            {!isEditing && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-foreground">Danh sách câu hỏi</h3>
                    <Badge variant="secondary" className="text-xs font-semibold bg-primary/10 text-primary">
                      {questions.length} câu
                    </Badge>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    Hỗ trợ LaTeX: <code className="bg-muted px-1 py-0.5 rounded font-mono text-[10px]">$công_thức$</code>
                  </span>
                </div>

                {/* Questions List */}
                <div className="space-y-4">
                  {questions.map((q, idx) => (
                    <Card key={q.id} className="border-border/80 shadow-xs relative overflow-hidden">
                      <CardContent className="p-4 sm:p-5 space-y-4">
                        {/* Question Header: Number + Type Selector + Preview Toggle + Delete */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/50">
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-xs">
                              #{idx + 1}
                            </span>
                            <span className="font-bold text-sm text-foreground">Câu hỏi {idx + 1}</span>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Question Type Toggle Pills */}
                            <div className="flex items-center gap-1 p-0.5 rounded-lg bg-muted/60 border border-border/60">
                              <button
                                type="button"
                                onClick={() => handleUpdateQuestion(idx, { type: 'flashcard' })}
                                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                                  q.type === 'flashcard'
                                    ? 'bg-background shadow-xs text-primary font-semibold'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                              >
                                🃏 Flashcard
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateQuestion(idx, { type: 'multiple_choice' })}
                                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                                  q.type === 'multiple_choice'
                                    ? 'bg-background shadow-xs text-primary font-semibold'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                              >
                                🔘 Trắc nghiệm
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateQuestion(idx, { type: 'fill_blank' })}
                                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                                  q.type === 'fill_blank'
                                    ? 'bg-background shadow-xs text-primary font-semibold'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                              >
                                ✏️ Điền từ
                              </button>
                            </div>

                            {/* Preview Toggle Button */}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleQuestionPreview(idx)}
                              className={`h-8 px-2.5 rounded-lg text-xs gap-1 ${
                                q.preview ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground'
                              }`}
                            >
                              <Eye className="h-3.5 w-3.5" />
                              {q.preview ? 'Soạn thảo' : 'Xem trước'}
                            </Button>

                            {/* Delete Question Button */}
                            {questions.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteQuestion(idx)}
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                title="Xóa câu hỏi này"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Question Content Form OR Live Preview */}
                        {!q.preview ? (
                          <div className="space-y-4">
                            {/* Question text / prompt */}
                            <div className="space-y-1.5">
                              <Label className="text-xs font-semibold">
                                {q.type === 'flashcard'
                                  ? 'Mặt trước (Câu hỏi / Thuật ngữ / Công thức):'
                                  : q.type === 'fill_blank'
                                  ? 'Đề bài / Câu hỏi (dùng "___" làm vị trí khuyết từ):'
                                  : 'Nội dung câu hỏi trắc nghiệm:'}{' '}
                                <span className="text-destructive">*</span>
                              </Label>
                              <Textarea
                                value={q.question}
                                onChange={(e) => handleUpdateQuestion(idx, { question: e.target.value })}
                                placeholder={
                                  q.type === 'flashcard'
                                    ? 'Ví dụ: Định lý Thales thuận trong tam giác phát biểu như thế nào?'
                                    : q.type === 'fill_blank'
                                    ? 'Ví dụ: Hệ quả định lý Thales: $\\frac{AM}{AB} = \\frac{AN}{AC} = ___$'
                                    : 'Ví dụ: Cho tam giác $ABC$, đường thẳng $DE \\parallel BC$. Khẳng định nào sau đây đúng?'
                                }
                                rows={2}
                                className="rounded-xl font-mono text-xs sm:text-sm resize-none"
                                required
                              />
                            </div>

                            {/* Multiple Choice: 4 Options A, B, C, D */}
                            {q.type === 'multiple_choice' ? (
                              <div className="space-y-2.5 pt-1">
                                <div className="flex items-center justify-between">
                                  <Label className="text-xs font-semibold">4 lựa chọn & Chọn đáp án đúng:</Label>
                                  <span className="text-[11px] text-muted-foreground">
                                    Bấm vào nút <span className="font-semibold text-emerald-600">A, B, C, D</span> để chọn đáp án đúng
                                  </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                  {(['A', 'B', 'C', 'D'] as const).map((optKey) => {
                                    const isCorrect = q.correct_option === optKey;
                                    return (
                                      <div key={optKey} className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => handleUpdateQuestion(idx, { correct_option: optKey })}
                                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold transition-all border ${
                                            isCorrect
                                              ? 'bg-emerald-500 text-white border-emerald-600 ring-2 ring-emerald-500/30'
                                              : 'bg-muted/50 border-border/70 text-muted-foreground hover:bg-muted'
                                          }`}
                                        >
                                          {isCorrect ? <Check className="h-4 w-4" /> : optKey}
                                        </button>
                                        <Input
                                          value={q.options[optKey]}
                                          onChange={(e) => handleUpdateOption(idx, optKey, e.target.value)}
                                          placeholder={`Đáp án ${optKey}...`}
                                          className={`h-10 rounded-xl flex-1 font-mono text-xs sm:text-sm ${
                                            isCorrect ? 'border-emerald-500/50 bg-emerald-500/5' : ''
                                          }`}
                                          required
                                        />
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : (
                              /* Answer for Flashcard and Fill in the Blank */
                              <div className="space-y-1.5">
                                <Label className="text-xs font-semibold">
                                  {q.type === 'flashcard'
                                    ? 'Mặt sau (Đáp án / Định nghĩa / Công thức giải):'
                                    : 'Đáp án chính xác cần điền:'}{' '}
                                  <span className="text-destructive">*</span>
                                </Label>
                                <Textarea
                                  value={q.answer}
                                  onChange={(e) => handleUpdateQuestion(idx, { answer: e.target.value })}
                                  placeholder={
                                    q.type === 'flashcard'
                                      ? 'Ví dụ: $\\frac{AM}{AB} = \\frac{AN}{AC}$ (Đoạn thẳng tương ứng tỉ lệ)'
                                      : 'Ví dụ: \\frac{MN}{BC}'
                                  }
                                  rows={2}
                                  className="rounded-xl font-mono text-xs sm:text-sm resize-none"
                                  required
                                />
                              </div>
                            )}

                            {/* Explanation */}
                            <div className="space-y-1.5">
                              <Label className="text-xs font-semibold">
                                Lời giải chi tiết / Giải thích (tùy chọn):
                              </Label>
                              <Input
                                value={q.explanation}
                                onChange={(e) => handleUpdateQuestion(idx, { explanation: e.target.value })}
                                placeholder="Giải thích các bước chứng minh hoặc lưu ý..."
                                className="h-10 rounded-xl text-xs sm:text-sm font-mono"
                              />
                            </div>
                          </div>
                        ) : (
                          /* LIVE PREVIEW FOR THIS QUESTION */
                          <div className="rounded-xl border border-border/80 bg-muted/20 p-4 space-y-3">
                            <div className="space-y-1">
                              <span className="text-[11px] font-bold text-muted-foreground uppercase">Câu hỏi:</span>
                              <div className="text-sm font-medium p-3 rounded-xl bg-card border border-border/60">
                                <StudyRichText content={q.question || '(Chưa nhập nội dung)'} />
                              </div>
                            </div>

                            {q.type === 'multiple_choice' ? (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                {(['A', 'B', 'C', 'D'] as const).map((key) => (
                                  <div
                                    key={key}
                                    className={`p-2.5 rounded-lg border flex items-center gap-2 ${
                                      q.correct_option === key
                                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-950 dark:text-emerald-200 font-semibold'
                                        : 'border-border/60 bg-card text-muted-foreground'
                                    }`}
                                  >
                                    <span className="font-bold">{key}.</span>
                                    <StudyRichText content={q.options[key] || `(Đáp án ${key})`} inline />
                                    {q.correct_option === key && <Check className="h-3.5 w-3.5 text-emerald-500 ml-auto" />}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <span className="text-[11px] font-bold text-muted-foreground uppercase">Đáp án:</span>
                                <div className="p-3 rounded-xl bg-card border border-border/60 text-xs font-semibold text-primary">
                                  <StudyRichText content={q.answer || '(Chưa nhập đáp án)'} inline />
                                </div>
                              </div>
                            )}

                            {q.explanation && (
                              <div className="text-xs text-muted-foreground italic border-t border-border/40 pt-1.5">
                                Giải thích: <StudyRichText content={q.explanation} inline />
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* + Thêm câu hỏi button */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddQuestion}
                  className="w-full py-5 rounded-2xl border-dashed border-2 hover:border-primary/60 hover:bg-primary/5 text-xs sm:text-sm font-semibold gap-2 transition-all"
                >
                  <Plus className="h-4 w-4" /> Thêm câu hỏi {questions.length + 1}
                </Button>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t border-border/50">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Hủy
            </Button>
            <Button
              type="submit"
              disabled={saving || !title.trim()}
              className="font-medium gap-2 h-11 px-6 rounded-xl"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Đang lưu...
                </>
              ) : isEditing ? (
                'Lưu thay đổi'
              ) : (
                <>
                  <Plus className="h-4 w-4" /> Tạo bộ học ({questions.length} câu hỏi)
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
