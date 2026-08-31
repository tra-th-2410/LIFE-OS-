'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  Volume2,
  VolumeX,
  Sparkles,
  Maximize2,
  Minimize2,
  Flame,
  Clock,
  BookOpen,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';
import { awardXP } from '@/lib/gamification';
import type { FocusPresetType } from '@/lib/types';
import { toast } from 'sonner';

interface FocusModeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTaskTitle?: string;
  defaultSubject?: string;
}

const PRESETS: { type: FocusPresetType; label: string; focusMins: number; breakMins: number; xp: number }[] = [
  { type: '25/5', label: '25 phút (Pomodoro chuẩn)', focusMins: 25, breakMins: 5, xp: 25 },
  { type: '30/5', label: '30 phút (Học bài ngắn)', focusMins: 30, breakMins: 5, xp: 30 },
  { type: '45/10', label: '45 phút (Một tiết học)', focusMins: 45, breakMins: 10, xp: 50 },
  { type: '60/10', label: '60 phút (Giải đề chuyên sâu)', focusMins: 60, breakMins: 10, xp: 75 },
];

const SOUNDS = [
  { id: 'none', label: 'Tắt âm thanh' },
  { id: 'rain', label: '🌧️ Mưa êm dịu' },
  { id: 'lofi', label: '☕ Quán Cafe & Lo-fi' },
  { id: 'forest', label: '🌲 Tiếng Rừng cây' },
  { id: 'whitenoise', label: '📻 Tiếng ồn trắng' },
];

