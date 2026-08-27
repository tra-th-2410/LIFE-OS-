'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, Plus, Check, Loader2, BookOpen } from 'lucide-react';
import { HABIT_CATEGORIES } from '@/lib/helpers';
import type { HabitTemplate, Habit, HabitCategory } from '@/lib/types';
import { toast } from 'sonner';

// Fallback seed templates if database table is empty or loading
const FALLBACK_TEMPLATES: Omit<HabitTemplate, 'id' | 'created_at'>[] = [
  { title: 'Đọc sách 20 phút', description: 'Đọc sách chuyên ngành hoặc phát triển bản thân', icon: '📚', category: 'study', default_frequency: 'daily', sort_order: 1 },
  { title: 'Chạy bộ', description: 'Rèn luyện sức bền và giải tỏa căng thẳng', icon: '🏃', category: 'health', default_frequency: 'daily', sort_order: 2 },
  { title: 'Bơi lội', description: 'Vận động toàn diện nâng cao thể lực', icon: '🏊', category: 'health', default_frequency: 'daily', sort_order: 3 },
  { title: 'Tập thể dục / Gym', description: 'Tập luyện thể chất duy trì vóc dáng và năng lượng', icon: '💪', category: 'health', default_frequency: 'daily', sort_order: 4 },
  { title: 'Thiền 10 phút', description: 'Thư giãn tâm trí, giảm lo âu và tăng tập trung', icon: '🧘', category: 'mindfulness', default_frequency: 'daily', sort_order: 5 },
  { title: 'Đi bộ ngoài trời', description: 'Hít thở không khí trong lành và thư giãn mắt', icon: '🚶', category: 'mindfulness', default_frequency: 'daily', sort_order: 6 },
  { title: 'Tự học tập trung (Pomodoro)', description: 'Học không xao nhãng theo phiên 25 phút', icon: '⏱️', category: 'study', default_frequency: 'daily', sort_order: 7 },
  { title: 'Uống đủ 2L nước', description: 'Duy trì đủ nước cho cơ thể và trí não cả ngày', icon: '💧', category: 'health', default_frequency: 'daily', sort_order: 8 },
  { title: 'Ngủ đúng giờ (trước 23h)', description: 'Đảm bảo giấc ngủ chất lượng để phục hồi năng lượng', icon: '🌙', category: 'health', default_frequency: 'daily', sort_order: 9 },
  { title: 'Viết nhật ký ngày', description: 'Ghi lại cảm xúc, bài học và điều biết ơn', icon: '✍️', category: 'mindfulness', default_frequency: 'daily', sort_order: 10 },
  { title: 'Học tiếng Anh 30 phút', description: 'Luyện nghe, nói hoặc ngữ pháp tiếng Anh', icon: '🗣️', category: 'language', default_frequency: 'daily', sort_order: 11 },
  { title: 'Ôn 15 từ vựng mới', description: 'Học và ôn tập từ vựng qua flashcards', icon: '🔤', category: 'language', default_frequency: 'daily', sort_order: 12 },
  { title: 'Luyện 1 đề IELTS', description: 'Luyện kỹ năng Reading/Listening hoặc viết Task 1/2', icon: '🎯', category: 'language', default_frequency: 'daily', sort_order: 13 },
  { title: 'Luyện lập trình / Coding', description: 'Viết code giải thuật hoặc xây dựng dự án cá nhân', icon: '💻', category: 'skill', default_frequency: 'daily', sort_order: 14 },
  { title: 'Dọn dẹp bàn học', description: 'Giữ không gian học tập gọn gàng, thoáng đãng', icon: '🧹', category: 'routine', default_frequency: 'daily', sort_order: 15 },
];

interface HabitLibraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingHabits: Habit[];
  onHabitAdded: (newHabit: Habit) => void;
}

