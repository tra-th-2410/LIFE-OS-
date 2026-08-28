'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Bell,
  Check,
  BellRing,
  BarChart3,
  CalendarDays,
  Trophy,
  Flame,
  CheckCircle2,
  Trash2,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import type { Notification } from '@/lib/types';
import { formatRelativeTime } from '@/lib/helpers';
import Link from 'next/link';
import { toast } from 'sonner';

const CHALLENGE_NOTIFICATION_TYPES = new Set([
  'daily_challenge_reminder',
  'challenge_completed',
  'challenge_streak',
  'challenge_checkin',
  'weekly_challenge_report',
  'monthly_challenge_report',
]);

export default function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<'all' | 'challenges' | 'unread'>('all');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications((data as Notification[]) ?? []);
    } catch (err) {
      console.error('Error loading notifications:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime subscription for instant notification updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`notifications-page-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          load();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, load]);

  const handleMarkAllRead = async () => {
    if (!user) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    toast.success('Đã đánh dấu tất cả là đã đọc');
  };

  const handleMarkRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  const handleDeleteNotification = async (id: string) => {
    const { error } = await supabase.from('notifications').delete().eq('id', id);
    if (error) {
      toast.error('Không thể xóa thông báo');
      return;
    }
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    toast.success('Đã xóa thông báo');
  };

  const handleTriggerDailyReminderCheck = async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      const { data, error } = await supabase.rpc('check_user_daily_challenge_reminder', {
        p_user_id: user.id,
      });
      if (error) throw error;
      await load();
      if (data && Number(data) > 0) {
        toast.success('Đã tạo thông báo nhắc nhở thử thách hôm nay!');
      } else {
        toast.info('Bạn đã nhận nhắc nhở hôm nay hoặc không có thử thách cần làm!');
      }
    } catch (err) {
      console.error('Error triggering daily reminder:', err);
      toast.error('Không thể kiểm tra nhắc nhở');
      setRefreshing(false);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'daily_challenge_reminder':
        return (
          <div className="h-9 w-9 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
            <BellRing className="h-5 w-5" />
          </div>
        );
      case 'challenge_completed':
        return (
          <div className="h-9 w-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 shadow-xs">
            <Trophy className="h-5 w-5" />
          </div>
        );
      case 'challenge_streak':
        return (
          <div className="h-9 w-9 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center shrink-0">
            <Flame className="h-5 w-5" />
          </div>
        );
      case 'challenge_checkin':
        return (
          <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        );
      case 'weekly_challenge_report':
        return (
          <div className="h-9 w-9 rounded-xl bg-green-600/10 text-green-600 flex items-center justify-center shrink-0">
            <BarChart3 className="h-5 w-5" />
          </div>
        );
      case 'monthly_challenge_report':
        return (
          <div className="h-9 w-9 rounded-xl bg-purple-600/10 text-purple-600 flex items-center justify-center shrink-0">
            <CalendarDays className="h-5 w-5" />
          </div>
        );
      default:
        return (
          <div className="h-9 w-9 rounded-xl bg-muted text-muted-foreground flex items-center justify-center shrink-0">
            <Bell className="h-5 w-5" />
          </div>
        );
    }
  };

  const getNotificationBadge = (type: string) => {
    switch (type) {
      case 'daily_challenge_reminder':
        return <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-[10px]">Nhắc thử thách</Badge>;
      case 'challenge_completed':
        return <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]">Hoàn thành</Badge>;
      case 'challenge_streak':
        return <Badge variant="secondary" className="bg-orange-500/10 text-orange-600 border-orange-500/20 text-[10px]">Streak 🔥</Badge>;
      case 'challenge_checkin':
        return <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">Check-in</Badge>;
      case 'weekly_challenge_report':
        return <Badge variant="secondary" className="bg-green-600/10 text-green-700 border-green-600/20 text-[10px]">Báo cáo tuần</Badge>;
      case 'monthly_challenge_report':
        return <Badge variant="secondary" className="bg-purple-600/10 text-purple-700 border-purple-600/20 text-[10px]">Báo cáo tháng</Badge>;
      default:
        return null;
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filterTab === 'unread') return !n.is_read;
    if (filterTab === 'challenges') return CHALLENGE_NOTIFICATION_TYPES.has(n.type);
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const challengeCount = notifications.filter((n) => CHALLENGE_NOTIFICATION_TYPES.has(n.type)).length;

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-2xl animate-shimmer" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold">Thông báo</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Cập nhật về thử thách học tập, chuỗi ngày rèn luyện và tiến độ cá nhân.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTriggerDailyReminderCheck}
            disabled={refreshing}
            className="gap-1.5 rounded-xl text-xs"
            title="Kiểm tra & tạo nhắc nhở thử thách hôm nay"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Kiểm tra nhắc nhở
          </Button>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={handleMarkAllRead} className="gap-1.5 rounded-xl text-xs">
              <Check className="h-3.5 w-3.5" /> Đã đọc tất cả
            </Button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/60 border border-border/60 w-fit">
        <button
          onClick={() => setFilterTab('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            filterTab === 'all'
              ? 'bg-background shadow-xs text-foreground font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Tất cả ({notifications.length})
        </button>
        <button
          onClick={() => setFilterTab('challenges')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
            filterTab === 'challenges'
              ? 'bg-background shadow-xs text-primary font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Flame className="h-3.5 w-3.5 text-orange-500" />
          Thử thách ({challengeCount})
        </button>
        <button
          onClick={() => setFilterTab('unread')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            filterTab === 'unread'
              ? 'bg-background shadow-xs text-foreground font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Chưa đọc ({unreadCount})
        </button>
      </div>

      {/* Notification List */}
      {filteredNotifications.length === 0 ? (
        <Card className="border-dashed rounded-2xl">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center space-y-2">
            <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground/40 mb-1">
              <Bell className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium text-foreground">Không có thông báo nào</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              {filterTab === 'unread'
                ? 'Bạn đã đọc tất cả thông báo!'
                : filterTab === 'challenges'
                ? 'Chưa có thông báo liên quan đến thử thách nào.'
                : 'Hiện tại bạn chưa có thông báo mới.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {filteredNotifications.map((n) => (
            <Card
              key={n.id}
              className={`border-border/60 transition-all rounded-2xl hover:border-border hover:shadow-xs ${
                !n.is_read ? 'border-primary/40 bg-primary/5' : 'bg-card'
              }`}
            >
              <CardContent className="flex items-start gap-3.5 p-4">
                {getNotificationIcon(n.type)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground truncate">{n.title}</p>
                    {getNotificationBadge(n.type)}
                    {!n.is_read && (
                      <span className="flex h-2 w-2 rounded-full bg-primary shrink-0" />
                    )}
                  </div>
                  {n.body && (
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1 whitespace-pre-line leading-relaxed">
                      {n.body}
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground/70 mt-1.5">
                    {formatRelativeTime(n.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {n.link && (
                    <Link href={n.link}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-xl text-xs h-8 px-2.5"
                        onClick={() => handleMarkRead(n.id)}
                      >
                        Xem
                      </Button>
                    </Link>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-xl text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleDeleteNotification(n.id)}
                    title="Xóa thông báo"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
