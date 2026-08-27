'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { HABIT_CATEGORIES } from '@/lib/helpers';
import type { Habit, HabitCategory } from '@/lib/types';
import { toast } from 'sonner';

const POPULAR_EMOJIS = ['🎯', '📚', '🏃', '🏊', '💪', '🧘', '🚶', '⏱️', '💧', '🌙', '✍️', '🗣️', '🔤', '💻', '🧹', '🎨', '🎵', '🥗', '☕', '🧠'];

interface HabitFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  habitToEdit?: Habit | null;
  onSuccess: (habit: Habit, isEdit: boolean) => void;
}

export function HabitFormDialog({
  open,
  onOpenChange,
  habitToEdit,
  onSuccess,
}: HabitFormDialogProps) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🎯');
  const [category, setCategory] = useState<HabitCategory>('study');
  const [frequency, setFrequency] = useState('daily');
  const [targetDays, setTargetDays] = useState(7);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (habitToEdit) {
      setName(habitToEdit.name);
      setIcon(habitToEdit.icon || '🎯');
      setCategory(habitToEdit.category || 'study');
      setFrequency(habitToEdit.frequency || 'daily');
      setTargetDays(habitToEdit.target_days || 7);
    } else {
      setName('');
      setIcon('🎯');
      setCategory('study');
      setFrequency('daily');
      setTargetDays(7);
    }
  }, [habitToEdit, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim()) return;

    setSaving(true);
    try {
      if (habitToEdit) {
        // Update
        const { data, error } = await supabase
          .from('habits')
          .update({
            name: name.trim(),
            icon,
            category,
            frequency,
            target_days: targetDays,
            updated_at: new Date().toISOString(),
          })
          .eq('id', habitToEdit.id)
          .eq('user_id', user.id)
          .select()
          .single();

        if (error) throw error;
        onSuccess(data as Habit, true);
        toast.success('Đã cập nhật thói quen!');
      } else {
        // Create new
        const { data, error } = await supabase
          .from('habits')
          .insert({
            user_id: user.id,
            name: name.trim(),
            icon,
            category,
            frequency,
            target_days: targetDays,
            streak: 0,
            is_archived: false,
          })
          .select()
          .single();

        if (error) throw error;
        onSuccess(data as Habit, false);
        toast.success('Đã tạo thói quen mới!');
      }
      onOpenChange(false);
    } catch {
      toast.error('Không thể lưu thói quen. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">
            {habitToEdit ? 'Chỉnh sửa thói quen' : 'Tạo thói quen tùy chỉnh'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="habit-name">Tên thói quen *</Label>
            <Input
              id="habit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Đọc sách 15 phút, Học 10 từ mới..."
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label>Biểu tượng (Emoji)</Label>
            <div className="flex items-center gap-2">
              <div className="text-2xl p-2 rounded-lg border border-border bg-muted/30 w-12 text-center">
                {icon}
              </div>
              <div className="flex-1 flex flex-wrap gap-1 max-h-24 overflow-y-auto p-1.5 border border-border/60 rounded-lg">
                {POPULAR_EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setIcon(e)}
                    className={`text-lg p-1 rounded hover:bg-muted transition-colors ${
                      icon === e ? 'bg-primary/15 scale-110' : ''
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Danh mục</Label>
              <Select value={category} onValueChange={(val) => setCategory(val as HabitCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(HABIT_CATEGORIES).map(([catKey, catMeta]) => (
                    <SelectItem key={catKey} value={catKey}>
                      {catMeta.icon} {catMeta.labelVi}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Mục tiêu tuần</Label>
              <Select
                value={String(targetDays)}
                onValueChange={(val) => setTargetDays(Number(val))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 ngày / tuần (Hàng ngày)</SelectItem>
                  <SelectItem value="5">5 ngày / tuần (Thứ 2 - 6)</SelectItem>
                  <SelectItem value="4">4 ngày / tuần</SelectItem>
                  <SelectItem value="3">3 ngày / tuần</SelectItem>
                  <SelectItem value="2">2 ngày / tuần</SelectItem>
                  <SelectItem value="1">1 ngày / tuần</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="pt-3 gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Hủy
              </Button>
            </DialogClose>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              {habitToEdit ? 'Lưu thay đổi' : 'Tạo thói quen'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
