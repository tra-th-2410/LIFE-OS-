'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Activity, TrendingUp, Sparkles, Smile, Frown, Meh } from 'lucide-react';
import { moodEmoji, moodLabel, formatRelativeTime, getPast7Days } from '@/lib/helpers';
import type { MoodEntry } from '@/lib/types';

interface MoodHistoryChartProps {
  entries: MoodEntry[];
}

export function MoodHistoryChart({ entries }: MoodHistoryChartProps) {
  const past7Days = useMemo(() => getPast7Days(), []);

  // Map entries to the last 7 days
  const dayData = useMemo(() => {
    return past7Days.map((d) => {
      // Find entries created on this date
      const matched = entries.filter((e) => {
        const entryDate = new Date(e.created_at).toISOString().split('T')[0];
        return entryDate === d.dateStr;
      });

      // Get latest or average for this date
      const latestEntry = matched.length > 0 ? matched[0] : null;
      return {
        dateStr: d.dateStr,
        dayName: d.dayName,
        dayShort: d.dayShort,
        isToday: d.isToday,
        entry: latestEntry,
        mood: latestEntry ? latestEntry.mood : null,
      };
    });
  }, [entries, past7Days]);

  const recordedEntries = dayData.filter((d) => d.mood !== null);
  const avgMood =
    recordedEntries.length > 0
      ? (recordedEntries.reduce((sum, d) => sum + (d.mood || 0), 0) / recordedEntries.length).toFixed(1)
      : null;

  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur-sm shadow-sm">
      <CardHeader className="pb-3 border-b border-border/40">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base sm:text-lg font-display flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" /> Diễn biến tâm trạng 7 ngày qua
          </CardTitle>
          {avgMood && (
            <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20 gap-1 font-semibold">
              <Sparkles className="h-3 w-3" /> Điểm TB: {avgMood}/5
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-6">
        {/* 7-Day Visual Mood Bar Chart */}
        <div className="space-y-2">
          <div className="flex items-end justify-between gap-2 h-36 pt-4 px-2 bg-muted/20 rounded-2xl border border-border/40">
            {dayData.map((d) => {
              const heightPercent = d.mood ? (d.mood / 5) * 100 : 8;
              let barColor = 'bg-muted-foreground/15';
              if (d.mood === 5) barColor = 'bg-emerald-500 shadow-sm shadow-emerald-500/20';
              else if (d.mood === 4) barColor = 'bg-blue-500 shadow-sm shadow-blue-500/20';
              else if (d.mood === 3) barColor = 'bg-amber-500 shadow-sm shadow-amber-500/20';
              else if (d.mood === 2) barColor = 'bg-orange-500 shadow-sm shadow-orange-500/20';
              else if (d.mood === 1) barColor = 'bg-rose-500 shadow-sm shadow-rose-500/20';

              return (
                <div key={d.dateStr} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                  {/* Tooltip / Value on top */}
                  <span className="text-xs transition-transform group-hover:scale-125">
                    {d.mood ? moodEmoji(d.mood) : <span className="text-[10px] text-muted-foreground/40">—</span>}
                  </span>

                  {/* Vertical bar */}
                  <div
                    className={`w-full max-w-[28px] rounded-t-lg transition-all duration-300 ${barColor}`}
                    style={{ height: `${heightPercent}%` }}
                  />

                  {/* Day Label */}
                  <div className="text-center pt-1 border-t border-border/40 w-full">
                    <p className={`text-[10px] font-medium ${d.isToday ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                      {d.dayName}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 7-Day Detailed Entries List */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Chi tiết các ngày đã ghi lại ({entries.length} lần ghi nhận)
          </p>

          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Chưa có dữ liệu cảm xúc trong 7 ngày qua. Hãy bắt đầu ghi lại cảm xúc ở trên nhé!
            </p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {entries.slice(0, 7).map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start justify-between gap-3 p-3 rounded-xl border border-border/50 bg-card/40 hover:bg-card/70 transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="text-2xl p-1.5 rounded-xl bg-muted/60 shrink-0">
                      {moodEmoji(entry.mood)}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold">{moodLabel(entry.mood)}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatRelativeTime(entry.created_at)}
                        </span>
                      </div>
                      {entry.note && (
                        <p className="text-xs text-foreground/80 mt-1 line-clamp-2 italic">
                          &quot;{entry.note}&quot;
                        </p>
                      )}
                      {entry.tags && entry.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {entry.tags.map((t) => (
                            <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0">
                              {t}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
