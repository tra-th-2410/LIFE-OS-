'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';
import { useLanguage } from '@/components/language-provider';
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
  Clock,
  BookOpen,
  Users,
  MessageSquare,
  Bot,
  Laptop,
  CheckCheck,
} from 'lucide-react';
import type { Notification } from '@/lib/types';
import { formatRelativeTime } from '@/lib/helpers';
import Link from 'next/link';
import { toast } from 'sonner';

type NotificationFilter = 'all' | 'calendar' | 'challenges' | 'community' | 'unread';

export default function NotificationsPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<NotificationFilter>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [desktopPerm, setDesktopPerm] = useState<NotificationPermission>('default');

  // Check browser notification permission
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setDesktopPerm(Notification.permission);
    }
  }, []);

  const requestDesktopNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      toast.error('Trình duyệt của bạn không hỗ trợ Desktop Notifications');
      return;
    }

    try {
      const perm = await Notification.requestPermission();
      setDesktopPerm(perm);
      if (perm === 'granted') {
        new Notification('Life OS - Thông Báo Hệ Thống', {
          body: 'Bạn đã kích hoạt thành công thông báo trên máy tính!',
          icon: '/favicon.ico',
        });
        toast.success('Đã kích hoạt thông báo trên máy tính thành công!');
      } else if (perm === 'denied') {
        toast.error('Bạn đã từ chối nhận thông báo. Vui lòng cho phép trong cài đặt trình duyệt.');
      }
    } catch {
      toast.error('Không thể yêu cầu quyền thông báo');
    }
  };

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

    if (!user) return;

    // Realtime subscription for incoming notifications
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
        (payload) => {
          if (payload.eventType === 'INSERT' && payload.new) {
            const newNotif = payload.new as Notification;
            setNotifications((prev) => [newNotif, ...prev.filter((n) => n.id !== newNotif.id)]);
          } else if (payload.eventType === 'DELETE' && payload.old) {
            setNotifications((prev) => prev.filter((n) => n.id !== (payload.old as Notification).id));
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            const updated = payload.new as Notification;
            setNotifications((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
          } else {
            load();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, load]);

  const handleMarkAllRead = async () => {
    if (!user) return;
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      toast.success(t('Mark all as read'));
    } catch {
      toast.error('Không thể cập nhật thông báo');
    }
  };

  const handleMarkOneRead = async (id: string) => {
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('id', id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    } catch {
      // ignore
    }
  };

  const handleDeleteAll = async () => {
    if (!user) return;
    try {
      await supabase.from('notifications').delete().eq('user_id', user.id);
      setNotifications([]);
      toast.success(t('Xóa tất cả'));
    } catch {
      toast.error('Không thể xóa thông báo');
    }
  };

  // Filter notifications
  const filteredNotifications = notifications.filter((n) => {
    if (!n || !n.type) return false;
    const typeStr = String(n.type).toLowerCase();
    if (filterTab === 'unread') return !n.is_read;
    if (filterTab === 'calendar') {
      return (
        typeStr.includes('calendar') ||
        typeStr.includes('schedule') ||
        typeStr.includes('reminder') ||
        typeStr.includes('study')
      );
    }
    if (filterTab === 'challenges') {
      return typeStr.includes('challenge') || typeStr.includes('streak') || typeStr.includes('report');
    }
    if (filterTab === 'community') {
      return (
        typeStr.includes('friend') ||
        typeStr.includes('comment') ||
        typeStr.includes('post') ||
        typeStr.includes('forum') ||
        typeStr.includes('chat')
      );
    }
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const renderIcon = (type: string) => {
    const tIcon = String(type || '').toLowerCase();
    if (tIcon.includes('calendar') || tIcon.includes('schedule') || tIcon.includes('reminder')) {
      return <Clock className="h-5 w-5 text-blue-500" />;
    }
    if (tIcon.includes('streak') || tIcon.includes('flame')) {
      return <Flame className="h-5 w-5 text-orange-500" />;
    }
    if (tIcon.includes('report') || tIcon.includes('chart')) {
      return <BarChart3 className="h-5 w-5 text-purple-500" />;
    }
    if (tIcon.includes('friend') || tIcon.includes('community')) {
      return <Users className="h-5 w-5 text-emerald-500" />;
    }
    if (tIcon.includes('chat') || tIcon.includes('message')) {
      return <MessageSquare className="h-5 w-5 text-teal-500" />;
    }
    if (tIcon.includes('ai') || tIcon.includes('coach')) {
      return <Bot className="h-5 w-5 text-primary" />;
    }
    return <Bell className="h-5 w-5 text-primary" />;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-display font-bold">{t('Trung Tâm Thông Báo')}</h1>
            {unreadCount > 0 && (
              <Badge className="bg-primary text-primary-foreground text-xs">{unreadCount} {t('mới')}</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {t('Trung tâm duy nhất tổng hợp thông báo Lịch học, Thử thách, Bạn bè, Diễn đàn và Trợ lý AI.')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button onClick={handleMarkAllRead} variant="outline" size="sm" className="gap-1.5 rounded-xl text-xs">
              <CheckCheck className="h-4 w-4" /> {t('Mark all as read')}
            </Button>
          )}
          {notifications.length > 0 && (
            <Button onClick={handleDeleteAll} variant="ghost" size="sm" className="gap-1.5 rounded-xl text-xs text-muted-foreground hover:text-destructive">
              <Trash2 className="h-4 w-4" /> {t('Xóa tất cả')}
            </Button>
          )}
        </div>
      </div>

      {/* Desktop Browser Notifications Banner (Requirement XIII) */}
      {desktopPerm !== 'granted' && (
        <Card className="border-primary/30 bg-primary/5 p-4 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3">
              <Laptop className="h-5 w-5 text-primary shrink-0 mt-0.5 sm:mt-0" />
              <div>
                <p className="font-semibold text-sm text-foreground">{t('Kích hoạt Desktop Notifications')}</p>
                <p className="text-xs text-muted-foreground">
                  {t('Nhận nhắc nhở lịch học và thử thách ngay cả khi bạn không mở tab Life OS.')}
                </p>
              </div>
            </div>
            <Button onClick={requestDesktopNotifications} size="sm" className="gap-1.5 rounded-xl shrink-0 self-start sm:self-auto">
              <BellRing className="h-4 w-4" /> {t('Bật thông báo')}
            </Button>
          </div>
        </Card>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-b border-border/40">
        {[
          { id: 'all' as const, label: t('Tất cả'), icon: Bell },
          { id: 'calendar' as const, label: t('Lịch học & Nhắc nhở'), icon: CalendarDays },
          { id: 'challenges' as const, label: t('Thử thách & Streak'), icon: Trophy },
          { id: 'community' as const, label: t('Bạn bè & Cộng đồng'), icon: Users },
          { id: 'unread' as const, label: `${t('Chưa đọc')} (${unreadCount})`, icon: BellRing },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = filterTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setFilterTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 border ${
                isActive
                  ? 'bg-primary/10 text-primary border-primary/30'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Notifications List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 rounded-2xl animate-shimmer" />
          ))}
        </div>
      ) : filteredNotifications.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Bell className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-foreground">{t('No notifications yet')}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {t('Bạn đã cập nhật toàn bộ tin tức và lịch nhắc nhở mới nhất!')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {filteredNotifications.map((n) => (
            <Card
              key={n.id}
              onClick={() => !n.is_read && handleMarkOneRead(n.id)}
              className={`border-border/60 transition-all cursor-pointer hover:border-primary/40 ${
                n.is_read ? 'bg-card/60 opacity-80' : 'bg-card/95 border-primary/20 shadow-xs'
              }`}
            >
              <CardContent className="p-4 flex items-start gap-3.5">
                <div className="h-9 w-9 rounded-xl bg-muted/60 flex items-center justify-center shrink-0">
                  {renderIcon(n.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-sm text-foreground leading-snug">{n.title}</p>
                    <span className="text-[11px] text-muted-foreground shrink-0">{formatRelativeTime(n.created_at)}</span>
                  </div>

                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{n.body}</p>

                  {n.link && (
                    <Link
                      href={n.link}
                      className="inline-flex items-center text-xs font-semibold text-primary hover:underline mt-2"
                    >
                      {t('View details')} →
                    </Link>
                  )}
                </div>

                {!n.is_read && (
                  <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1" title={t('Chưa đọc')} />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
