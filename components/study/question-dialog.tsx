'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { StudyRichText } from './study-rich-text';
import { Eye, Edit3, Sparkles, Check, AlertCircle } from 'lucide-react';
import type { QuestionType, StudyQuestion } from '@/lib/types';
import { toast } from 'sonner';

interface QuestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  question?: StudyQuestion | null;
  setId: string;
  defaultType?: QuestionType;
  onSave: (data: Omit<StudyQuestion, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
}

export function QuestionDialog({
  open,
  onOpenChange,
  question,
  setId,
  defaultType = 'flashcard',
  onSave,
}: QuestionDialogProps) {
  const [type, setType] = useState<QuestionType>(defaultType);
  const [questionText, setQuestionText] = useState('');
  const [answerText, setAnswerText] = useState('');
  const [explanation, setExplanation] = useState('');
  const [options, setOptions] = useState({ A: '', B: '', C: '', D: '' });
  const [correctOption, setCorrectOption] = useState<'A' | 'B' | 'C' | 'D'>('A');
  const [previewTab, setPreviewTab] = useState<'edit' | 'preview'>('edit');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (question) {
      setType(question.type || 'flashcard');
      setQuestionText(question.question || '');
      setAnswerText(question.answer || '');
      setExplanation(question.explanation || '');
      setOptions(question.options || { A: '', B: '', C: '', D: '' });
      setCorrectOption(question.correct_option || 'A');
    } else {
      setType(defaultType || 'flashcard');
      setQuestionText('');
      setAnswerText('');
      setExplanation('');
      setOptions({ A: '', B: '', C: '', D: '' });
      setCorrectOption('A');
    }
    setPreviewTab('edit');
  }, [question, defaultType, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!questionText.trim()) {
      toast.error('Vui lòng nhập nội dung câu hỏi');
      return;
    }

    if (type === 'multiple_choice') {
      if (!options.A.trim() || !options.B.trim() || !options.C.trim() || !options.D.trim()) {
        toast.error('Vui lòng nhập đầy đủ 4 lựa chọn A, B, C, D');
        return;
      }
    } else {
      if (!answerText.trim()) {
        toast.error('Vui lòng nhập đáp án');
        return;
      }
    }

    setSaving(true);
    try {
      await onSave({
        set_id: setId,
        type,
        question: questionText.trim(),
        answer: type === 'multiple_choice' ? options[correctOption].trim() : answerText.trim(),
        explanation: explanation.trim() || null,
        options: type === 'multiple_choice' ? options : null,
        correct_option: type === 'multiple_choice' ? correctOption : null,
        sort_order: question?.sort_order ?? 0,
        metadata: question?.metadata ?? {},
      });
      onOpenChange(false);
    } catch (err: unknown) {
      console.error('Error saving question in dialog:', err);
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg || 'Có lỗi xảy ra khi lưu câu hỏi');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{question ? 'Chỉnh sửa câu hỏi' : 'Thêm câu hỏi mới'}</DialogTitle>
            <DialogDescription>
              Soạn thảo câu hỏi với đầy đủ hỗ trợ công thức Toán/Lý/Hóa LaTeX ($...$, $$...$$) và Markdown.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-3">
            {/* 3 Question Type Cards */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Dạng câu hỏi:</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* Flashcard */}
                <button
                  type="button"
                  onClick={() => setType('flashcard')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    type === 'flashcard'
                      ? 'border-primary bg-primary/10 text-foreground ring-2 ring-primary/40'
                      : 'border-border/70 hover:bg-muted/40 text-muted-foreground'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground">
                    <span>🃏</span> Flashcard 2 mặt
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Mặt trước câu hỏi, mặt sau đáp án</p>
                </button>

                {/* Multiple Choice */}
                <button
                  type="button"
                  onClick={() => setType('multiple_choice')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    type === 'multiple_choice'
                      ? 'border-primary bg-primary/10 text-foreground ring-2 ring-primary/40'
                      : 'border-border/70 hover:bg-muted/40 text-muted-foreground'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground">
                    <span>🔘</span> Trắc nghiệm 4 lựa chọn
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">4 đáp án A, B, C, D & chọn 1 đáp án đúng</p>
                </button>

                {/* Fill in Blank */}
                <button
                  type="button"
                  onClick={() => setType('fill_blank')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    type === 'fill_blank'
                      ? 'border-primary bg-primary/10 text-foreground ring-2 ring-primary/40'
                      : 'border-border/70 hover:bg-muted/40 text-muted-foreground'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground">
                    <span>✏️</span> Điền vào chỗ trống
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Câu hỏi có chỗ trống ___ & đáp án</p>
                </button>
              </div>
            </div>

            {/* Edit vs Live Preview Switcher */}
            <div className="flex items-center justify-between pt-1 border-t border-border/40">
              <span className="text-xs text-muted-foreground">
                Gõ <code className="bg-muted px-1 py-0.5 rounded text-[11px] font-mono">$công thức$</code> để viết LaTeX
              </span>
              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-muted/60 border border-border/60">
                <button
                  type="button"
                  onClick={() => setPreviewTab('edit')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    previewTab === 'edit' ? 'bg-background shadow-xs text-foreground font-semibold' : 'text-muted-foreground'
                  }`}
                >
                  <Edit3 className="h-3 w-3" /> Soạn thảo
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab('preview')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    previewTab === 'preview' ? 'bg-background shadow-xs text-foreground font-semibold' : 'text-muted-foreground'
                  }`}
                >
                  <Eye className="h-3 w-3" /> Xem trước LaTeX
                </button>
              </div>
            </div>

            {previewTab === 'edit' ? (
              <div className="space-y-4">
                {/* Question Input */}
                <div className="space-y-2">
                  <Label htmlFor="q-text" className="text-xs font-semibold">
                    {type === 'flashcard'
                      ? 'Nội dung mặt trước (Câu hỏi / Thuật ngữ / Công thức):'
                      : type === 'fill_blank'
                      ? 'Câu hỏi / Đề bài (dùng "___" làm vị trí khuyết từ):'
                      : 'Câu hỏi trắc nghiệm:'}{' '}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="q-text"
                    value={questionText}
                    onChange={(e) => setQuestionText(e.target.value)}
                    placeholder={
                      type === 'flashcard'
                        ? 'Ví dụ: Định luật II Newton có biểu thức là gì?'
                        : type === 'fill_blank'
                        ? 'Ví dụ: Công thức tính diện tích hình tròn là $S = ___$'
                        : 'Ví dụ: Nghiệm của phương trình $x^2 - 4 = 0$ là:'
                    }
                    rows={3}
                    className="rounded-xl font-mono text-xs sm:text-sm resize-none"
                    required
                  />
                </div>

                {/* Multiple Choice: 4 Options A, B, C, D with single correct answer selection */}
                {type === 'multiple_choice' ? (
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold">4 lựa chọn & Đáp án đúng:</Label>
                      <span className="text-[11px] text-muted-foreground">
                        Bấm vào nút <span className="font-semibold text-emerald-600">A, B, C, D</span> để chọn đáp án đúng
                      </span>
                    </div>

                    {(['A', 'B', 'C', 'D'] as const).map((optKey) => {
                      const isCorrect = correctOption === optKey;
                      return (
                        <div key={optKey} className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setCorrectOption(optKey)}
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold transition-all border ${
                              isCorrect
                                ? 'bg-emerald-500 text-white border-emerald-600 ring-2 ring-emerald-500/30'
                                : 'bg-muted/50 border-border/70 text-muted-foreground hover:bg-muted'
                            }`}
                          >
                            {isCorrect ? <Check className="h-4 w-4" /> : optKey}
                          </button>
                          <Input
                            value={options[optKey]}
                            onChange={(e) =>
                              setOptions((prev) => ({ ...prev, [optKey]: e.target.value }))
                            }
                            placeholder={`Nội dung đáp án ${optKey}...`}
                            className={`h-11 rounded-xl flex-1 font-mono text-xs sm:text-sm ${
                              isCorrect ? 'border-emerald-500/50 bg-emerald-500/5' : ''
                            }`}
                            required
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Answer Input for Flashcard and Fill in the blank */
                  <div className="space-y-2">
                    <Label htmlFor="a-text" className="text-xs font-semibold">
                      {type === 'flashcard' ? 'Nội dung mặt sau (Đáp án / Định nghĩa):' : 'Đáp án chính xác cần điền:'}{' '}
                      <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                      id="a-text"
                      value={answerText}
                      onChange={(e) => setAnswerText(e.target.value)}
                      placeholder={
                        type === 'flashcard'
                          ? 'Ví dụ: $\\vec{F} = m\\vec{a}$ (Gia tốc của một vật cùng hướng với lực tác dụng...)'
                          : 'Ví dụ: \\pi R^2'
                      }
                      rows={2}
                      className="rounded-xl font-mono text-xs sm:text-sm resize-none"
                      required
                    />
                  </div>
                )}

                {/* Explanation */}
                <div className="space-y-2">
                  <Label htmlFor="q-exp" className="text-xs font-semibold">
                    Giải thích chi tiết / Lời giải / Ví dụ minh họa (tùy chọn):
                  </Label>
                  <Textarea
                    id="q-exp"
                    value={explanation}
                    onChange={(e) => setExplanation(e.target.value)}
                    placeholder="Giải thích các bước làm, mẹo ghi nhớ hoặc lưu ý thêm..."
                    rows={2}
                    className="rounded-xl font-mono text-xs sm:text-sm resize-none"
                  />
                </div>
              </div>
            ) : (
              /* LIVE PREVIEW */
              <div className="rounded-xl border border-border/80 bg-muted/20 p-5 space-y-4">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-muted-foreground uppercase">Xem trước câu hỏi:</span>
                  <div className="text-base font-medium p-3.5 rounded-xl bg-card border border-border/60">
                    <StudyRichText content={questionText || '(Chưa có nội dung câu hỏi)'} />
                  </div>
                </div>

                {type === 'multiple_choice' ? (
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-muted-foreground uppercase">Xem trước lựa chọn:</span>
                    {(['A', 'B', 'C', 'D'] as const).map((key) => (
                      <div
                        key={key}
                        className={`p-3 rounded-xl border flex items-center gap-3 ${
                          correctOption === key
                            ? 'border-emerald-500 bg-emerald-500/10 text-emerald-950 dark:text-emerald-200 ring-1 ring-emerald-500'
                            : 'border-border/60 bg-card text-foreground'
                        }`}
                      >
                        <span className="font-bold text-xs">{key}.</span>
                        <StudyRichText content={options[key] || `(Đáp án ${key})`} inline />
                        {correctOption === key && (
                          <Check className="h-4 w-4 text-emerald-500 ml-auto" />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-muted-foreground uppercase">Xem trước đáp án:</span>
                    <div className="p-3.5 rounded-xl bg-card border border-border/60 text-primary font-semibold">
                      <StudyRichText content={answerText || '(Chưa có đáp án)'} />
                    </div>
                  </div>
                )}

                {explanation && (
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-muted-foreground uppercase">Xem trước giải thích:</span>
                    <div className="p-3.5 rounded-xl bg-card border border-border/60 text-sm text-muted-foreground">
                      <StudyRichText content={explanation} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Hủy
            </Button>
            <Button type="submit" disabled={saving || !questionText.trim()}>
              {saving ? 'Đang lưu...' : question ? 'Lưu thay đổi' : 'Thêm câu hỏi'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
