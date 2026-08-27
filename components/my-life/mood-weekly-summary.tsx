'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles,
  RefreshCw,
  TrendingUp,
  HeartHandshake,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  ArrowRight,
} from 'lucide-react';
import { generateWeeklyMoodAnalysis } from '@/lib/ai';
import { getPast7Days, getISODate } from '@/lib/helpers';
import type { MoodEntry, Habit, MoodWeeklySummary } from '@/lib/types';
import { toast } from 'sonner';

interface MoodWeeklySummaryProps {
  moodEntries: MoodEntry[];
  userHabits: Habit[];
}

export function MoodWeeklySummaryCard({ moodEntries, userHabits }: MoodWeeklySummaryProps) {
  const { user } = useAuth();
  const [summary, setSummary] = useState<MoodWeeklySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const past7Days = getPast7Days();
  const weekStartDate = past7Days[0].dateStr;
  const weekEndDate = past7Days[past7Days.length - 1].dateStr;

  const loadSavedSummary = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('mood_weekly_summaries')
        .select('*')
        .eq('user_id', user.id)
        .eq('week_start_date', weekStartDate)
        .maybeSingle();

      if (data) {
        setSummary(data as MoodWeeklySummary);
      }
    } catch {
      // Ignore if table not yet populated
    } finally {
      setLoading(false);
    }
  }, [user, weekStartDate]);

  useEffect(() => {
    loadSavedSummary();
  }, [loadSavedSummary]);

  const handleGenerateSummary = async () => {
    if (!user) return;
    setGenerating(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      // Filter entries within the last 7 days
      const sevenDayEntries = moodEntries.filter((e) => {
        const dateStr = new Date(e.created_at).toISOString().split('T')[0];
        return dateStr >= weekStartDate && dateStr <= weekEndDate;
      });

      const activeHabits = userHabits.filter((h) => !h.is_archived);

      const result = await generateWeeklyMoodAnalysis(
        sevenDayEntries,
        activeHabits,
        'vi',
        accessToken
      );

      const summaryPayload = {
        user_id: user.id,
        week_start_date: weekStartDate,
        week_end_date: weekEndDate,
        avg_mood: result.avgMood,
        positive_days_count: result.positiveDaysCount,
        neutral_days_count: result.neutralDaysCount,
        difficult_days_count: result.difficultDaysCount,
        trend: result.trend,
        summary_text: result.summaryText,
        encouragement: result.encouragement,
        habit_suggestions: result.habitSuggestions,
      };

      // Upsert into mood_weekly_summaries
      const { data, error } = await supabase
        .from('mood_weekly_summaries')
        .upsert(summaryPayload, { onConflict: 'user_id,week_start_date' })
        .select()
        .single();

      if (error) {
        // Local fallback display even if DB upsert has network restriction
        setSummary({
          id: `local-${Date.now()}`,
          ...summaryPayload,
          created_at: new Date().toISOString(),
        } as MoodWeeklySummary);
      } else {
        setSummary(data as MoodWeeklySummary);
      }

      toast.success('Đã tạo nhận xét và gợi ý tâm trạng tuần!');
    } catch {
      toast.error('Không thể tạo nhận xét tuần. Vui lòng thử lại.');
    } finally {
      setGenerating(false);
    }
  };

  const trendBadge = (trend: string) => {
    switch (trend) {
      case 'improving':
        return (
          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 gap-1 text-xs">
            <TrendingUp className="h-3 w-3" /> Chiều hướng tích cực
          </Badge>
        );
      case 'declining':
        return (
          <Badge className="bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20 gap-1 text-xs">
            <AlertCircle className="h-3 w-3" /> Cần thêm nghỉ ngơi
          </Badge>
        );
      default:
        return (
          <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 gap-1 text-xs">
            <CheckCircle2 className="h-3 w-3" /> Ổn định & cân bằng
          </Badge>
        );
    }
  };

  return (
    <Card className="border-border/60 bg-gradient-to-br from-card via-card/90 to-primary/5 shadow-sm overflow-hidden">
      <CardHeader className="pb-3 border-b border-border/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base sm:text-lg font-display">
                Tổng kết & Gợi ý tâm trạng tuần
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Chu kỳ 7 ngày gần nhất ({weekStartDate} → {weekEndDate})
              </p>
            </div>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={handleGenerateSummary}
            disabled={generating}
            className="gap-1.5 shadow-sm text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${generating ? 'animate-spin' : ''}`} />
            {summary ? 'Làm mới phân tích' : 'Tạo nhận xét tuần'}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-5">
        {loading ? (
          <div className="space-y-3 py-4">
            <div className="h-20 rounded-xl animate-shimmer bg-muted/40" />
            <div className="h-16 rounded-xl animate-shimmer bg-muted/40" />
          </div>
        ) : !summary ? (
          <div className="text-center py-8 space-y-3">
            <HeartHandshake className="h-10 w-10 text-primary/40 mx-auto" />
            <div className="max-w-md mx-auto">
              <p className="text-sm font-semibold">Chưa có bản tổng kết cho tuần này</p>
              <p className="text-xs text-muted-foreground mt-1">
                Hệ thống sẽ kết hợp dữ liệu cảm xúc 7 ngày và danh sách thói quen của bạn để đưa ra nhận xét hỗ trợ và gợi ý hữu ích nhất.
              </p>
            </div>
            <Button size="sm" onClick={handleGenerateSummary} disabled={generating} className="gap-1.5">
              <Sparkles className="h-4 w-4" /> Bắt đầu tạo nhận xét tuần
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Stats Overview */}
            <div className="flex items-center gap-2 flex-wrap justify-between p-3 rounded-xl bg-muted/30 border border-border/50">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground">Xu hướng:</span>
                {trendBadge(summary.trend)}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>
                  <strong className="text-emerald-500">{summary.positive_days_count}</strong> ngày tích cực
                </span>
                <span>•</span>
                <span>
                  <strong className="text-amber-500">{summary.neutral_days_count}</strong> ngày bình thường
                </span>
                <span>•</span>
                <span>
                  <strong className="text-rose-500">{summary.difficult_days_count}</strong> ngày khó khăn
                </span>
              </div>
            </div>

            {/* AI Supportive Summary */}
            <div className="space-y-2">
              <div className="p-4 rounded-xl border border-border/60 bg-card/60 space-y-2">
                <p className="text-sm text-foreground leading-relaxed">{summary.summary_text}</p>
                {summary.encouragement && (
                  <p className="text-xs font-medium text-primary flex items-start gap-1.5 pt-1 border-t border-border/40">
                    <Sparkles className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>{summary.encouragement}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Personalized Habit Suggestions */}
            {summary.habit_suggestions && summary.habit_suggestions.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Lightbulb className="h-3.5 w-3.5 text-amber-500" /> Gợi ý dựa trên thói quen của bạn
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {summary.habit_suggestions.map((sug, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-xl border border-border/50 bg-amber-500/5 dark:bg-amber-500/10 flex items-start gap-2.5 text-xs"
                    >
                      <ArrowRight className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <span className="text-foreground/90 font-medium">{sug}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Safety & Non-Diagnostic Notice */}
            <div className="p-3 rounded-xl bg-muted/40 border border-border/40 flex items-start gap-2 text-[11px] text-muted-foreground">
              <ShieldCheck className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
              <p>
                <strong>Lưu ý an toàn:</strong> Phân tích tâm trạng mang tính chất đồng hành và khích lệ, không phải là chẩn đoán y tế. Nếu bạn đang cảm thấy căng thẳng kéo dài, hãy dành thời gian tâm sự cùng bạn bè, gia đình hoặc tìm kiếm sự hỗ trợ từ các chuyên viên tâm lý học đường.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
