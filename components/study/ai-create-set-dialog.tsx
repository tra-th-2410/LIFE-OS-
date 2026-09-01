'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Loader2, Trash2, CheckCircle2, ArrowLeft, Plus, Edit3 } from 'lucide-react';
import { StudyRichText } from './study-rich-text';
import { generateStudyQuestions, type GeneratedQuestionItem } from '@/lib/study-ai';
import { createStudySet, createStudyQuestionsBatch, STUDY_SUBJECTS } from '@/lib/study';
import { supabase } from '@/lib/supabase';
import type { QuestionType, StudySet, StudySubject } from '@/lib/types';
import { useAuth } from '@/components/auth-provider';
import { toast } from 'sonner';

interface AiCreateSetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (newSet: StudySet) => void;
  initialContent?: string;
  initialSubject?: string;
  initialTopic?: string;
}

export function AiCreateSetDialog({
  open,
  onOpenChange,
  onSuccess,
  initialContent = '',
  initialSubject = 'math',
  initialTopic = '',
}: AiCreateSetDialogProps) {
  const { user } = useAuth();

  const [step, setStep] = useState<'prompt' | 'review'>('prompt');
  const [promptContent, setPromptContent] = useState(initialContent);
  const [subject, setSubject] = useState<string>(initialSubject || 'math');
  const [topic, setTopic] = useState(initialTopic);
  const [count, setCount] = useState<number>(10);
  const [questionType, setQuestionType] = useState<QuestionType | 'mixed'>('mixed');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sync initial props when dialog opens or initial props change
  useEffect(() => {
    if (open) {
      if (initialContent) setPromptContent(initialContent);
      if (initialSubject) setSubject(initialSubject);
      if (initialTopic) setTopic(initialTopic);
    }
  }, [open, initialContent, initialSubject, initialTopic]);

  // Review step state
  const [generatedTitle, setGeneratedTitle] = useState('');
  const [generatedSubject, setGeneratedSubject] = useState('');
  const [generatedTopic, setGeneratedTopic] = useState('');
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestionItem[]>([]);

  // Editing state for individual question in review
  const [editingQuestionIdx, setEditingQuestionIdx] = useState<number | null>(null);

  const handleGenerate = async () => {
    console.log('[AI CREATE] submit started');
    if (!promptContent.trim()) {
      toast.error('Vui lòng nhập yêu cầu hoặc dán nội dung bài học để AI tạo câu hỏi');
      return;
    }

    setGenerating(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const result = await generateStudyQuestions({
        content: promptContent.trim(),
        count,
        type: questionType,
        subject,
        topic,
        accessToken: token,
      });

      console.log('[AI CREATE] setting generated questions', result.questions.length);
      setGeneratedTitle(result.title || `Bộ câu hỏi ${subject}`);
      setGeneratedSubject(result.subject || subject);
      setGeneratedTopic(result.topic || topic);
      setGeneratedQuestions(result.questions);

      console.log('[AI CREATE] switching to review');
      setStep('review');
      toast.success(`Đã tạo thành công ${result.questions.length} câu hỏi! Vui lòng xem lại và chỉnh sửa.`);
    } catch (err: unknown) {
      console.error('AI Generation Error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg || 'Không thể tạo câu hỏi từ AI. Vui lòng thử lại với nội dung rõ ràng hơn.');
    } finally {
      console.log('[AI CREATE] loading=false');
      setGenerating(false);
    }
  };

  const handleDeleteQuestion = (index: number) => {
    setGeneratedQuestions((prev) => prev.filter((_, i) => i !== index));
    if (editingQuestionIdx === index) {
      setEditingQuestionIdx(null);
    }
  };

  const handleUpdateQuestion = (index: number, updates: Partial<GeneratedQuestionItem>) => {
    setGeneratedQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, ...updates } : q))
    );
  };

  const handleSaveSet = async () => {
    if (!user) {
      toast.error('Vui lòng đăng nhập để lưu bộ học');
      return;
    }

    if (!generatedTitle.trim()) {
      toast.error('Vui lòng nhập tên bộ học');
      return;
    }

    if (generatedQuestions.length === 0) {
      toast.error('Danh sách câu hỏi đang trống');
      return;
    }

    setSaving(true);
    try {
      // 1. Create the Study Set
      const defaultType = questionType === 'mixed' ? 'multiple_choice' : questionType;
      const newSet = await createStudySet({
        user_id: user.id,
        title: generatedTitle.trim(),
        subject: generatedSubject || subject,
        topic: generatedTopic.trim() || null,
        description: `Tạo tự động bằng AI (${generatedQuestions.length} câu hỏi)`,
        default_type: defaultType,
      });

      // 2. Batch insert questions
      const questionsPayload = generatedQuestions.map((q, idx) => ({
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

      await createStudyQuestionsBatch(questionsPayload);

      const completeSet: StudySet = {
        ...newSet,
        questions_count: questionsPayload.length,
        mastered_count: 0,
      };

      toast.success(`Đã lưu thành công bộ học "${completeSet.title}" với ${questionsPayload.length} câu hỏi!`);
      onSuccess(completeSet);
      handleClose();
    } catch (err: unknown) {
      console.error('Error saving AI study set:', err);
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg || 'Có lỗi xảy ra khi lưu bộ học');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (!generating && !saving) {
      onOpenChange(false);
      setStep('prompt');
      setPromptContent('');
      setTopic('');
      setGeneratedQuestions([]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary font-bold">
            <Sparkles className="h-5 w-5" />
            <DialogTitle>Tạo bộ câu hỏi thông minh bằng AI</DialogTitle>
          </div>
          <DialogDescription>
            {step === 'prompt'
              ? 'Nhập yêu cầu bằng ngôn ngữ tự nhiên hoặc dán tài liệu học tập. AI sẽ tự động phân tích và tạo bộ câu hỏi chất lượng.'
              : `Kiểm duyệt, chỉnh sửa ${generatedQuestions.length} câu hỏi do AI tạo trước khi lưu vào danh sách học tập.`}
          </DialogDescription>
        </DialogHeader>

        {step === 'prompt' ? (
          <div className="space-y-5 py-3">
            {/* Prompt Textarea */}
            <div className="space-y-2">
              <Label htmlFor="ai-prompt-input" className="text-xs font-semibold">
                Yêu cầu tạo bộ học hoặc dán nội dung bài học: <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="ai-prompt-input"
                value={promptContent}
                onChange={(e) => setPromptContent(e.target.value)}
                placeholder="Ví dụ:
• Giải thích và tạo 15 câu trắc nghiệm về Định lý Thales thuận trong tam giác.
• Tạo 20 flashcard từ vựng tiếng Anh chủ đề Environment & Global Warming.
• Tạo 10 câu điền từ công thức Vật lý 11 phần Dao động điều hòa.
Hoặc dán toàn bộ đoạn văn bản lý thuyết từ sách giáo khoa..."
                rows={7}
                className="rounded-xl font-mono text-xs sm:text-sm resize-none"
                disabled={generating}
              />
            </div>

            {/* Subject & Topic Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Môn học:</Label>
                <Select value={subject} onValueChange={setSubject} disabled={generating}>
                  <SelectTrigger className="h-11 rounded-xl">
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

              <div className="space-y-2">
                <Label className="text-xs font-semibold">Chủ đề cụ thể (tùy chọn):</Label>
                <Input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Ví dụ: Định lý Thales, Este, Thì tương lai..."
                  className="h-11 rounded-xl"
                  disabled={generating}
                />
              </div>
            </div>

            {/* Question Count & Type Config */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Số lượng câu hỏi:</Label>
                <div className="grid grid-cols-3 gap-2">
                  {[10, 15, 20].map((c) => (
                    <button
                      key={c}
                      type="button"
                      disabled={generating}
                      onClick={() => setCount(c)}
                      className={`py-2 rounded-xl border text-xs font-semibold transition-all ${
                        count === c
                          ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary'
                          : 'border-border/70 text-muted-foreground hover:bg-muted/50'
                      }`}
                    >
                      {c} câu
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">Dạng câu hỏi mong muốn:</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'mixed', label: 'Hỗn hợp' },
                    { value: 'multiple_choice', label: '🔘 Trắc nghiệm' },
                    { value: 'flashcard', label: '🃏 Flashcard' },
                    { value: 'fill_blank', label: '✏️ Điền từ' },
                  ].map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      disabled={generating}
                      onClick={() => setQuestionType(t.value as QuestionType | 'mixed')}
                      className={`py-2 px-2 rounded-xl border text-xs font-medium transition-all ${
                        questionType === t.value
                          ? 'border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary'
                          : 'border-border/70 text-muted-foreground hover:bg-muted/50'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-3">
              <Button type="button" variant="outline" onClick={handleClose} disabled={generating}>
                Hủy
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={generating || !promptContent.trim()}
                className="font-medium gap-2 h-11 px-6 rounded-xl"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Đang trích xuất & tạo câu hỏi...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" /> Bắt đầu tạo bằng AI
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          /* STEP 2: REVIEW & EDIT BEFORE SAVING AS NEW SET */
          <div className="space-y-5 py-2">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep('prompt')}
                disabled={saving}
                className="text-xs text-muted-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Sửa prompt / Yêu cầu
              </Button>

              <Badge variant="outline" className="text-xs font-medium text-emerald-600 border-emerald-500/30 bg-emerald-500/5">
                {generatedQuestions.length} câu hỏi hợp lệ
              </Badge>
            </div>

            {/* Set Meta Editor */}
            <div className="p-4 rounded-xl border border-border/80 bg-muted/30 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-xs font-semibold">Tên bộ học:</Label>
                  <Input
                    value={generatedTitle}
                    onChange={(e) => setGeneratedTitle(e.target.value)}
                    className="h-10 rounded-xl font-medium"
                    placeholder="Nhập tên bộ câu hỏi..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Chủ đề:</Label>
                  <Input
                    value={generatedTopic}
                    onChange={(e) => setGeneratedTopic(e.target.value)}
                    className="h-10 rounded-xl"
                    placeholder="Chủ đề..."
                  />
                </div>
              </div>
            </div>

            {/* Questions Review List */}
            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
              {generatedQuestions.map((q, idx) => (
                <Card key={idx} className="border-border/80 shadow-xs relative">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-muted-foreground">#{idx + 1}</span>
                        <Badge variant="outline" className="text-[10px] uppercase font-semibold">
                          {q.type === 'multiple_choice'
                            ? '🔘 Trắc nghiệm'
                            : q.type === 'fill_blank'
                            ? '✏️ Điền từ'
                            : '🃏 Flashcard'}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingQuestionIdx(editingQuestionIdx === idx ? null : idx)}
                          disabled={saving}
                          className={`h-7 w-7 ${editingQuestionIdx === idx ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                          title="Chỉnh sửa câu hỏi này"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteQuestion(idx)}
                          disabled={saving}
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          title="Xóa câu hỏi"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {editingQuestionIdx === idx ? (
                      /* EDITING MODE */
                      <div className="space-y-3 pt-2 border-t border-border/40">
                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold">Nội dung câu hỏi / đề bài:</Label>
                          <Textarea
                            value={q.question}
                            onChange={(e) => handleUpdateQuestion(idx, { question: e.target.value })}
                            rows={2}
                            className="text-xs font-mono rounded-xl resize-none"
                          />
                        </div>

                        {q.type === 'multiple_choice' && q.options && (
                          <div className="space-y-2">
                            <Label className="text-[11px] font-semibold">4 lựa chọn:</Label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {(['A', 'B', 'C', 'D'] as const).map((key) => (
                                <div key={key} className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateQuestion(idx, { correct_option: key, answer: q.options?.[key] || '' })}
                                    className={`h-7 w-7 text-xs font-bold rounded-lg border ${
                                      q.correct_option === key
                                        ? 'bg-emerald-500 text-white border-emerald-600'
                                        : 'bg-muted/40 text-muted-foreground'
                                    }`}
                                  >
                                    {key}
                                  </button>
                                  <Input
                                    value={q.options?.[key] || ''}
                                    onChange={(e) => {
                                      const newOpts = { ...q.options, [key]: e.target.value };
                                      handleUpdateQuestion(idx, {
                                        options: newOpts as { A: string; B: string; C: string; D: string },
                                        answer: q.correct_option === key ? e.target.value : q.answer,
                                      });
                                    }}
                                    className="h-8 text-xs font-mono rounded-lg"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {q.type !== 'multiple_choice' && (
                          <div className="space-y-1">
                            <Label className="text-[11px] font-semibold">Đáp án:</Label>
                            <Input
                              value={q.answer}
                              onChange={(e) => handleUpdateQuestion(idx, { answer: e.target.value })}
                              className="h-8 text-xs font-mono rounded-lg"
                            />
                          </div>
                        )}

                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold">Giải thích chi tiết:</Label>
                          <Input
                            value={q.explanation}
                            onChange={(e) => handleUpdateQuestion(idx, { explanation: e.target.value })}
                            className="h-8 text-xs font-mono rounded-lg"
                          />
                        </div>

                        <div className="flex justify-end pt-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => setEditingQuestionIdx(null)}
                            className="h-7 text-xs rounded-lg"
                          >
                            Xong chỉnh sửa
                          </Button>
                        </div>
                      </div>
                    ) : (
                      /* DISPLAY MODE */
                      <>
                        <div className="text-sm font-medium leading-relaxed">
                          <StudyRichText content={q.question} />
                        </div>

                        {q.type === 'multiple_choice' && q.options && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                            {(['A', 'B', 'C', 'D'] as const).map((key) => (
                              <div
                                key={key}
                                className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 ${
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
                          <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/20 text-xs font-semibold text-primary">
                            <span className="text-muted-foreground font-normal">Đáp án: </span>
                            <StudyRichText content={q.answer} inline />
                          </div>
                        )}

                        {q.explanation && (
                          <p className="text-[11px] text-muted-foreground italic border-t border-border/40 pt-1.5">
                            Giải thích: <StudyRichText content={q.explanation} inline />
                          </p>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button variant="outline" onClick={handleClose} disabled={saving}>
                Hủy
              </Button>
              <Button
                onClick={handleSaveSet}
                disabled={saving || generatedQuestions.length === 0 || !generatedTitle.trim()}
                className="font-medium gap-2 h-11 px-6 rounded-xl"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Đang lưu bộ học...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" /> Xác nhận & Lưu bộ học ({generatedQuestions.length} câu)
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
