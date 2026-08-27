'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, CheckCircle2, ArrowRight } from 'lucide-react';
import { StudyRichText } from './study-rich-text';
import { smartAnswerCompare } from '@/lib/study';
import type { StudyQuestion } from '@/lib/types';

interface FillBlankCardProps {
  question: StudyQuestion;
  userAnswer?: string;
  onAnswerChange?: (answer: string) => void;
  onSubmitAnswer?: (answer: string, isCorrect: boolean) => void;
  showFeedback?: boolean;
  disabled?: boolean;
}

export function FillBlankCard({
  question,
  userAnswer = '',
  onAnswerChange,
  onSubmitAnswer,
  showFeedback = false,
  disabled = false,
}: FillBlankCardProps) {
  const [internalInput, setInternalInput] = useState(userAnswer);
  const [isChecked, setIsChecked] = useState(false);

  const currentInput = onAnswerChange ? userAnswer : internalInput;
  const isCorrect = question.answer ? smartAnswerCompare(currentInput, question.answer) : false;

  const handleInputChange = (val: string) => {
    if (disabled || (showFeedback && isChecked)) return;
    if (onAnswerChange) {
      onAnswerChange(val);
    } else {
      setInternalInput(val);
    }
  };

  const handleCheck = () => {
    if (!currentInput.trim()) return;
    setIsChecked(true);
    if (onSubmitAnswer) {
      onSubmitAnswer(currentInput, isCorrect);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !showFeedback && !disabled) {
      e.preventDefault();
      handleCheck();
    }
  };

  const isRevealed = showFeedback || isChecked;

  return (
    <Card className="w-full border-border/80 shadow-sm">
      <CardContent className="p-5 sm:p-7 space-y-6">
        {/* Header */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 text-xs font-medium">
              Điền vào chỗ trống
            </Badge>
            {isRevealed && currentInput && (
              <Badge
                className={`text-xs font-medium gap-1 ${
                  isCorrect
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                    : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                }`}
                variant="outline"
              >
                {isCorrect ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                {isCorrect ? 'Chính xác' : 'Chưa chính xác'}
              </Badge>
            )}
          </div>

          <div className="text-base sm:text-lg font-medium leading-relaxed pt-1">
            <StudyRichText content={question.question} />
          </div>
        </div>

        {/* Input & Check Button */}
        <div className="space-y-3 pt-2">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Input
                value={currentInput}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={disabled || (showFeedback && isChecked)}
                placeholder="Nhập đáp án của bạn vào đây..."
                className={`h-12 text-base px-4 rounded-xl font-medium ${
                  isRevealed && currentInput
                    ? isCorrect
                      ? 'border-emerald-500 bg-emerald-500/5 focus-visible:ring-emerald-500 text-emerald-950 dark:text-emerald-200'
                      : 'border-rose-500 bg-rose-500/5 focus-visible:ring-rose-500 text-rose-950 dark:text-rose-200'
                    : 'border-input'
                }`}
              />
            </div>

            {!isRevealed && onSubmitAnswer && (
              <Button
                type="button"
                onClick={handleCheck}
                disabled={disabled || !currentInput.trim()}
                className="h-12 px-6 rounded-xl shrink-0 font-medium"
              >
                Kiểm tra <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Feedback Section */}
          {isRevealed && (
            <div className="space-y-3 pt-2 animate-in fade-in duration-300">
              <div className="p-3.5 rounded-xl border border-border/70 bg-muted/40 space-y-1.5">
                <div className="text-xs font-semibold text-muted-foreground">Đáp án chính xác:</div>
                <div className="text-sm sm:text-base font-semibold text-emerald-600 dark:text-emerald-400">
                  <StudyRichText content={question.answer} inline />
                </div>
              </div>

              {question.explanation && (
                <div className="rounded-xl bg-muted/60 p-4 border border-border/70 text-sm space-y-1.5">
                  <div className="flex items-center gap-1.5 font-semibold text-foreground text-xs">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                    <span>Giải thích chi tiết:</span>
                  </div>
                  <div className="text-muted-foreground leading-relaxed pl-5">
                    <StudyRichText content={question.explanation} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
