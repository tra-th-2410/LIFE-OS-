'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  TrendingUp,
  Plus,
  BookOpen,
  Flame,
  Check,
  MoreVertical,
  Edit2,
  Archive,
  ArchiveRestore,
  Trash2,
  Sparkles,
  Award,
  CheckCircle2,
} from 'lucide-react';
import { HabitLibraryDialog } from './habit-library-dialog';
import { HabitFormDialog } from './habit-form-dialog';
import { HABIT_CATEGORIES, getISODate, getPast7Days, calculateHabitStreak } from '@/lib/helpers';
import type { Habit, HabitLog } from '@/lib/types';
import { toast } from 'sonner';

export function HabitTracker() {
  const { user } = useAuth();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');

  // Modals state
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [habitToEdit, setHabitToEdit] = useState<Habit | null>(null);
  const [habitToDelete, setHabitToDelete] = useState<Habit | null>(null);
  const [deleting, setDeleting] = useState(false);

  const past7Days = useMemo(() => getPast7Days(), []);
  const todayStr = useMemo(() => getISODate(new Date()), []);

  const loadHabitsData = useCallback(async () => {
    if (!user) return;
    try {
      const [hRes, lRes] = await Promise.all([
        supabase
          .from('habits')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('habit_logs')
          .select('*')
          .eq('user_id', user.id)
          .gte('completed_date', past7Days[0].dateStr),
      ]);

      setHabits((hRes.data as Habit[]) ?? []);
      setLogs((lRes.data as HabitLog[]) ?? []);
    } catch {
      // Error fallback
    } finally {
      setLoading(false);
    }
  }, [user, past7Days]);

  useEffect(() => {
    loadHabitsData();
  }, [loadHabitsData]);

  // Log map: habit_id -> Set of completed_dates
  const logsMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    logs.forEach((log) => {
      const set = map.get(log.habit_id) ?? new Set<string>();
      set.add(log.completed_date);
      map.set(log.habit_id, set);
    });
    return map;
  }, [logs]);

  // Handle 1-click toggle completion for a habit on a date
  const handleToggleHabit = async (habitId: string, dateStr: string = todayStr) => {
    if (!user) return;
    const completedSet = logsMap.get(habitId) ?? new Set<string>();
    const isCompleted = completedSet.has(dateStr);

    if (isCompleted) {
      // Optimistic delete log
      setLogs((prev) => prev.filter((l) => !(l.habit_id === habitId && l.completed_date === dateStr)));
      try {
        await supabase
          .from('habit_logs')
          .delete()
          .eq('habit_id', habitId)
          .eq('user_id', user.id)
          .eq('completed_date', dateStr);

        // Update streak
        const updatedDates = Array.from(completedSet).filter((d) => d !== dateStr);
        const newStreak = calculateHabitStreak(updatedDates);
        await supabase.from('habits').update({ streak: newStreak }).eq('id', habitId);
        setHabits((prev) => prev.map((h) => (h.id === habitId ? { ...h, streak: newStreak } : h)));
      } catch {
        toast.error('Không thể cập nhật trạng thái');
        loadHabitsData();
      }
    } else {
      // Optimistic add log
      const tempLog: HabitLog = {
        id: `temp-${Date.now()}`,
        habit_id: habitId,
        user_id: user.id,
        completed_date: dateStr,
        created_at: new Date().toISOString(),
      };
      setLogs((prev) => [...prev, tempLog]);

      try {
        const { data, error } = await supabase
          .from('habit_logs')
          .insert({
            habit_id: habitId,
            user_id: user.id,
            completed_date: dateStr,
          })
          .select()
          .single();

        if (error) throw error;
        if (data) {
          setLogs((prev) => prev.map((l) => (l.id === tempLog.id ? (data as HabitLog) : l)));
        }

        const updatedDates = [...Array.from(completedSet), dateStr];
        const newStreak = calculateHabitStreak(updatedDates);
        await supabase.from('habits').update({ streak: newStreak }).eq('id', habitId);
        setHabits((prev) => prev.map((h) => (h.id === habitId ? { ...h, streak: newStreak } : h)));

        if (dateStr === todayStr) {
          toast.success('Tuyệt vời! Đã hoàn thành thói quen hôm nay 🎉');
        }
      } catch {
        toast.error('Không thể lưu trạng thái hoàn thành');
        loadHabitsData();
      }
    }
  };

  // Toggle archive
  const handleToggleArchive = async (habit: Habit) => {
    if (!user) return;
    const newArchivedState = !habit.is_archived;
    try {
      const { error } = await supabase
        .from('habits')
        .update({ is_archived: newArchivedState })
        .eq('id', habit.id);

      if (error) throw error;
      setHabits((prev) =>
        prev.map((h) => (h.id === habit.id ? { ...h, is_archived: newArchivedState } : h))
      );
      toast.success(newArchivedState ? 'Đã lưu trữ thói quen' : 'Đã khôi phục thói quen');
    } catch {
      toast.error('Không thể cập nhật trạng thái lưu trữ');
    }
  };

  // Delete habit
  const handleDeleteHabit = async () => {
    if (!user || !habitToDelete) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('habits').delete().eq('id', habitToDelete.id);
      if (error) throw error;
      setHabits((prev) => prev.filter((h) => h.id !== habitToDelete.id));
      setLogs((prev) => prev.filter((l) => l.habit_id !== habitToDelete.id));
      toast.success('Đã xóa thói quen');
      setHabitToDelete(null);
    } catch {
      toast.error('Không thể xóa thói quen');
    } finally {
      setDeleting(false);
    }
  };

  const activeHabits = habits.filter((h) => !h.is_archived);
  const archivedHabits = habits.filter((h) => h.is_archived);
  const currentList = activeTab === 'active' ? activeHabits : archivedHabits;

  // Stats calculation
  const totalActive = activeHabits.length;
  const completedToday = activeHabits.filter((h) => logsMap.get(h.id)?.has(todayStr)).length;
  const maxStreak = activeHabits.reduce((max, h) => Math.max(max, h.streak || 0), 0);
  const completionPercentage = totalActive > 0 ? Math.round((completedToday / totalActive) * 100) : 0;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-2xl animate-shimmer bg-muted/40" />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-2xl animate-shimmer bg-muted/40" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Quick Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-bold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" /> Theo dõi thói quen hàng ngày
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Xây dựng nề nếp tích cực mỗi ngày. Dữ liệu hoàn toàn riêng tư chỉ bạn có thể thấy.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLibraryOpen(true)}
            className="gap-1.5 shadow-sm"
          >
            <BookOpen className="h-4 w-4 text-primary" /> Thư viện mẫu
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setHabitToEdit(null);
              setFormOpen(true);
            }}
            className="gap-1.5 shadow-sm"
          >
            <Plus className="h-4 w-4" /> Thói quen riêng
          </Button>
        </div>
      </div>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Hôm nay</p>
              <p className="text-lg font-bold">
                {completedToday}/{totalActive}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500">
              <Flame className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Chuỗi cao nhất</p>
              <p className="text-lg font-bold">{maxStreak} ngày</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500">
              <Award className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tỷ lệ hoàn thành</p>
              <p className="text-lg font-bold">{completionPercentage}%</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-500">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Đang theo dõi</p>
              <p className="text-lg font-bold">{totalActive} thói quen</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Filter (Active vs Archived) */}
      <div className="flex items-center justify-between border-b border-border/60 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('active')}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'active'
                ? 'bg-primary/10 text-primary font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Đang thực hiện ({activeHabits.length})
          </button>
          {archivedHabits.length > 0 && (
            <button
              onClick={() => setActiveTab('archived')}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'archived'
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Đã lưu trữ ({archivedHabits.length})
            </button>
          )}
        </div>
      </div>

      {/* Habits List */}
      {currentList.length === 0 ? (
        <Card className="border-dashed border-border/80">
          <CardContent className="flex flex-col items-center justify-center py-14 text-center space-y-3">
            <div className="p-3 rounded-2xl bg-primary/10 text-primary">
              <TrendingUp className="h-8 w-8" />
            </div>
            <div>
              <p className="font-semibold text-base">
                {activeTab === 'active' ? 'Chưa có thói quen nào' : 'Chưa có thói quen lưu trữ'}
              </p>
              <p className="text-sm text-muted-foreground max-w-sm mt-1">
                {activeTab === 'active'
                  ? 'Bắt đầu ngày mới bằng việc thêm các thói quen từ thư viện mẫu hoặc tự tạo thói quen riêng của bạn.'
                  : 'Các thói quen bạn lưu trữ sẽ hiển thị ở đây.'}
              </p>
            </div>
            {activeTab === 'active' && (
              <div className="flex gap-2 pt-2">
                <Button size="sm" onClick={() => setLibraryOpen(true)} className="gap-1.5">
                  <BookOpen className="h-4 w-4" /> Khám phá thư viện mẫu
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setHabitToEdit(null);
                    setFormOpen(true);
                  }}
                  className="gap-1.5"
                >
                  <Plus className="h-4 w-4" /> Tự tạo thói quen
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {currentList.map((habit) => {
            const completedSet = logsMap.get(habit.id) ?? new Set<string>();
            const isCompletedToday = completedSet.has(todayStr);
            const catInfo = HABIT_CATEGORIES[habit.category || 'study'] ?? HABIT_CATEGORIES.study;

            return (
              <Card
                key={habit.id}
                className="border-border/60 hover:border-border transition-all bg-card/70 backdrop-blur-sm"
              >
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {/* Left: Checkbox + Habit Meta */}
                    <div className="flex items-center gap-3.5 min-w-0">
                      <button
                        onClick={() => handleToggleHabit(habit.id, todayStr)}
                        className={`h-9 w-9 rounded-xl flex items-center justify-center transition-all shrink-0 ${
                          isCompletedToday
                            ? 'bg-success text-success-foreground shadow-sm shadow-success/30 scale-105'
                            : 'border-2 border-border hover:border-primary/50 text-transparent hover:text-muted-foreground/40 bg-background'
                        }`}
                        title={isCompletedToday ? 'Đã hoàn thành hôm nay' : 'Đánh dấu hoàn thành hôm nay'}
                      >
                        <Check className="h-5 w-5 stroke-[2.5]" />
                      </button>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-lg">{habit.icon || '🎯'}</span>
                          <p
                            className={`font-semibold text-sm sm:text-base ${
                              isCompletedToday ? 'line-through text-muted-foreground' : 'text-foreground'
                            }`}
                          >
                            {habit.name}
                          </p>
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${catInfo.color}`}>
                            {catInfo.labelVi}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <Badge
                            variant="secondary"
                            className="text-[11px] gap-1 px-1.5 py-0 font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          >
                            <Flame className="h-3 w-3" /> {habit.streak || 0} ngày liên tiếp
                          </Badge>
                          <span>•</span>
                          <span>{habit.target_days || 7} ngày/tuần</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Past 7 Days Visual Grid + Dropdown */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
                      <div className="flex items-center gap-1.5">
                        {past7Days.map((day) => {
                          const done = completedSet.has(day.dateStr);
                          return (
                            <button
                              key={day.dateStr}
                              onClick={() => handleToggleHabit(habit.id, day.dateStr)}
                              className={`flex flex-col items-center justify-center h-10 w-8 rounded-lg text-[10px] transition-all ${
                                done
                                  ? 'bg-success/15 text-success border border-success/30 font-semibold'
                                  : day.isToday
                                  ? 'bg-muted/70 text-muted-foreground border border-primary/40'
                                  : 'bg-muted/30 text-muted-foreground/60 hover:bg-muted/60'
                              }`}
                              title={`${day.dayName} (${day.dateStr}): ${done ? 'Đã hoàn thành' : 'Chưa hoàn thành'}`}
                            >
                              <span className="text-[9px] uppercase">{day.dayShort}</span>
                              <div
                                className={`h-2 w-2 rounded-full mt-0.5 ${
                                  done ? 'bg-success' : 'bg-muted-foreground/20'
                                }`}
                              />
                            </button>
                          );
                        })}
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setHabitToEdit(habit);
                              setFormOpen(true);
                            }}
                            className="gap-2 cursor-pointer"
                          >
                            <Edit2 className="h-4 w-4" /> Chỉnh sửa
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleToggleArchive(habit)}
                            className="gap-2 cursor-pointer"
                          >
                            {habit.is_archived ? (
                              <>
                                <ArchiveRestore className="h-4 w-4" /> Khôi phục
                              </>
                            ) : (
                              <>
                                <Archive className="h-4 w-4" /> Lưu trữ
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setHabitToDelete(habit)}
                            className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" /> Xóa thói quen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Library Dialog */}
      <HabitLibraryDialog
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        existingHabits={habits}
        onHabitAdded={(newH) => setHabits((prev) => [newH, ...prev])}
      />

      {/* Form Dialog */}
      <HabitFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        habitToEdit={habitToEdit}
        onSuccess={(h, isEdit) => {
          if (isEdit) {
            setHabits((prev) => prev.map((item) => (item.id === h.id ? h : item)));
          } else {
            setHabits((prev) => [h, ...prev]);
          }
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!habitToDelete} onOpenChange={(open) => !open && setHabitToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa thói quen?</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa thói quen &quot;{habitToDelete?.name}&quot;? Toàn bộ lịch sử check-in của thói quen này cũng sẽ bị xóa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteHabit}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Đang xóa...' : 'Xóa vĩnh viễn'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
