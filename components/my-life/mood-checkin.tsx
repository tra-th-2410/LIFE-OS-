'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Heart, Loader2, Calendar, Sparkles, Tag, Check } from 'lucide-react';
import { moodEmoji, moodLabel, getISODate, getPast7Days } from '@/lib/helpers';
import type { MoodEntry } from '@/lib/types';
import { toast } from 'sonner';

const MOOD_OPTIONS = [
  { value: 1, labelVi: 'Rất tệ', labelEn: 'Very bad', color: 'from-rose-500/20 to-rose-500/5 text-rose-500 border-rose-500/30' },
  { value: 2, labelVi: 'Buồn / Mệt', labelEn: 'Down / Tired', color: 'from-orange-500/20 to-orange-500/5 text-orange-500 border-orange-500/30' },
  { value: 3, labelVi: 'Bình thường', labelEn: 'Neutral', color: 'from-amber-500/20 to-amber-500/5 text-amber-500 border-amber-500/30' },
  { value: 4, labelVi: 'Tốt / Vui', labelEn: 'Good / Happy', color: 'from-blue-500/20 to-blue-500/5 text-blue-500 border-blue-500/30' },
  { value: 5, labelVi: 'Tuyệt vời', labelEn: 'Great', color: 'from-emerald-500/20 to-emerald-500/5 text-emerald-500 border-emerald-500/30' },
];

const SUGGESTED_TAGS = [
  'Học tập',
  'Giấc ngủ',
  'Bạn bè',
  'Gia đình',
  'Sức khỏe',
  'Thể thao',
  'Thi cử',
  'Thư giãn',
  'Áp lực',
  'Hài lòng',
];

interface MoodCheckinProps {
  onMoodSaved: (newEntry: MoodEntry) => void;
  existingTodayEntry?: MoodEntry | null;
}

export function MoodCheckin({ onMoodSaved, existingTodayEntry }: MoodCheckinProps) {
  const { user } = useAuth();
  const [selectedMood, setSelectedMood] = useState<number>(existingTodayEntry?.mood || 4);
  const [note, setNote] = useState<string>(existingTodayEntry?.note || '');
  const [selectedTags, setSelectedTags] = useState<string[]>(existingTodayEntry?.tags || []);
  const [selectedDate, setSelectedDate] = useState<string>(getISODate(new Date()));
  const [saving, setSaving] = useState(false);

  const past7Days = getPast7Days();

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSaveMood = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('mood_entries')
        .insert({
          user_id: user.id,
          mood: selectedMood,
          note: note.trim() || null,
          tags: selectedTags,
          created_at: new Date(selectedDate).toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      onMoodSaved(data as MoodEntry);
      toast.success('Đã lưu nhật ký tâm trạng hôm nay! ✨');
      setNote('');
      setSelectedTags([]);
    } catch {
      toast.error('Không thể lưu tâm trạng. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-border/60 bg-gradient-to-b from-card to-card/70 backdrop-blur-sm shadow-sm overflow-hidden">
      <CardHeader className="pb-3 border-b border-border/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <CardTitle className="text-base sm:text-lg font-display flex items-center gap-2">
            <Heart className="h-5 w-5 text-rose-500 animate-pulse" /> Bạn cảm thấy thế nào hôm nay?
          </CardTitle>

          {/* Date Selector */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {past7Days.map((d) => (
              <button
                key={d.dateStr}
                onClick={() => setSelectedDate(d.dateStr)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all shrink-0 flex items-center gap-1 ${
                  selectedDate === d.dateStr
                    ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                    : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                }`}
              >
                <span>{d.dayName}</span>
                {d.isToday && <span className="text-[10px] opacity-80">(Hôm nay)</span>}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-5">
        {/* 5-Level Mood Selector */}
        <div className="grid grid-cols-5 gap-2 sm:gap-3">
          {MOOD_OPTIONS.map((opt) => {
            const isSelected = selectedMood === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSelectedMood(opt.value)}
                className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all duration-200 ${
                  isSelected
                    ? `bg-gradient-to-b ${opt.color} scale-105 shadow-md shadow-primary/5 font-semibold`
                    : 'border-border/60 hover:border-border bg-card hover:bg-muted/40 opacity-70 hover:opacity-100'
                }`}
              >
                <span className="text-3xl sm:text-4xl transition-transform duration-200">
                  {moodEmoji(opt.value)}
                </span>
                <span className="text-[11px] sm:text-xs mt-2 text-center line-clamp-1 font-medium">
                  {opt.labelVi}
                </span>
              </button>
            );
          })}
        </div>

        {/* Tags Selector */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
            <Tag className="h-3.5 w-3.5" /> Điều gì ảnh hưởng đến cảm xúc của bạn? (Tùy chọn)
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_TAGS.map((tag) => {
              const active = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    active
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted/70 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {active && <Check className="h-3 w-3 inline mr-1" />}
                  {tag}
                </button>
              );
            })}
          </div>
        </div>

        {/* Short Note Textarea */}
        <div className="space-y-1.5">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ghi chú ngắn về ngày hôm nay (VD: Hôm nay hoàn thành xong bài tập lớn, cảm thấy nhẹ nhõm!)..."
            rows={2}
            className="text-sm resize-none bg-background/50 border-border/60"
          />
        </div>

        {/* Action Button */}
        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Sparkles className="h-3.5 w-3.5 text-primary" /> Dữ liệu tâm trạng hoàn toàn riêng tư
          </p>
          <Button onClick={handleSaveMood} disabled={saving} size="sm" className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Heart className="h-4 w-4 fill-current" />}
            Lưu cảm xúc
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
