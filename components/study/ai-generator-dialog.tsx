'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, Loader2, Trash2, CheckCircle2, AlertCircle, ArrowLeft, Plus } from 'lucide-react';
import { StudyRichText } from './study-rich-text';
import { generateStudyQuestions, type GeneratedQuestionItem } from '@/lib/study-ai';
import { createStudyQuestionsBatch } from '@/lib/study';
import { supabase } from '@/lib/supabase';
import type { QuestionType, StudySet } from '@/lib/types';
import { toast } from 'sonner';

interface AiGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studySet: StudySet;
  onSuccess: () => void;
}

export function AiGeneratorDialog({ open, onOpenChange, studySet, onSuccess }: AiGeneratorDialogProps) {
  const [step, setStep] = useState<'input' | 'review'>('input');
  const [content, setContent] = useState('');
  const [count, setCount] = useState<number>(10);
  const [type, setType] = useState<QuestionType | 'mixed'>('mixed');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatedList, setGeneratedList] = useState<GeneratedQuestionItem[]>([]);

  const handleGenerate = async () => {
    if (!content.trim()) {
      toast.error('Vui lòng dán đoạn văn bản / lý thuyết bài học để AI phân tích');
      return;
    }

    setGenerating(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const result = await generateStudyQuestions({
        content: content.trim(),
        count,
        type,
        subject: String(studySet.subject),
        topic: studySet.topic || studySet.title,
        accessToken: token,
      });

      setGeneratedList(result.questions);
      setStep('review');
      toast.success(`Đã tạo thành công ${result.questions.length} câu hỏi!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg || 'Không thể tạo câu hỏi từ AI. Vui lòng thử lại.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteGenerated = (index: number) => {
    setGeneratedList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveAll = async () => {
    if (generatedList.length === 0) {
      toast.error('Danh sách câu hỏi rỗng');
      return;
    }

    setSaving(true);
    try {
      const batchPayload = generatedList.map((q, idx) => ({
        set_id: studySet.id,
        type: q.type,
        question: q.question,
        answer: q.answer,
        explanation: q.explanation || null,
        options: q.options || null,
        correct_option: q.correct_option || null,
        sort_order: idx,
        metadata: {},
      }));

      await createStudyQuestionsBatch(batchPayload);
      toast.success(`Đã lưu ${batchPayload.length} câu hỏi vào bộ học!`);
      onOpenChange(false);
      setStep('input');
      setContent('');
      setGeneratedList([]);
      onSuccess();
    } catch (err) {
      toast.error('Có lỗi xảy ra khi lưu câu hỏi vào database');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (!generating && !saving) {
      onOpenChange(false);
      setStep('input');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary font-bold">
            <Sparkles className="h-5 w-5" />
            <DialogTitle>Tạo câu hỏi tự động bằng AI</DialogTitle>
          </div>
          <DialogDescription>
            {step === 'input'
              ? 'Dán nội dung lý thuyết hoặc bài giảng để AI tự động trích xuất các câu hỏi chất lượng.'
              : `Kiểm duyệt và chỉnh sửa ${generatedList.length} câu hỏi AI vừa tạo trước khi lưu vào bộ học.`}
          </DialogDescription>
        </DialogHeader>

        {step === 'input' ? (
          <div className="space-y-4 py-2">
            {/* Subject & Topic indicator */}
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="outline" className="bg-primary/5">
                Bộ học: {studySet.title}
              </Badge>
              {studySet.topic && (
                <Badge variant="outline" className="bg-muted">
                  Chủ đề: {studySet.topic}
                </Badge>
              )}
            </div>

            {/* Input Content */}
            <div className="space-y-2">
              <Label htmlFor="ai-content" className="text-xs font-semibold">
                Nội dung tài liệu / Bài học / Lý thuyết: <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="ai-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Dán đoạn văn bản sách giáo khoa, ghi chú bài giảng, định lý, công thức Toán/Lý/Hóa hoặc danh sách từ vựng..."
                rows={7}
                className="rounded-xl font-mono text-xs sm:text-sm resize-none"
                disabled={generating}
              />
            </div>

            {/* Config Options */}
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
                <Label className="text-xs font-semibold">Dạng câu hỏi:</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'mixed', label: 'Hỗn hợp' },
                    { value: 'multiple_choice', label: 'Trắc nghiệm' },
                    { value: 'flashcard', label: 'Flashcard' },
                    { value: 'fill_blank', label: 'Điền từ' },
                  ].map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      disabled={generating}
                      onClick={() => setType(t.value as QuestionType | 'mixed')}
                      className={`py-2 px-2 rounded-xl border text-xs font-medium transition-all ${
                        type === t.value
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
              <Button onClick={handleGenerate} disabled={generating || !content.trim()} className="font-medium gap-2">
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Đang tạo câu hỏi...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" /> Tạo câu hỏi bằng AI
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          /* STEP 2: REVIEW & EDIT BEFORE SAVING */
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep('input')}
                disabled={saving}
                className="text-xs text-muted-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Quay lại tài liệu
              </Button>

              <span className="text-xs text-muted-foreground font-medium">
                {generatedList.length} câu hỏi sẵn sàng
              </span>
            </div>

            {/* Questions List */}
            <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
              {generatedList.map((q, idx) => (
                <Card key={idx} className="border-border/80 shadow-xs relative group">
                  <CardContent className="p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-muted-foreground">#{idx + 1}</span>
                        <Badge variant="outline" className="text-[10px] uppercase font-semibold">
                          {q.type === 'multiple_choice'
                            ? 'Trắc nghiệm'
                            : q.type === 'fill_blank'
                            ? 'Điền từ'
                            : 'Flashcard'}
                        </Badge>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteGenerated(idx)}
                        disabled={saving}
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <div className="text-sm font-medium leading-relaxed">
                      <StudyRichText content={q.question} />
                    </div>

                    {q.type === 'multiple_choice' && q.options && (
                      <div className="grid grid-cols-2 gap-1.5 text-xs pt-1">
                        {(['A', 'B', 'C', 'D'] as const).map((key) => (
                          <div
                            key={key}
                            className={`p-2 rounded-lg border text-xs flex items-center gap-2 ${
                              q.correct_option === key
                                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 font-semibold'
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
                        <span>Đáp án: </span>
                        <StudyRichText content={q.answer} inline />
                      </div>
                    )}

                    {q.explanation && (
                      <p className="text-[11px] text-muted-foreground italic">
                        Giải thích: {q.explanation}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button variant="outline" onClick={handleClose} disabled={saving}>
                Đóng
              </Button>
              <Button onClick={handleSaveAll} disabled={saving || generatedList.length === 0} className="font-medium">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Lưu {generatedList.length} câu vào bộ học
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
