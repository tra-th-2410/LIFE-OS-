'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home,
  BookOpen,
  Users,
  Bot,
  Heart,
  User,
  Settings,
  Bell,
  Search,
  Menu,
  X,
  LogOut,
  Shield,
  MessageSquare,
  FileCheck,
} from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { useLanguage } from '@/components/language-provider';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSwitcher } from '@/components/language-switcher';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { initials, getDisplayName } from '@/lib/helpers';
import { toast } from 'sonner';

interface NavItem {
  href: string;
  label: string;
  labelVi: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { href: '/app', label: 'Home', labelVi: 'Trang chủ', icon: Home },
  { href: '/app/study', label: 'Study', labelVi: 'Học tập', icon: BookOpen },
  { href: '/app/community', label: 'Community', labelVi: 'Cộng đồng', icon: Users },
  { href: '/app/ai', label: 'AI', labelVi: 'Trí tuệ nhân tạo', icon: Bot },
  { href: '/app/my-life', label: 'My Life', labelVi: 'Cuộc sống', icon: Heart },
  { href: '/app/profile', label: 'Profile', labelVi: 'Hồ sơ', icon: User },
  { href: '/app/settings', label: 'Settings', labelVi: 'Cài đặt', icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, profile, role, signOut } = useAuth();
  const { t } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const isAdmin = role === 'admin' || role === 'super_admin';

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const refreshUnreadCount = useCallback(async () => {
    if (!user) return;
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false);
    setUnreadCount(count ?? 0);
  }, [user]);

  useEffect(() => {
    if (user) {
      refreshUnreadCount();

      // Check daily challenge reminder for user session
      supabase
        .rpc('check_user_daily_challenge_reminder', { p_user_id: user.id })
        .then(({ error }) => {
          if (!error) refreshUnreadCount();
        });

      // Realtime subscription on notifications table
      const channel = supabase
        .channel(`user-notifications-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            refreshUnreadCount();
            if (payload.eventType === 'INSERT' && payload.new) {
              const notif = payload.new as { title?: string; body?: string };
              if (notif.title) {
                toast.info(notif.title, {
                  description: notif.body ?? undefined,
                });

                if (
                  typeof window !== 'undefined' &&
                  'Notification' in window &&
                  Notification.permission === 'granted'
                ) {
                  try {
                    new Notification(notif.title, {
                      body: notif.body ?? undefined,
                      icon: '/favicon.ico',
                    });
                  } catch {
                    // Ignore desktop notification error
                  }
                }
              }
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, refreshUnreadCount]);

  if (loading || (user && !profile)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-pulse rounded-xl bg-primary/20" />
          <p className="text-sm text-muted-foreground">Loading Life OS...</p>
        </div>
      </div>
    );
  }

  if (!user || !profile) return null;

  const handleSignOut = async () => {
    await signOut();
    toast.success('Signed out');
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header */}
      <header className="lg:hidden sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border">
        <div className="flex h-14 items-center justify-between px-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-2 text-foreground hover:bg-muted rounded-lg transition-colors"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/app" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#7D9B8A] text-white font-bold text-xs shadow-xs">
              🌿
            </div>
            <span className="font-display font-bold text-foreground">Life OS</span>
          </Link>
          <div className="flex items-center gap-1.5">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 bg-[#24302B] text-[#DDE8DF] border-r border-[#1e2824] animate-slide-in-right flex flex-col shadow-2xl">
            <div className="flex h-16 items-center justify-between px-5 border-b border-[#2d3d36]">
              <Link href="/app" className="flex items-center gap-2.5" onClick={() => setSidebarOpen(false)}>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#7D9B8A] text-white font-bold text-sm shadow-xs">
                  🌿
                </div>
                <div className="flex flex-col">
                  <span className="font-display font-bold text-base text-white tracking-tight">Life OS</span>
                  <span className="text-[10px] uppercase font-semibold tracking-wider text-[#DDE8DF]/60">Student System</span>
                </div>
              </Link>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1.5 text-[#DDE8DF]/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <Suspense fallback={<SidebarNavFallback />}>
              <SidebarContent
                pathname={pathname}
                isAdmin={isAdmin}
                unreadCount={unreadCount}
                onNavigate={() => setSidebarOpen(false)}
                onSignOut={handleSignOut}
              />
            </Suspense>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col border-r border-[#1e2824] bg-[#24302B] text-[#DDE8DF]">
        <div className="flex h-16 items-center gap-3 px-6 border-b border-[#2d3d36]">
          <Link href="/app" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#7D9B8A] text-white font-bold text-sm shadow-xs">
              🌿
            </div>
            <div className="flex flex-col">
              <span className="font-display font-bold text-lg text-white tracking-tight">Life OS</span>
              <span className="text-[10px] uppercase font-semibold tracking-wider text-[#DDE8DF]/60">Personal System</span>
            </div>
          </Link>
        </div>
        <Suspense fallback={<SidebarNavFallback />}>
          <SidebarContent
            pathname={pathname}
            isAdmin={isAdmin}
            unreadCount={unreadCount}
            onSignOut={handleSignOut}
          />
        </Suspense>
      </aside>

      {/* Main content area */}
      <div className="lg:pl-64">
        {/* Desktop top bar */}
        <header className="hidden lg:flex sticky top-0 z-30 h-16 items-center justify-between px-8 bg-background/85 backdrop-blur-md border-b border-border">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Link href="/app/search" className="block">
              <div className="w-full rounded-xl border border-border bg-card px-10 py-2 text-sm text-muted-foreground hover:border-primary/50 hover:bg-card/90 transition-colors shadow-2xs">
                {t('Search communities, projects, people...')}
              </div>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
            <Link href="/app/notifications">
              <Button
                variant="ghost"
                size="icon"
                className="relative h-9 w-9 rounded-xl hover:bg-muted text-foreground"
              >
                <Bell className="h-4.5 w-4.5 text-muted-foreground" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#7D9B8A] px-1 text-[10px] font-bold text-white shadow-xs">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Button>
            </Link>
            <Link href={profile ? `/app/profile/${profile.username}` : '/app/profile'}>
              <Avatar className="h-9 w-9 border-2 border-transparent hover:border-primary/40 transition-colors">
                {profile?.avatar_url && (
                  <img
                    src={profile.avatar_url}
                    alt={getDisplayName(profile)}
                    className="h-full w-full object-cover rounded-full"
                  />
                )}
                <AvatarFallback className="bg-[#7D9B8A]/15 text-[#24302B] dark:text-[#DDE8DF] text-xs font-semibold">
                  {initials(getDisplayName(profile))}
                </AvatarFallback>
              </Avatar>
            </Link>
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

function SidebarNavFallback() {
  return (
    <div className="flex-1 space-y-2 p-4">
      {[1, 2, 3, 4, 5, 6, 7].map((i) => (
        <div key={i} className="h-9 rounded-xl bg-white/5 animate-pulse" />
      ))}
    </div>
  );
}

function SidebarContent({
  pathname,
  isAdmin,
  unreadCount,
  onNavigate,
  onSignOut,
}: {
  pathname: string;
  isAdmin: boolean;
  unreadCount: number;
  onNavigate?: () => void;
  onSignOut: () => void;
}) {
  const { language, t } = useLanguage();

  const isItemActive = (href: string) => {
    if (href === '/app') {
      return pathname === '/app';
    }
    if (href === '/app/study') {
      return pathname.startsWith('/app/study');
    }
    if (href === '/app/community') {
      return pathname.startsWith('/app/community');
    }
    if (href === '/app/ai') {
      return pathname.startsWith('/app/ai') || pathname.startsWith('/app/study-coach');
    }
    if (href === '/app/my-life') {
      return pathname.startsWith('/app/my-life');
    }
    if (href === '/app/profile') {
      return pathname === '/app/profile' || pathname.startsWith('/app/profile/');
    }
    if (href === '/app/settings') {
      return pathname.startsWith('/app/settings');
    }
    return pathname.startsWith(href);
  };

  return (
    <div className="flex flex-1 flex-col overflow-y-auto scrollbar-thin">
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const active = isItemActive(item.href);
          const Icon = item.icon;
          const displayLabel = language === 'vi' ? item.labelVi : item.label;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all ${
                active
                  ? 'bg-[#7D9B8A] text-white shadow-xs'
                  : 'text-[#DDE8DF]/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon
                className={`h-4.5 w-4.5 shrink-0 transition-colors ${
                  active ? 'text-white' : 'text-[#DDE8DF]/70 group-hover:text-white'
                }`}
              />
              <span className="truncate">{displayLabel}</span>
            </Link>
          );
        })}

        {/* Notifications item in sidebar */}
        <Link
          href="/app/notifications"
          onClick={onNavigate}
          className={`group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all ${
            pathname.startsWith('/app/notifications')
              ? 'bg-[#7D9B8A] text-white shadow-xs'
              : 'text-[#DDE8DF]/80 hover:bg-white/10 hover:text-white'
          }`}
        >
          <Bell className="h-4.5 w-4.5 shrink-0 text-[#DDE8DF]/70 group-hover:text-white" />
          <span className="truncate">{language === 'vi' ? 'Thông báo' : 'Notifications'}</span>
          {unreadCount > 0 && (
            <Badge className="ml-auto h-5 min-w-5 px-1.5 text-[10px] bg-[#7D9B8A] text-white border-0">
              {unreadCount}
            </Badge>
          )}
        </Link>

        {/* Admin Navigation Section */}
        {isAdmin && (
          <>
            <div className="my-3 border-t border-[#2d3d36]" />
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[#DDE8DF]/50">
              {t('Admin')}
            </p>
            <Link
              href="/app/admin"
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-xl px-3.5 py-2 text-xs font-medium transition-all ${
                pathname === '/app/admin'
                  ? 'bg-[#7D9B8A] text-white'
                  : 'text-[#DDE8DF]/75 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Shield className="h-4 w-4" />
              <span>{t('Admin Dashboard')}</span>
            </Link>
            <Link
              href="/app/admin/verifications"
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-xl px-3.5 py-2 text-xs font-medium transition-all ${
                pathname === '/app/admin/verifications'
                  ? 'bg-[#7D9B8A] text-white'
                  : 'text-[#DDE8DF]/75 hover:bg-white/10 hover:text-white'
              }`}
            >
              <FileCheck className="h-4 w-4" />
              <span>{t('Verification Requests')}</span>
            </Link>
            <Link
              href="/app/admin/forum-moderation"
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-xl px-3.5 py-2 text-xs font-medium transition-all ${
                pathname === '/app/admin/forum-moderation'
                  ? 'bg-[#7D9B8A] text-white'
                  : 'text-[#DDE8DF]/75 hover:bg-white/10 hover:text-white'
              }`}
            >
              <MessageSquare className="h-4 w-4" />
              <span>{t('Forum Moderation')}</span>
            </Link>
          </>
        )}
      </nav>

      {/* Logout button at bottom */}
      <div className="border-t border-[#2d3d36] p-3">
        <button
          onClick={onSignOut}
          className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-[#DDE8DF]/80 hover:bg-red-500/15 hover:text-red-300 transition-colors"
        >
          <LogOut className="h-4.5 w-4.5" />
          <span>{language === 'vi' ? 'Đăng xuất' : 'Sign out'}</span>
        </button>
      </div>
    </div>
  );
}
