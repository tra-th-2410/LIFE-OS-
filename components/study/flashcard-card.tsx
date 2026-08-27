'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RotateCw, CheckCircle2, HelpCircle, AlertCircle } from 'lucide-react';
import { StudyRichText } from './study-rich-text';
import type { StudyQuestion, ProgressDifficulty } from '@/lib/types';

interface FlashcardCardProps {
  question: StudyQuestion;
  onRate?: (difficulty: ProgressDifficulty) => void;
  showControls?: boolean;
  isFlipped?: boolean;
  onFlipChange?: (flipped: boolean) => void;
}

export function FlashcardCard({
  question,
  onRate,
  showControls = true,
  isFlipped: controlledFlipped,
  onFlipChange,
}: FlashcardCardProps) {
  const [internalFlipped, setInternalFlipped] = useState(false);

  const isFlipped = controlledFlipped !== undefined ? controlledFlipped : internalFlipped;

  const handleFlip = () => {
    const next = !isFlipped;
    if (onFlipChange) {
      onFlipChange(next);
    } else {
      setInternalFlipped(next);
    }
  };

  return (
    <div className="w-full flex flex-col items-center space-y-4">
      {/* 3D Flip Card Container */}
      <div
        onClick={handleFlip}
        className="w-full cursor-pointer perspective-1000 min-h-[300px] sm:min-h-[360px] select-none"
      >
        <div
          className={`relative w-full h-full min-h-[300px] sm:min-h-[360px] rounded-2xl transition-all duration-500 transform-style-3d border border-border/80 shadow-md hover:shadow-lg ${
            isFlipped ? 'rotate-y-180 bg-card/95' : 'bg-card'
          }`}
        >
          {/* FRONT SIDE */}
          <div
            className={`absolute inset-0 w-full h-full p-6 sm:p-8 flex flex-col justify-between backface-hidden ${
              isFlipped ? 'pointer-events-none opacity-0' : 'opacity-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs font-medium">
                Mặt trước • Câu hỏi
              </Badge>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <RotateCw className="h-3 w-3" /> Bấm để lật thẻ
              </span>
            </div>

            <div className="my-auto py-4 text-center sm:text-left">
              <div className="text-lg sm:text-xl font-medium leading-relaxed">
                <StudyRichText content={question.question} />
              </div>
            </div>

            <div className="pt-4 border-t border-border/40 text-center text-xs text-muted-foreground">
              Nhấn vào thẻ để xem đáp án & giải thích
            </div>
          </div>

          {/* BACK SIDE */}
          <div
            className={`absolute inset-0 w-full h-full p-6 sm:p-8 flex flex-col justify-between backface-hidden rotate-y-180 bg-primary/5 ${
              !isFlipped ? 'pointer-events-none opacity-0' : 'opacity-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-xs font-medium">
                Mặt sau • Đáp án
              </Badge>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <RotateCw className="h-3 w-3" /> Bấm để lật lại
              </span>
            </div>

            <div className="my-auto py-4 space-y-4">
              <div className="text-lg sm:text-xl font-semibold text-primary">
                <StudyRichText content={question.answer} />
              </div>

              {question.explanation && (
                <div className="rounded-xl bg-muted/60 p-3.5 border border-border/60 text-sm text-muted-foreground">
                  <p className="text-xs font-semibold text-foreground mb-1">Giải thích chi tiết:</p>
                  <StudyRichText content={question.explanation} />
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-border/40 text-center text-xs text-muted-foreground">
              Hãy tự đánh giá mức độ ghi nhớ của bạn bên dưới
            </div>
          </div>
        </div>
      </div>

      {/* Spaced Review Rating Buttons (Visible when flipped in practice) */}
      {showControls && isFlipped && onRate && (
        <div className="w-full pt-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <p className="text-center text-xs text-muted-foreground mb-2">Đánh giá mức độ ghi nhớ:</p>
          <div className="grid grid-cols-3 gap-2 sm:gap-4 max-w-md mx-auto">
            <Button
              type="button"
              variant="outline"
              onClick={() => onRate('hard')}
              className="flex flex-col items-center gap-1 py-3 h-auto border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-600 text-rose-500"
            >
              <AlertCircle className="h-4 w-4" />
              <span className="font-semibold text-xs sm:text-sm">Khó</span>
              <span className="text-[10px] text-muted-foreground">Ôn lại ngay</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => onRate('medium')}
              className="flex flex-col items-center gap-1 py-3 h-auto border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-600 text-amber-500"
            >
              <HelpCircle className="h-4 w-4" />
              <span className="font-semibold text-xs sm:text-sm">Bình thường</span>
              <span className="text-[10px] text-muted-foreground">Ôn sau 3 ngày</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => onRate('easy')}
              className="flex flex-col items-center gap-1 py-3 h-auto border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-600 text-emerald-500"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span className="font-semibold text-xs sm:text-sm">Dễ</span>
              <span className="text-[10px] text-muted-foreground">Ôn sau 7 ngày</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