export function HabitLibraryDialog({
  open,
  onOpenChange,
  existingHabits,
  onHabitAdded,
}: HabitLibraryDialogProps) {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<HabitTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [addingId, setAddingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const loadTemplates = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('habit_templates')
          .select('*')
          .order('sort_order', { ascending: true });

        if (error || !data || data.length === 0) {
          // Use fallback templates
          setTemplates(
            FALLBACK_TEMPLATES.map((t, idx) => ({
              ...t,
              id: `fallback-${idx}`,
              created_at: new Date().toISOString(),
            }))
          );
        } else {
          setTemplates(data as HabitTemplate[]);
        }
      } catch {
        setTemplates(
          FALLBACK_TEMPLATES.map((t, idx) => ({
            ...t,
            id: `fallback-${idx}`,
            created_at: new Date().toISOString(),
          }))
        );
      } finally {
        setLoading(false);
      }
    };
    loadTemplates();
  }, [open]);

  const handleAddTemplate = async (template: HabitTemplate) => {
    if (!user) return;
    setAddingId(template.id);
    try {
      const { data, error } = await supabase
        .from('habits')
        .insert({
          user_id: user.id,
          name: template.title,
          icon: template.icon,
          category: template.category,
          frequency: template.default_frequency,
          streak: 0,
          target_days: 7,
          is_archived: false,
        })
        .select()
        .single();

      if (error) throw error;
      onHabitAdded(data as Habit);
      toast.success(`Đã thêm thói quen "${template.title}"!`);
    } catch {
      toast.error('Không thể thêm thói quen. Vui lòng thử lại.');
    } finally {
      setAddingId(null);
    }
  };

  const isAlreadyAdded = (title: string) => {
    return existingHabits.some((h) => h.name.toLowerCase() === title.toLowerCase() && !h.is_archived);
  };

  const filteredTemplates = templates.filter((t) => {
    const matchesCat = selectedCategory === 'all' || t.category === selectedCategory;
    const matchesSearch =
      !search ||
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-xl font-display flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" /> Thư viện thói quen mẫu
          </DialogTitle>
          <DialogDescription>
            Chọn thói quen mẫu được thiết kế sẵn dành riêng cho học sinh, sinh viên để thêm nhanh vào danh sách của bạn.
          </DialogDescription>
        </DialogHeader>

        {/* Search & Category Filter */}
        <div className="space-y-3 pt-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm kiếm thói quen (đọc sách, chạy bộ, IELTS, tiếng Anh...)"
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap gap-1.5 pb-1">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              Tất cả
            </button>
            {Object.entries(HABIT_CATEGORIES).map(([catKey, catMeta]) => (
              <button
                key={catKey}
                onClick={() => setSelectedCategory(catKey)}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-colors flex items-center gap-1 ${
                  selectedCategory === catKey
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                <span>{catMeta.icon}</span>
                <span>{catMeta.labelVi}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Templates List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 pt-2">
          {loading ? (
            <div className="space-y-2 py-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 rounded-xl animate-shimmer bg-muted/40" />
              ))}
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Không tìm thấy thói quen mẫu phù hợp.
            </div>
          ) : (
            filteredTemplates.map((template) => {
              const added = isAlreadyAdded(template.title);
              const catInfo = HABIT_CATEGORIES[template.category] ?? HABIT_CATEGORIES.study;
              return (
                <div
                  key={template.id}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-border/60 hover:border-border transition-all bg-card/50"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-3">
                    <span className="text-2xl p-2 rounded-xl bg-muted/50 shrink-0">
                      {template.icon}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm text-foreground">{template.title}</p>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${catInfo.color}`}>
                          {catInfo.labelVi}
                        </Badge>
                      </div>
                      {template.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {template.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant={added ? 'secondary' : 'default'}
                    disabled={added || addingId === template.id}
                    onClick={() => handleAddTemplate(template)}
                    className="shrink-0 gap-1 text-xs"
                  >
                    {addingId === template.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : added ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-success" /> Đã có
                      </>
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5" /> Thêm
                      </>
                    )}
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
