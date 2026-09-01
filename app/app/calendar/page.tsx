'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Upload,
  Bot,
  CheckCircle2,
  AlertCircle,
  XCircle,
  MoreHorizontal,
  Trash2,
  Edit2,
  Bell,
  Play,
  RotateCw,
  FileText,
  Loader2,
  Check,
  X,
  Flame,
  ArrowRight,
  CalendarDays,
} from 'lucide-react';
import {
  getCalendarEvents,
  createCalendarEvent,
  updateEventStatus,
  updateEventDateTime,
  deleteCalendarEvent,
  generateScheduleFromPrompt,
  generateScheduleFromFileContent,
  getAdjustmentSuggestions,
  type ProposedEventPreview,
  type CreateEventInput,
} from '@/lib/calendar';
import { awardXP } from '@/lib/gamification';
import type { SmartCalendarEvent, CalendarEventStatus, RecurrenceRule } from '@/lib/types';
import { formatRelativeTime, getISODate } from '@/lib/helpers';
import { toast } from 'sonner';

type CalendarViewMode = 'month' | 'week' | 'day' | 'agenda';

const SUBJECT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  blue: { bg: 'bg-blue-500/15', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/30' },
  emerald: { bg: 'bg-emerald-500/15', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/30' },
  purple: { bg: 'bg-purple-500/15', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-500/30' },
  amber: { bg: 'bg-amber-500/15', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/30' },
  rose: { bg: 'bg-rose-500/15', text: 'text-rose-600 dark:text-rose-400', border: 'border-rose-500/30' },
};

export default function SmartCalendarPage() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>('week');
  const [events, setEvents] = useState<SmartCalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Manual Event Creation Dialog State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [eventSubject, setEventSubject] = useState('Toán');
  const [eventTopic, setEventTopic] = useState('');
  const [eventDate, setEventDate] = useState(getISODate(new Date()));
  const [eventStartTime, setEventStartTime] = useState('19:00');
  const [eventEndTime, setEventEndTime] = useState('20:30');
  const [eventColor, setEventColor] = useState('blue');
  const [eventDescription, setEventDescription] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFreq, setRecurrenceFreq] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [hasReminder, setHasReminder] = useState(true);
  const [reminderMinutes, setReminderMinutes] = useState(30);
  const [submittingEvent, setSubmittingEvent] = useState(false);

  // AI Prompt Modal State
  const [showAiPromptModal, setShowAiPromptModal] = useState(false);
  const [aiPromptText, setAiPromptText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [proposedEvents, setProposedEvents] = useState<ProposedEventPreview[]>([]);

  // AI File Import Modal State
  const [showFileImportModal, setShowFileImportModal] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Event Detail / Action Dialog State
  const [selectedEvent, setSelectedEvent] = useState<SmartCalendarEvent | null>(null);
  const [recurringDeleteScope, setRecurringDeleteScope] = useState<'single' | 'following' | 'series'>('single');

  // Drag and Drop state
  const [draggedEventId, setDraggedEventId] = useState<string | null>(null);

  // Load Events
  const loadEvents = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Calculate view window (extend past and future by 60 days to cover month & week boundaries)
      const start = new Date(currentDate.getFullYear(), currentDate.getMonth() - 2, 1);
      const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 3, 0);

      const evs = await getCalendarEvents(user.id, getISODate(start), getISODate(end));
      setEvents(evs);
    } catch (err) {
      console.error('Error loading calendar events:', err);
    } finally {
      setLoading(false);
    }
  }, [user, currentDate]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // AI Suggestions
  const adjustmentSuggestions = useMemo(() => {
    return getAdjustmentSuggestions(events);
  }, [events]);

  // Quick Date Navigations (Timezone-safe & Month-overflow safe)
  const handlePrev = () => {
    if (viewMode === 'month') {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const next = new Date(year, month - 1, 1);
      setCurrentDate(next);
    } else if (viewMode === 'week') {
      const next = new Date(currentDate);
      next.setDate(next.getDate() - 7);
      setCurrentDate(next);
    } else {
      const next = new Date(currentDate);
      next.setDate(next.getDate() - 1);
      setCurrentDate(next);
    }
  };

  const handleNext = () => {
    if (viewMode === 'month') {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const next = new Date(year, month + 1, 1);
      setCurrentDate(next);
    } else if (viewMode === 'week') {
      const next = new Date(currentDate);
      next.setDate(next.getDate() + 7);
      setCurrentDate(next);
    } else {
      const next = new Date(currentDate);
      next.setDate(next.getDate() + 1);
      setCurrentDate(next);
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Create Event Form Submit
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !eventTitle.trim()) return;
    setSubmittingEvent(true);
    try {
      const input: CreateEventInput = {
        title: eventTitle.trim(),
        subject: eventSubject,
        topic: eventTopic.trim() || undefined,
        description: eventDescription.trim(),
        date: eventDate,
        start_time: eventStartTime,
        end_time: eventEndTime,
        duration_minutes: 90,
        color: eventColor,
        is_recurring: isRecurring,
        recurrence_rule: isRecurring ? { freq: recurrenceFreq, interval: 1 } : undefined,
        has_reminder: hasReminder,
        reminder_minutes_before: reminderMinutes,
        source: 'manual',
      };

      const res = await createCalendarEvent(user.id, input);
      if (res.success && res.event) {
        toast.success(isRecurring ? 'Đã tạo chuỗi lịch học định kỳ!' : 'Đã thêm buổi học vào Lịch!');
        setShowCreateModal(false);
        resetForm();
        loadEvents();
      } else {
        toast.error(res.error || 'Không thể tạo sự kiện');
      }
    } catch {
      toast.error('Lỗi khi tạo sự kiện');
    } finally {
      setSubmittingEvent(false);
    }
  };

  const resetForm = () => {
    setEventTitle('');
    setEventSubject('Toán');
    setEventTopic('');
    setEventDate(getISODate(new Date()));
    setEventStartTime('19:00');
    setEventEndTime('20:30');
    setEventDescription('');
    setIsRecurring(false);
  };

  // AI Prompt Scheduler (Natural Language)
  const handleGenerateAiPrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPromptText.trim()) return;
    setAiLoading(true);
    try {
      const preview = await generateScheduleFromPrompt(aiPromptText);
      setProposedEvents(preview);
    } catch {
      toast.error('Không thể phân tích yêu cầu');
    } finally {
      setAiLoading(false);
    }
  };

  // AI File Import
  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFile(true);
    try {
      const preview = await generateScheduleFromFileContent(file.name, '');
      setProposedEvents(preview);
      setShowFileImportModal(false);
      setShowAiPromptModal(true); // Open preview modal
    } catch {
      toast.error('Không thể đọc file thời khóa biểu');
    } finally {
      setUploadingFile(false);
    }
  };

  // Confirm and Save AI Proposed Schedule
  const handleAcceptProposedSchedule = async () => {
    if (!user) return;
    const acceptedList = proposedEvents.filter((p) => p.accepted);
    if (acceptedList.length === 0) {
      toast.error('Vui lòng chọn ít nhất 1 buổi học');
      return;
    }

    setAiLoading(true);
    try {
      for (const item of acceptedList) {
        await createCalendarEvent(user.id, {
          title: item.title,
          subject: item.subject,
          topic: item.topic,
          date: item.date,
          start_time: item.start_time,
          end_time: item.end_time,
          duration_minutes: item.duration_minutes,
          color: item.color,
          has_reminder: true,
          reminder_minutes_before: 30,
          source: 'ai_natural_language',
        });
      }
      toast.success(`Đã thêm ${acceptedList.length} buổi học vào Smart Calendar!`);
      setShowAiPromptModal(false);
      setProposedEvents([]);
      setAiPromptText('');
      loadEvents();
    } catch {
      toast.error('Lỗi khi lưu lịch');
    } finally {
      setAiLoading(false);
    }
  };

  // Mark Event Status
  const handleStatusChange = async (event: SmartCalendarEvent, newStatus: CalendarEventStatus) => {
    if (!user) return;
    const ok = await updateEventStatus(event.id, newStatus);
    if (ok) {
      if (newStatus === 'completed') {
        await awardXP(user.id, 25, 'calendar_task_completed', event.id, `Hoàn thành buổi học: ${event.title}`);
        toast.success('🎉 Đã hoàn thành buổi học! (+25 XP)');
      } else if (newStatus === 'missed') {
        toast.info('Đã đánh dấu bỏ lỡ buổi học. Trợ lý AI sẽ đề xuất bù giờ.');
      }
      setSelectedEvent(null);
      loadEvents();
    }
  };

  // Delete Event
  const handleDeleteEvent = async (event: SmartCalendarEvent) => {
    const ok = await deleteCalendarEvent(event, recurringDeleteScope);
    if (ok) {
      toast.success('Đã xóa buổi học');
      setSelectedEvent(null);
      loadEvents();
    }
  };

  // Drag and Drop Event to new date
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropOnDate = async (targetDateStr: string) => {
    if (!draggedEventId) return;
    const ok = await updateEventDateTime(draggedEventId, targetDateStr);
    if (ok) {
      toast.success(`Đã chuyển lịch học sang ${targetDateStr}!`);
      loadEvents();
    }
    setDraggedEventId(null);
  };

  // Accept AI Adjustment Suggestion
  const handleAcceptAdjustment = async (sug: ReturnType<typeof getAdjustmentSuggestions>[0]) => {
    if (!user) return;
    const ok = await updateEventDateTime(sug.event.id, sug.suggestedDate, sug.suggestedTime);
    if (ok) {
      await updateEventStatus(sug.event.id, 'todo');
      toast.success('Đã dời lịch học thành công theo đề xuất của AI!');
      loadEvents();
    }
  };

  // Week View Days Calculation (Mon -> Sun)
  const weekDays = useMemo(() => {
    const startOfWeek = new Date(currentDate);
    const dayIndex = startOfWeek.getDay(); // 0 is Sun, 1 is Mon...
    const diff = dayIndex === 0 ? -6 : 1 - dayIndex; // Align Monday as 1st day
    startOfWeek.setDate(startOfWeek.getDate() + diff);

    const days: { date: Date; dateStr: string; dayName: string; isToday: boolean }[] = [];
    const todayStr = getISODate(new Date());

    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      const dateStr = getISODate(d);
      days.push({
        date: d,
        dateStr,
        dayName: d.toLocaleDateString('vi-VN', { weekday: 'short' }),
        isToday: dateStr === todayStr,
      });
    }
    return days;
  }, [currentDate]);

  // Month View Days Calculation (7 columns: Mon -> Sun, 35 or 42 grid slots)
  const monthGridDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Monday as 1st day (0 = Sun, 1 = Mon ... 6 = Sat)
    const firstDayOfWeek = firstDay.getDay();
    const offset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

    const totalDaysInMonth = lastDay.getDate();
    const totalSlots = offset + totalDaysInMonth > 35 ? 42 : 35;

    const startDate = new Date(year, month, 1 - offset);
    const todayStr = getISODate(new Date());
    const days: {
      date: Date;
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
    }[] = [];

    for (let i = 0; i < totalSlots; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const dateStr = getISODate(d);

      days.push({
        date: d,
        dateStr,
        dayNumber: d.getDate(),
        isCurrentMonth: d.getMonth() === month,
        isToday: dateStr === todayStr,
      });
    }
    return days;
  }, [currentDate]);

  // Day View calculation
  const dayViewDateStr = useMemo(() => getISODate(currentDate), [currentDate]);
  const dayViewEvents = useMemo(() => {
    return events.filter((e) => e.date === dayViewDateStr);
  }, [events, dayViewDateStr]);

  const totalDayMinutes = useMemo(() => {
    return dayViewEvents.reduce((acc, curr) => acc + (curr.duration_minutes || 0), 0);
  }, [dayViewEvents]);

  // Header Title Text: Explicit "Tháng M năm YYYY" (e.g., "Tháng 9 năm 2026")
  const headerTitleText = useMemo(() => {
    if (viewMode === 'day') {
      const dayNames = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
      const dayName = dayNames[currentDate.getDay()];
      const d = String(currentDate.getDate()).padStart(2, '0');
      const m = currentDate.getMonth() + 1;
      const y = currentDate.getFullYear();
      return `${dayName}, ngày ${d} tháng ${m} năm ${y}`;
    }
    const m = currentDate.getMonth() + 1;
    const y = currentDate.getFullYear();
    return `Tháng ${m} năm ${y}`;
  }, [currentDate, viewMode]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Top Header & View Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-display font-bold">Smart Calendar</h1>
            <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
              <Sparkles className="h-3 w-3 mr-1" /> AI Planner & Lịch lặp
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Quản lý toàn bộ thời khóa biểu, lịch thi, lộ trình ôn tập và tự động xếp lịch thông minh.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={() => setShowAiPromptModal(true)}
            variant="outline"
            className="gap-1.5 rounded-xl border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary font-medium"
          >
            <Bot className="h-4 w-4 text-primary" /> AI Xếp Lịch
          </Button>

          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
            className="gap-1.5 rounded-xl"
            title="Import thời khóa biểu từ PDF, Excel, Ảnh"
          >
            <Upload className="h-4 w-4" /> Import file
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.xlsx,.xls,.docx,.png,.jpg,.jpeg"
            className="hidden"
            onChange={handleFileSelected}
          />

          <Button onClick={() => setShowCreateModal(true)} className="gap-1.5 rounded-xl shadow-xs">
            <Plus className="h-4 w-4" /> Thêm lịch học
          </Button>
        </div>
      </div>

      {/* AI Adjustment Suggestions Banner */}
      {adjustmentSuggestions.length > 0 && (
        <div className="space-y-2">
          {adjustmentSuggestions.map((sug) => (
            <div
              key={sug.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs sm:text-sm animate-in fade-in"
            >
              <div className="flex items-start sm:items-center gap-2.5">
                <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
                <span>{sug.message}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                <Button
                  size="sm"
                  onClick={() => handleAcceptAdjustment(sug)}
                  className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl h-8 text-xs font-semibold gap-1"
                >
                  <Check className="h-3.5 w-3.5" /> Đồng ý dời lịch
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => updateEventStatus(sug.event.id, 'completed')}
                  className="rounded-xl h-8 text-xs text-muted-foreground"
                >
                  Bỏ qua
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Calendar Navigation & Mode Switcher Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card/60 p-3 rounded-2xl border border-border/60 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleToday} className="rounded-xl text-xs font-medium">
            Hôm nay
          </Button>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={handlePrev} className="h-8 w-8 rounded-xl" title="Lùi thời gian">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleNext} className="h-8 w-8 rounded-xl" title="Tiến thời gian">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <span className="font-display font-bold text-base sm:text-lg pl-2">
            {headerTitleText}
          </span>
        </div>

        {/* View Mode Tabs */}
        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/60 self-start sm:self-auto">
          {(['month', 'week', 'day', 'agenda'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-all ${
                viewMode === mode
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {mode === 'month' ? 'Tháng' : mode === 'week' ? 'Tuần' : mode === 'day' ? 'Ngày' : 'Danh sách'}
            </button>
          ))}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 1. CALENDAR VIEW: MONTH VIEW                              */}
      {/* ========================================================= */}
      {viewMode === 'month' && (
        <div className="space-y-2 animate-in fade-in duration-200">
          {/* Day of Week Header */}
          <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-muted-foreground uppercase tracking-wider py-1 px-1">
            <div>Thứ 2</div>
            <div>Thứ 3</div>
            <div>Thứ 4</div>
            <div>Thứ 5</div>
            <div>Thứ 6</div>
            <div>Thứ 7</div>
            <div className="text-primary">Chủ Nhật</div>
          </div>

          {/* Month 7x5 or 7x6 Grid */}
          <div className="grid grid-cols-7 gap-2">
            {monthGridDays.map((day) => {
              const dayEvents = events.filter((e) => e.date === day.dateStr);
              return (
                <div
                  key={day.dateStr}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDropOnDate(day.dateStr)}
                  className={`group relative flex flex-col min-h-[120px] sm:min-h-[135px] p-2 rounded-2xl border transition-all select-none ${
                    day.isToday
                      ? 'bg-primary/5 border-primary/40 ring-1 ring-primary/20'
                      : day.isCurrentMonth
                      ? 'bg-card/70 border-border/60 hover:border-border/90'
                      : 'bg-muted/20 border-border/30 opacity-45 hover:opacity-80'
                  }`}
                >
                  {/* Day Cell Header */}
                  <div className="flex items-center justify-between pb-1.5 border-b border-border/30">
                    <span
                      className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        day.isToday
                          ? 'bg-primary text-primary-foreground shadow-xs'
                          : day.isCurrentMonth
                          ? 'text-foreground'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {day.dayNumber}
                    </span>

                    {/* Quick Add Button */}
                    <button
                      onClick={() => {
                        setEventDate(day.dateStr);
                        setShowCreateModal(true);
                      }}
                      className="opacity-0 group-hover:opacity-100 h-5 w-5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary flex items-center justify-center transition-all"
                      title="Thêm lịch học ngày này"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>

                  {/* Day Events Stack */}
                  <div className="flex-1 space-y-1.5 mt-1.5 overflow-hidden">
                    {dayEvents.slice(0, 3).map((ev) => {
                      const col = SUBJECT_COLORS[ev.color] || SUBJECT_COLORS.blue;
                      const isDone = ev.status === 'completed';
                      const isMissed = ev.status === 'missed';

                      return (
                        <div
                          key={ev.id}
                          draggable
                          onDragStart={() => setDraggedEventId(ev.id)}
                          onClick={() => setSelectedEvent(ev)}
                          className={`px-1.5 py-1 rounded-lg border text-[11px] font-medium cursor-pointer transition-all flex items-center justify-between gap-1 truncate ${col.bg} ${col.border} ${
                            isDone ? 'opacity-50 line-through' : isMissed ? 'border-rose-500/50 bg-rose-500/10' : 'hover:scale-101'
                          }`}
                          title={`${ev.title} (${ev.start_time.slice(0, 5)} - ${ev.end_time.slice(0, 5)})`}
                        >
                          <span className={`truncate ${col.text}`}>{ev.title}</span>
                          <span className="font-mono text-[9px] text-muted-foreground shrink-0">
                            {ev.start_time.slice(0, 5)}
                          </span>
                        </div>
                      );
                    })}

                    {dayEvents.length > 3 && (
                      <button
                        onClick={() => {
                          setCurrentDate(day.date);
                          setViewMode('day');
                        }}
                        className="text-[10px] text-primary font-semibold hover:underline block w-full text-left pl-1"
                      >
                        +{dayEvents.length - 3} buổi khác
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. CALENDAR VIEW: WEEK VIEW                               */}
      {/* ========================================================= */}
      {viewMode === 'week' && (
        <div className="grid grid-cols-1 sm:grid-cols-7 gap-3 animate-in fade-in duration-200">
          {weekDays.map((day) => {
            const dayEvents = events.filter((e) => e.date === day.dateStr);
            return (
              <div
                key={day.dateStr}
                onDragOver={handleDragOver}
                onDrop={() => handleDropOnDate(day.dateStr)}
                className={`flex flex-col min-h-[360px] p-3 rounded-2xl border transition-all ${
                  day.isToday
                    ? 'bg-primary/5 border-primary/40 ring-1 ring-primary/20'
                    : 'bg-card/70 border-border/60 hover:border-border'
                }`}
              >
                {/* Day Header */}
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/40">
                  <span className={`text-xs font-bold uppercase tracking-wider ${day.isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                    {day.dayName}
                  </span>
                  <span
                    className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      day.isToday ? 'bg-primary text-primary-foreground shadow-xs' : 'text-foreground'
                    }`}
                  >
                    {day.date.getDate()}
                  </span>
                </div>

                {/* Day Event List */}
                <div className="flex-1 space-y-2">
                  {dayEvents.map((ev) => {
                    const col = SUBJECT_COLORS[ev.color] || SUBJECT_COLORS.blue;
                    const isDone = ev.status === 'completed';
                    const isMissed = ev.status === 'missed';

                    return (
                      <div
                        key={ev.id}
                        draggable
                        onDragStart={() => setDraggedEventId(ev.id)}
                        onClick={() => setSelectedEvent(ev)}
                        className={`p-2.5 rounded-xl border text-xs cursor-pointer group transition-all duration-200 select-none ${col.bg} ${col.border} ${
                          isDone ? 'opacity-50 line-through' : isMissed ? 'border-rose-500/50 bg-rose-500/10' : 'hover:scale-102 hover:shadow-xs'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-mono text-[10px] font-semibold text-muted-foreground">
                            {ev.start_time.slice(0, 5)} - {ev.end_time.slice(0, 5)}
                          </span>
                          {ev.is_recurring && (
                            <span title="Lịch lặp lại">
                              <RotateCw className="h-3 w-3 text-muted-foreground shrink-0" />
                            </span>
                          )}
                        </div>

                        <p className={`font-semibold mt-1 leading-snug truncate ${col.text}`}>{ev.title}</p>
                        {ev.topic && <p className="text-[10px] text-muted-foreground truncate">{ev.topic}</p>}

                        <div className="flex items-center justify-between pt-1 mt-1 text-[10px] text-muted-foreground">
                          <span className="capitalize">{ev.subject}</span>
                          {isDone ? (
                            <span className="text-emerald-600 font-bold">✓ Xong</span>
                          ) : isMissed ? (
                            <span className="text-rose-600 font-bold">✕ Lỡ</span>
                          ) : (
                            <span>{ev.duration_minutes}p</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Quick Add on this Day */}
                <button
                  onClick={() => {
                    setEventDate(day.dateStr);
                    setShowCreateModal(true);
                  }}
                  className="mt-2 w-full py-1.5 rounded-xl border border-dashed border-border/60 hover:border-primary/50 text-[11px] text-muted-foreground hover:text-primary flex items-center justify-center gap-1 transition-colors"
                >
                  <Plus className="h-3 w-3" /> Thêm
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. CALENDAR VIEW: DAY VIEW                                */}
      {/* ========================================================= */}
      {viewMode === 'day' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Day View Info Banner */}
          <div className="p-4 rounded-2xl bg-card/80 border border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold text-lg shrink-0">
                {currentDate.getDate()}
              </div>
              <div>
                <h3 className="font-bold text-base text-foreground">
                  {headerTitleText}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Tổng số: <strong className="text-foreground">{dayViewEvents.length}</strong> buổi học • Tổng thời gian: <strong className="text-foreground">{totalDayMinutes}</strong> phút
                </p>
              </div>
            </div>

            <Button
              onClick={() => {
                setEventDate(dayViewDateStr);
                setShowCreateModal(true);
              }}
              size="sm"
              className="gap-1.5 rounded-xl self-start sm:self-auto"
            >
              <Plus className="h-4 w-4" /> Thêm buổi học cho ngày này
            </Button>
          </div>

          {/* Day Events Timeline */}
          {dayViewEvents.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <CalendarDays className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium">Chưa có lịch học nào trong ngày này</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Hãy thêm buổi học hoặc dùng trợ lý AI để tự động lên lịch học tối ưu.
                </p>
                <Button
                  onClick={() => {
                    setEventDate(dayViewDateStr);
                    setShowCreateModal(true);
                  }}
                  size="sm"
                  className="mt-4 rounded-xl"
                >
                  <Plus className="h-4 w-4 mr-1" /> Thêm lịch học ngay
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {dayViewEvents.map((ev) => {
                const col = SUBJECT_COLORS[ev.color] || SUBJECT_COLORS.blue;
                const isDone = ev.status === 'completed';
                const isMissed = ev.status === 'missed';

                return (
                  <Card
                    key={ev.id}
                    className={`border-border/60 transition-all bg-card/80 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      isDone ? 'opacity-65' : ''
                    }`}
                  >
                    <div className="flex items-start sm:items-center gap-4 min-w-0">
                      <div className={`h-12 w-12 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 ${col.bg} ${col.text}`}>
                        {ev.subject.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className={`font-bold text-base text-foreground ${isDone ? 'line-through' : ''}`}>
                            {ev.title}
                          </h4>
                          <Badge variant="outline" className="text-[11px]">{ev.subject}</Badge>
                          {ev.topic && <Badge variant="secondary" className="text-[10px]">{ev.topic}</Badge>}
                          {ev.is_recurring && (
                            <Badge variant="outline" className="text-[10px] gap-1">
                              <RotateCw className="h-3 w-3" /> Lặp lại
                            </Badge>
                          )}
                        </div>

                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5 text-primary" />
                          <span>{ev.start_time.slice(0, 5)} - {ev.end_time.slice(0, 5)} ({ev.duration_minutes} phút)</span>
                        </p>

                        {ev.description && (
                          <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 bg-muted/30 p-2 rounded-xl border border-border/40">
                            {ev.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Status & Actions */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <Button
                        size="sm"
                        variant={isDone ? 'default' : 'outline'}
                        onClick={() => handleStatusChange(ev, isDone ? 'todo' : 'completed')}
                        className="rounded-xl h-8 text-xs font-semibold gap-1"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> {isDone ? 'Đã xong' : 'Hoàn thành'}
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedEvent(ev)}
                        className="rounded-xl h-8 text-xs text-muted-foreground"
                      >
                        Chi tiết
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. CALENDAR VIEW: AGENDA LIST VIEW                        */}
      {/* ========================================================= */}
      {viewMode === 'agenda' && (
        <div className="space-y-3 animate-in fade-in duration-200">
          {events.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <CalendarIcon className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium">Chưa có sự kiện nào trong danh sách</p>
                <Button onClick={() => setShowCreateModal(true)} size="sm" className="mt-4 rounded-xl">
                  <Plus className="h-4 w-4 mr-1" /> Thêm lịch học đầu tiên
                </Button>
              </CardContent>
            </Card>
          ) : (
            events.map((ev) => {
              const col = SUBJECT_COLORS[ev.color] || SUBJECT_COLORS.blue;
              return (
                <Card
                  key={ev.id}
                  onClick={() => setSelectedEvent(ev)}
                  className={`border-border/60 cursor-pointer hover:border-primary/40 transition-all bg-card/80 p-4 flex items-center justify-between gap-4`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className={`h-10 w-10 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 ${col.bg} ${col.text}`}>
                      {ev.subject.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-foreground">{ev.title}</span>
                        {ev.is_recurring && <Badge variant="outline" className="text-[10px]">Lặp lại</Badge>}
                        {ev.has_reminder && <Bell className="h-3 w-3 text-muted-foreground" />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {ev.date} • {ev.start_time.slice(0, 5)} - {ev.end_time.slice(0, 5)} ({ev.duration_minutes} phút)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={ev.status === 'completed' ? 'default' : ev.status === 'missed' ? 'destructive' : 'secondary'} className="capitalize text-xs">
                      {ev.status === 'completed' ? 'Hoàn thành' : ev.status === 'missed' ? 'Bỏ lỡ' : 'Chưa học'}
                    </Badge>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* DIALOG 1: CREATE EVENT WITH RECURRING & REMINDER           */}
      {/* ========================================================= */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-[540px]">
          <DialogHeader>
            <DialogTitle>Thêm buổi học mới vào Lịch</DialogTitle>
            <DialogDescription>
              Thiết lập thời gian học, chủ đề ôn thi và tùy chọn thông báo nhắc nhở.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateEvent} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="eventTitle" className="text-xs font-semibold">Tên buổi học / Nhiệm vụ *</Label>
              <Input id="eventTitle" value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} placeholder="VD: Giải đề thi thử Toán, Ôn từ vựng Unit 4..." required />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Môn học</Label>
                <Input value={eventSubject} onChange={(e) => setEventSubject(e.target.value)} placeholder="Toán, Tiếng Anh, Lý..." required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Chủ đề chi tiết</Label>
                <Input value={eventTopic} onChange={(e) => setEventTopic(e.target.value)} placeholder="Hàm số, Thì quá khứ..." />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Ngày học</Label>
                <Input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Giờ bắt đầu</Label>
                <Input type="time" value={eventStartTime} onChange={(e) => setEventStartTime(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Giờ kết thúc</Label>
                <Input type="time" value={eventEndTime} onChange={(e) => setEventEndTime(e.target.value)} required />
              </div>
            </div>

            {/* Recurring Event Options */}
            <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/60 space-y-2.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="recurringCheck" className="text-xs font-semibold cursor-pointer flex items-center gap-1.5">
                  <RotateCw className="h-3.5 w-3.5 text-primary" /> Lặp lại sự kiện (Recurring)
                </Label>
                <input
                  type="checkbox"
                  id="recurringCheck"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="rounded border-input text-primary"
                />
              </div>

              {isRecurring && (
                <div className="grid grid-cols-2 gap-2 pt-1 animate-in fade-in">
                  <select
                    value={recurrenceFreq}
                    onChange={(e: any) => setRecurrenceFreq(e.target.value)}
                    className="w-full h-9 text-xs px-2.5 rounded-xl border border-input bg-background"
                  >
                    <option value="daily">Hàng ngày</option>
                    <option value="weekly">Hàng tuần vào ngày này</option>
                    <option value="monthly">Hàng tháng</option>
                  </select>
                  <p className="text-[11px] text-muted-foreground self-center">
                    Tự động tạo chuỗi các buổi học tương lai.
                  </p>
                </div>
              )}
            </div>

            {/* Reminder Options */}
            <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/60 space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="reminderCheck" className="text-xs font-semibold cursor-pointer flex items-center gap-1.5">
                  <Bell className="h-3.5 w-3.5 text-primary" /> Tạo thông báo nhắc nhở trước giờ học?
                </Label>
                <input
                  type="checkbox"
                  id="reminderCheck"
                  checked={hasReminder}
                  onChange={(e) => setHasReminder(e.target.checked)}
                  className="rounded border-input text-primary"
                />
              </div>

              {hasReminder && (
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs text-muted-foreground">Nhắc trước:</span>
                  {[15, 30, 60].map((mins) => (
                    <Button
                      key={mins}
                      type="button"
                      size="sm"
                      variant={reminderMinutes === mins ? 'default' : 'outline'}
                      onClick={() => setReminderMinutes(mins)}
                      className="h-7 text-xs rounded-lg"
                    >
                      {mins} phút
                    </Button>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>Hủy</Button>
              <Button type="submit" disabled={submittingEvent || !eventTitle.trim()}>
                {submittingEvent ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Lưu vào Lịch'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================= */}
      {/* DIALOG 2: AI NATURAL LANGUAGE & FILE IMPORT PREVIEW       */}
      {/* ========================================================= */}
      <Dialog open={showAiPromptModal} onOpenChange={setShowAiPromptModal}>
        <DialogContent className="sm:max-w-[620px] max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" /> Trợ lý AI Lập Lịch Học
            </DialogTitle>
            <DialogDescription>
              Nhập lịch thi, mục tiêu học tập tự nhiên (VD: &quot;Tôi thi Toán ngày 20/9, Anh ngày 25/9&quot;) hoặc import thời khóa biểu. AI sẽ tính toán lộ trình đề xuất trước để bạn xem và duyệt.
            </DialogDescription>
          </DialogHeader>

          {/* Prompt Input Form */}
          {proposedEvents.length === 0 ? (
            <form onSubmit={handleGenerateAiPrompt} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Mô tả lịch thi hoặc mong muốn của bạn:</Label>
                <Textarea
                  value={aiPromptText}
                  onChange={(e) => setAiPromptText(e.target.value)}
                  placeholder="VD: Tôi cần ôn thi học kỳ môn Toán và Vật lý trong 1 tuần tới, mỗi tối học 90 phút..."
                  rows={4}
                  required
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={aiLoading || !aiPromptText.trim()} className="w-full gap-2 rounded-xl">
                  {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Phân tích & Đề xuất kế hoạch học tập
                </Button>
              </div>
            </form>
          ) : (
            /* Proposed Schedule Preview with User Accept / Reject */
            <div className="space-y-4 overflow-y-auto pr-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Xem trước lộ trình đề xuất ({proposedEvents.filter((p) => p.accepted).length}/{proposedEvents.length} buổi)
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setProposedEvents([])}
                  className="h-7 text-xs text-muted-foreground"
                >
                  Nhập lại yêu cầu
                </Button>
              </div>

              <div className="space-y-2">
                {proposedEvents.map((item, idx) => (
                  <div
                    key={item.id}
                    className={`p-3 rounded-2xl border transition-all text-xs flex items-center justify-between gap-3 ${
                      item.accepted ? 'bg-primary/5 border-primary/30' : 'bg-muted/30 border-border/40 opacity-50'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground truncate">{item.title}</span>
                        <Badge variant="outline" className="text-[10px]">{item.subject}</Badge>
                      </div>
                      <p className="text-muted-foreground mt-0.5">
                        📅 {item.date} • ⏰ {item.start_time} - {item.end_time} ({item.duration_minutes}p)
                      </p>
                      {item.reason && <p className="text-[11px] text-primary/80 italic mt-0.5">{item.reason}</p>}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant={item.accepted ? 'default' : 'outline'}
                        onClick={() => {
                          setProposedEvents((prev) =>
                            prev.map((p, i) => (i === idx ? { ...p, accepted: !p.accepted } : p))
                          );
                        }}
                        className="h-7 text-xs rounded-xl"
                      >
                        {item.accepted ? 'Đã chọn' : 'Bỏ qua'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <DialogFooter className="pt-2 border-t border-border/40">
                <Button variant="outline" onClick={() => setProposedEvents([])}>Hủy</Button>
                <Button onClick={handleAcceptProposedSchedule} disabled={aiLoading} className="gap-2 rounded-xl">
                  {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Xác nhận thêm vào Smart Calendar
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ========================================================= */}
      {/* DIALOG 3: EVENT DETAIL / ACTIONS / FOCUS MODE LINK         */}
      {/* ========================================================= */}
      {selectedEvent && (
        <Dialog open={Boolean(selectedEvent)} onOpenChange={(open) => !open && setSelectedEvent(null)}>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Badge className="capitalize text-xs">{selectedEvent.subject}</Badge>
                {selectedEvent.is_recurring && <Badge variant="outline" className="text-xs">Lặp lại</Badge>}
              </div>
              <DialogTitle className="text-lg font-bold text-foreground mt-1">{selectedEvent.title}</DialogTitle>
              <DialogDescription>
                📅 {selectedEvent.date} • ⏰ {selectedEvent.start_time.slice(0, 5)} - {selectedEvent.end_time.slice(0, 5)} ({selectedEvent.duration_minutes} phút)
              </DialogDescription>
            </DialogHeader>

            {selectedEvent.description && (
              <p className="text-xs text-muted-foreground p-3 rounded-xl bg-muted/30 whitespace-pre-wrap">
                {selectedEvent.description}
              </p>
            )}

            {/* Recurring Delete Scope Options */}
            {selectedEvent.is_recurring && (
              <div className="space-y-1.5 p-3 rounded-xl bg-muted/40 text-xs">
                <Label className="text-xs font-semibold">Phạm vi áp dụng:</Label>
                <div className="flex gap-2">
                  {[
                    { id: 'single', label: 'Chỉ buổi này' },
                    { id: 'following', label: 'Buổi này & sau' },
                    { id: 'series', label: 'Toàn bộ chuỗi' },
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setRecurringDeleteScope(s.id as any)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${
                        recurringDeleteScope === s.id
                          ? 'border-primary bg-primary/10 text-primary font-bold'
                          : 'border-border/60 text-muted-foreground'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Actions Grid */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => handleStatusChange(selectedEvent, 'completed')}
                className="gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 rounded-xl"
              >
                <CheckCircle2 className="h-4 w-4" /> Đánh dấu hoàn thành (+25 XP)
              </Button>

              <Button
                variant="outline"
                onClick={() => handleStatusChange(selectedEvent, 'missed')}
                className="gap-1.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 rounded-xl"
              >
                <XCircle className="h-4 w-4" /> Đánh dấu bỏ lỡ
              </Button>
            </div>

            <DialogFooter className="flex items-center justify-between sm:justify-between pt-3 border-t border-border/40">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteEvent(selectedEvent)}
                className="text-destructive hover:bg-destructive/10 gap-1.5 text-xs rounded-xl"
              >
                <Trash2 className="h-4 w-4" /> Xóa buổi học
              </Button>

              <Button size="sm" onClick={() => setSelectedEvent(null)} className="rounded-xl">
                Đóng
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
