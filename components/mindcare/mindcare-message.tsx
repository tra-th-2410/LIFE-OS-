'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Phone, HeartHandshake, AlertCircle } from 'lucide-react';
import { CRISIS_RESOURCES } from '@/lib/mindcare-types';
import { useLanguage } from '@/components/language-provider';

interface MindCareMessageItemProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
  isSafetyTriggered?: boolean;
  onOpenSafetyModal?: () => void;
}

export function MindCareMessageItem({
  role,
  content,
  isSafetyTriggered,
  onOpenSafetyModal,
}: MindCareMessageItemProps) {
  const { language } = useLanguage();
  const isVi = language === 'vi';
  const isUser = role === 'user';

  if (role === 'system') return null;

  return (
    <div
      className={`flex flex-col gap-1.5 w-full max-w-2xl mx-auto ${
        isUser ? 'items-end' : 'items-start'
      }`}
    >
      {/* Sender indicator */}
      {!isUser && (
        <div className="flex items-center gap-2 pl-1 mb-0.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs shadow-2xs select-none">
            🧠
          </div>
          <span className="text-xs font-semibold text-foreground/85">
            MindCare
          </span>
        </div>
      )}

      {/* Message Bubble */}
      <div
        className={`relative px-4 py-3 text-sm leading-relaxed transition-all shadow-2xs ${
          isUser
            ? 'bg-primary text-primary-foreground rounded-2xl rounded-tr-xs max-w-[85%] sm:max-w-[78%]'
            : 'bg-card text-foreground rounded-2xl rounded-tl-xs border border-border/70 max-w-[95%] sm:max-w-[90%] font-normal'
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap break-words">{content}</p>
        ) : (
          <div className="mindcare-markdown space-y-2.5 break-words">
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="my-1.5 leading-relaxed">{children}</p>,
                ul: ({ children }) => <ul className="list-disc pl-5 my-2 space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-5 my-2 space-y-1">{children}</ol>,
                li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                em: ({ children }) => <em className="italic">{children}</em>,
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        )}
      </div>

      {/* Emergency Assistance Quick Card if Safety is Triggered */}
      {isSafetyTriggered && !isUser && (
        <div className="w-full mt-2 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-foreground space-y-2.5">
          <div className="flex items-start gap-2 text-amber-700 dark:text-amber-400">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="text-xs font-semibold">
                {isVi ? 'Bạn không hề đơn độc lúc này' : 'You are not alone right now'}
              </p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {isVi
                  ? 'Nếu bạn đang trải qua những suy nghĩ tự hại hoặc quá đau đớn, xin đừng giữ trong lòng. Luôn có sự trợ giúp bảo mật và miễn phí:'
                  : 'If you are experiencing thoughts of self-harm or overwhelming distress, free confidential help is always here:'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <a href="tel:0963061414" className="w-full">
              <Button
                variant="outline"
                size="sm"
                className="w-full h-8 justify-start gap-2 text-xs bg-card/80 border-amber-500/30 hover:bg-amber-500/15"
              >
                <Phone className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                <span className="truncate">Ngày Mai: 096 306 1414</span>
              </Button>
            </a>

            <a href="tel:111" className="w-full">
              <Button
                variant="outline"
                size="sm"
                className="w-full h-8 justify-start gap-2 text-xs bg-card/80 border-amber-500/30 hover:bg-amber-500/15"
              >
                <Phone className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                <span className="truncate">Tổng đài 111 (24/7)</span>
              </Button>
            </a>
          </div>

          {onOpenSafetyModal && (
            <div className="flex justify-end pt-0.5">
              <button
                onClick={onOpenSafetyModal}
                className="text-[11px] text-primary hover:underline font-medium flex items-center gap-1"
              >
                <HeartHandshake className="h-3 w-3" />
                {isVi ? 'Xem tất cả đường dây nóng' : 'View all hotlines'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
