'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Trash2, ShieldCheck, Heart } from 'lucide-react';
import type { MindCareMemory } from '@/lib/mindcare-types';
import { deleteMindCareMemory } from '@/lib/mindcare-db';
import { useLanguage } from '@/components/language-provider';
import { toast } from 'sonner';

interface MemoryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memories: MindCareMemory[];
  userId: string;
  onMemoryDeleted: (memoryId: string) => void;
}

export function MemoryDrawer({
  open,
  onOpenChange,
  memories,
  userId,
  onMemoryDeleted,
}: MemoryDrawerProps) {
  const { language } = useLanguage();
  const isVi = language === 'vi';

  const handleDelete = async (memoryId: string) => {
    try {
      await deleteMindCareMemory(memoryId, userId);
      onMemoryDeleted(memoryId);
      toast.success(isVi ? 'Đã xóa ký ức khỏi MindCare' : 'Memory deleted from MindCare');
    } catch {
      toast.error(isVi ? 'Không thể xóa ký ức' : 'Could not delete memory');
    }
  };

  const getCategoryLabel = (category: MindCareMemory['category']) => {
    switch (category) {
      case 'feeling':
        return isVi ? 'Cảm xúc' : 'Emotion';
      case 'pressure':
        return isVi ? 'Áp lực' : 'Pressure';
      case 'relationship':
        return isVi ? 'Mối quan hệ' : 'Relationship';
      case 'preference':
        return isVi ? 'Sở thích / Giá trị' : 'Preference';
      default:
        return isVi ? 'Chung' : 'General';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border/80 p-6 rounded-2xl shadow-xl">
        <DialogHeader className="space-y-2 text-left">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-foreground">
                {isVi ? 'Những điều MindCare nhớ về bạn' : 'What MindCare Remembers'}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {isVi
                  ? 'Ký ức cá nhân giúp cuộc trò chuyện có chiều sâu hơn.'
                  : 'Personal memory helps our conversations have more depth.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground leading-relaxed border border-border/50 flex items-start gap-2">
          <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <p>
            {isVi
              ? 'MindCare chỉ lưu những điều bạn chủ động chia sẻ để thấu hiểu bạn tốt hơn. Bạn có toàn quyền xem và xóa vĩnh viễn bất kỳ ký ức nào tại đây.'
              : 'MindCare only saves what you actively share to understand you better. You can view or permanently delete any memory anytime.'}
          </p>
        </div>

        <div className="mt-2 space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
          {memories.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-xs">
              <Heart className="h-8 w-8 mx-auto mb-2 opacity-30 text-primary" />
              <p>
                {isVi
                  ? 'Chưa có ký ức nào được lưu.'
                  : 'No personal memories recorded yet.'}
              </p>
              <p className="mt-1 text-[11px] opacity-75">
                {isVi
                  ? 'Khi bạn tâm sự, những điều quan trọng bạn muốn MindCare nhớ sẽ xuất hiện tại đây.'
                  : 'When you share key thoughts, what you want MindCare to remember will appear here.'}
              </p>
            </div>
          ) : (
            memories.map((mem) => (
              <div
                key={mem.id}
                className="group flex items-start justify-between gap-3 p-3 rounded-xl border border-border/70 bg-card hover:bg-muted/30 transition-colors"
              >
                <div className="space-y-1">
                  <Badge
                    variant="secondary"
                    className="text-[10px] font-normal px-2 py-0.5 bg-muted text-muted-foreground"
                  >
                    {getCategoryLabel(mem.category)}
                  </Badge>
                  <p className="text-xs text-foreground font-normal leading-relaxed">
                    {mem.key_point}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleDelete(mem.id)}
                  className="h-7 w-7 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg shrink-0 transition-colors"
                  title={isVi ? 'Xóa ký ức này' : 'Delete this memory'}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))
          )}
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