export function FocusModeDialog({
  open,
  onOpenChange,
  defaultTaskTitle = 'Tập trung học tập & Giải đề',
  defaultSubject = 'Toán',
}: FocusModeDialogProps) {
  const { user } = useAuth();
  const [taskTitle, setTaskTitle] = useState(defaultTaskTitle);
  const [selectedPreset, setSelectedPreset] = useState<FocusPresetType>('25/5');
  const [isBreak, setIsBreak] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [selectedSound, setSelectedSound] = useState('none');
  const [sessionsCompletedToday, setSessionsCompletedToday] = useState(0);

  const activePresetConfig = PRESETS.find((p) => p.type === selectedPreset) || PRESETS[0];

  // Sync default title
  useEffect(() => {
    if (defaultTaskTitle) setTaskTitle(defaultTaskTitle);
  }, [defaultTaskTitle]);

  // Timer Tick
  useEffect(() => {
    let interval: any = null;
    if (isActive && secondsLeft > 0) {
      interval = setInterval(() => {
        setSecondsLeft((prev) => prev - 1);
      }, 1000);
    } else if (isActive && secondsLeft === 0) {
      handleCompleteSession();
    }
    return () => clearInterval(interval);
  }, [isActive, secondsLeft]);

  const handleSelectPreset = (preset: FocusPresetType) => {
    if (isActive) return;
    setSelectedPreset(preset);
    const config = PRESETS.find((p) => p.type === preset) || PRESETS[0];
    setSecondsLeft(config.focusMins * 60);
    setIsBreak(false);
  };

  const handleToggleTimer = () => {
    setIsActive(!isActive);
  };

  const handleReset = () => {
    setIsActive(false);
    setSecondsLeft(activePresetConfig.focusMins * 60);
    setIsBreak(false);
  };

  const handleCompleteSession = async () => {
    setIsActive(false);
    if (!user) return;

    const earnedXp = activePresetConfig.xp;
    const durationMinutes = activePresetConfig.focusMins;

    try {
      // 1. Record session
      const sessionId = `focus-${Date.now()}`;
      await supabase.from('focus_sessions').insert({
        user_id: user.id,
        subject: defaultSubject,
        duration_minutes: durationMinutes,
        preset_type: selectedPreset,
        status: 'completed',
        xp_awarded: earnedXp,
      });

      // 2. Award XP & update gamification study time
      await awardXP(
        user.id,
        earnedXp,
        'focus_session_completed',
        sessionId,
        `Hoàn thành phiên tập trung ${durationMinutes}p: ${taskTitle}`
      );

      setSessionsCompletedToday((prev) => prev + 1);
      toast.success(`🎉 Hoàn thành phiên tập trung ${durationMinutes} phút! (+${earnedXp} XP)`);

      // Switch to break
      setIsBreak(true);
      setSecondsLeft(activePresetConfig.breakMins * 60);
    } catch {
      toast.error('Lỗi ghi nhận phiên tập trung');
    }
  };

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const progressPercent = isBreak
    ? ((activePresetConfig.breakMins * 60 - secondsLeft) / (activePresetConfig.breakMins * 60)) * 100
    : ((activePresetConfig.focusMins * 60 - secondsLeft) / (activePresetConfig.focusMins * 60)) * 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] p-0 overflow-hidden border-border/80 bg-background/95 backdrop-blur-xl">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">Focus Mode (Pomodoro Pro)</DialogTitle>
                <p className="text-xs text-muted-foreground">Không gian học tập không xao nhãng & tích lũy thời gian</p>
              </div>
            </div>

            <Badge variant="outline" className="text-xs font-semibold gap-1">
              <Flame className="h-3.5 w-3.5 text-orange-500" /> {sessionsCompletedToday} phiên hôm nay
            </Badge>
          </div>

          {/* Task Title Input */}
          <div className="space-y-1.5">
            <Input
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="Nhập tên việc đang làm..."
              disabled={isActive}
              className="text-center font-semibold text-sm bg-muted/40 h-10 rounded-xl"
            />
          </div>

          {/* Preset Selector */}
          {!isActive && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.type}
                  type="button"
                  onClick={() => handleSelectPreset(p.type)}
                  className={`p-2.5 rounded-xl border text-center transition-all ${
                    selectedPreset === p.type
                      ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                      : 'border-border/60 hover:bg-muted/40 text-muted-foreground'
                  }`}
                >
                  <p className="text-xs">{p.focusMins}p / {p.breakMins}p nghỉ</p>
                  <p className="text-[10px] text-primary/80 mt-0.5">+{p.xp} XP</p>
                </button>
              ))}
            </div>
          )}

          {/* Large Countdown Display */}
          <div className="relative flex flex-col items-center justify-center py-8 select-none">
            {/* Circular or Minimal Badge */}
            <Badge
              variant="outline"
              className={`mb-3 text-xs uppercase tracking-widest px-3 py-1 font-bold ${
                isBreak ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' : 'bg-primary/10 text-primary border-primary/30'
              }`}
            >
              {isBreak ? '☕ Giờ nghỉ ngơi thư giãn' : '🎯 Đang trong phiên học tập trung'}
            </Badge>

            <div className="font-mono text-6xl sm:text-7xl font-bold tracking-tight text-foreground">
              {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
            </div>

            {/* Linear Progress Bar */}
            <div className="w-full max-w-xs h-2 bg-muted rounded-full overflow-hidden mt-6">
              <div
                className={`h-full transition-all duration-300 ${isBreak ? 'bg-emerald-500' : 'bg-primary'}`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Sound Ambience Selector */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/40 border border-border/60 text-xs">
            <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
              <Volume2 className="h-4 w-4" /> Âm thanh tập trung:
            </span>
            <select
              value={selectedSound}
              onChange={(e) => setSelectedSound(e.target.value)}
              className="bg-background border border-border/60 rounded-xl px-2.5 py-1 text-xs font-medium"
            >
              {SOUNDS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button
              onClick={handleToggleTimer}
              size="lg"
              className={`rounded-2xl px-8 font-bold gap-2 text-sm shadow-md ${
                isActive ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''
              }`}
            >
              {isActive ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              {isActive ? 'Tạm dừng' : 'Bắt đầu tập trung'}
            </Button>

            <Button
              variant="outline"
              size="icon"
              onClick={handleReset}
              className="h-11 w-11 rounded-2xl"
              title="Đặt lại đồng hồ"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
