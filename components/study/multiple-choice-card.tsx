'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, X, HelpCircle, CheckCircle2 } from 'lucide-react';
import { StudyRichText } from './study-rich-text';
import type { StudyQuestion } from '@/lib/types';

interface MultipleChoiceCardProps {
  question: StudyQuestion;
  selectedOption?: 'A' | 'B' | 'C' | 'D' | null;
  onSelectOption: (option: 'A' | 'B' | 'C' | 'D') => void;
  showFeedback?: boolean; // true in practice mode or exam review
  disabled?: boolean;
}

const OPTION_KEYS: ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', 'D'];

export function MultipleChoiceCard({
  question,
  selectedOption,
  onSelectOption,
  showFeedback = false,
  disabled = false,
}: MultipleChoiceCardProps) {
  const options = question.options || { A: '', B: '', C: '', D: '' };
  const correctOption = question.correct_option;
  const isAnswered = selectedOption !== null && selectedOption !== undefined;
  const isCorrect = isAnswered && selectedOption === correctOption;

  return (
    <Card className="w-full border-border/80 shadow-sm">
      <CardContent className="p-5 sm:p-7 space-y-6">
        {/* Question Header & Content */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 text-xs font-medium">
              Trắc nghiệm 4 lựa chọn
            </Badge>
            {showFeedback && isAnswered && (
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

        {/* 4 Options */}
        <div className="grid grid-cols-1 gap-3 pt-2">
          {OPTION_KEYS.map((key) => {
            const optionText = options[key] || '';
            const isSelected = selectedOption === key;
            const isTargetCorrect = showFeedback && correctOption === key;
            const isChosenWrong = showFeedback && isSelected && !isCorrect;

            let optionStyle = 'border-border/70 hover:border-primary/50 hover:bg-muted/50 bg-card text-foreground';

            if (showFeedback) {
              if (isTargetCorrect) {
                optionStyle = 'border-emerald-500 bg-emerald-500/10 text-emerald-950 dark:text-emerald-200 ring-1 ring-emerald-500';
              } else if (isChosenWrong) {
                optionStyle = 'border-rose-500 bg-rose-500/10 text-rose-950 dark:text-rose-200 ring-1 ring-rose-500';
              } else {
                optionStyle = 'border-border/40 opacity-60 bg-muted/20';
              }
            } else if (isSelected) {
              optionStyle = 'border-primary bg-primary/10 text-primary ring-1 ring-primary';
            }

            return (
              <button
                key={key}
                type="button"
                disabled={disabled || (showFeedback && isAnswered)}
                onClick={() => onSelectOption(key)}
                className={`w-full text-left p-4 rounded-xl border transition-all flex items-start gap-3.5 ${optionStyle} ${
                  disabled || (showFeedback && isAnswered) ? 'cursor-default' : 'cursor-pointer'
                }`}
              >
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold transition-colors ${
                    showFeedback && isTargetCorrect
                      ? 'bg-emerald-500 text-white'
                      : showFeedback && isChosenWrong
                      ? 'bg-rose-500 text-white'
                      : isSelected
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {key}
                </div>

                <div className="flex-1 text-sm sm:text-base leading-relaxed pt-0.5">
                  <StudyRichText content={optionText} inline />
                </div>

                {showFeedback && isTargetCorrect && (
                  <Check className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                )}
                {showFeedback && isChosenWrong && (
                  <X className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
                )}
              </button>
            );
          })}
        </div>

        {/* Feedback / Explanation (Practice mode or after exam submission) */}
        {showFeedback && isAnswered && question.explanation && (
          <div className="rounded-xl bg-muted/60 p-4 border border-border/70 text-sm space-y-1.5 animate-in fade-in duration-300">
            <div className="flex items-center gap-1.5 font-semibold text-foreground text-xs">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              <span>Giải thích chi tiết:</span>
            </div>
            <div className="text-muted-foreground leading-relaxed pl-5">
              <StudyRichText content={question.explanation} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
