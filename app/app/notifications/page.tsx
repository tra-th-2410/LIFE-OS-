'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, Check, Loader2, BellRing, BarChart3, CalendarDays } from 'lucide-react';
import type { Notification } from '@/lib/types';
import { formatRelativeTime } from '@/lib/helpers';
import Link from 'next/link';
import { toast } from 'sonner';

export default function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setNotifications((data as Notification[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const handleMarkAllRead = async () => {
    if (!user) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    setNotifications(notifications.map((n) => ({ ...n, is_read: true })));
    toast.success('All marked as read');
  };

  const handleMarkRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(notifications.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  if (loading) {
    return <div className="max-w-2xl mx-auto space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl animate-shimmer" />)}</div>;
  }

  const getNotificationIcon = (type: string) => {
    if (type === 'daily_challenge_reminder') return <BellRing className="h-4 w-4 text-blue-500" />;
    if (type === 'weekly_challenge_report') return <BarChart3 className="h-4 w-4 text-green-600" />;
    if (type === 'monthly_challenge_report') return <CalendarDays className="h-4 w-4 text-purple-600" />;
    return <Bell className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold">Notifications</h1>
        {notifications.some((n) => !n.is_read) && (
          <Button variant="outline" size="sm" onClick={handleMarkAllRead} className="gap-1.5">
            <Check className="h-3.5 w-3.5" /> Mark all read
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Bell className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">No notifications yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <Card key={n.id} className={`border-border/60 ${!n.is_read ? 'border-primary/30 bg-primary/5' : ''}`}>
              <CardContent className="flex items-start gap-3 p-4">
                <div className="mt-0.5 shrink-0">
                  {getNotificationIcon(n.type)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{n.title}</p>
                    {!n.is_read && <Badge variant="secondary" className="text-xs">New</Badge>}
                  </div>
                  {n.body && <p className="text-sm text-muted-foreground mt-0.5 whitespace-pre-line">{n.body}</p>}
                  <p className="text-xs text-muted-foreground mt-1">{formatRelativeTime(n.created_at)}</p>
                </div>
                {n.link && (
                  <Link href={n.link}>
                    <Button variant="ghost" size="sm" onClick={() => handleMarkRead(n.id)}>View</Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
