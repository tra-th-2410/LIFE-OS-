'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Phone, HeartHandshake, ShieldAlert, X } from 'lucide-react';
import { CRISIS_RESOURCES } from '@/lib/mindcare-types';
import { useLanguage } from '@/components/language-provider';

interface SafetyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SafetyModal({ open, onOpenChange }: SafetyModalProps) {
  const { language } = useLanguage();
  const isVi = language === 'vi';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-card border-border/80 p-6 rounded-2xl shadow-xl">
        <DialogHeader className="space-y-2 text-left">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <HeartHandshake className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-foreground">
                {isVi ? 'Hỗ trợ khẩn cấp & Khủng hoảng' : 'Emergency & Crisis Support'}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {isVi
                  ? 'Bạn không bao giờ phải gánh vác mọi chuyện một mình.'
                  : 'You never have to carry everything all by yourself.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="my-2 rounded-xl bg-muted/50 p-3.5 text-xs text-muted-foreground leading-relaxed border border-border/60">
          <p>
            {isVi
              ? 'Nếu bạn hoặc người xung quanh đang gặp nguy hiểm, có ý định tự làm hại hoặc đang trong trạng thái khủng hoảng tâm lý nặng nề, xin hãy kết nối ngay với các đường dây nóng hỗ trợ miễn phí và bảo mật dưới đây:'
              : 'If you or someone around you is in acute danger, having thoughts of self-harm, or experiencing severe distress, please reach out to these free, confidential support resources:'}
          </p>
        </div>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {CRISIS_RESOURCES.map((res, i) => (
            <div
              key={i}
              className={`p-3.5 rounded-xl border transition-colors flex flex-col gap-2 ${
                res.isEmergency
                  ? 'border-red-500/30 bg-red-500/5'
                  : 'border-border/80 bg-card hover:bg-muted/40'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-sm font-medium text-foreground">
                    {isVi ? res.nameVi : res.name}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isVi ? res.descriptionVi : res.description}
                  </p>
                  <span className="inline-block text-[11px] font-medium text-primary/90 mt-1">
                    🕒 {res.hours}
                  </span>
                </div>
                <a
                  href={`tel:${res.phone.replace(/\s+/g, '')}`}
                  className="shrink-0"
                >
                  <Button
                    size="sm"
                    variant={res.isEmergency ? 'destructive' : 'default'}
                    className="h-8 gap-1.5 rounded-lg px-3 text-xs shadow-xs"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    <span>{res.phone}</span>
                  </Button>
                </a>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-2 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="rounded-lg text-xs"
          >
            {isVi ? 'Đóng lại' : 'Close'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
