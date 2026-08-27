'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home,
  Users,
  Target,
  BookOpen,
  Heart,
  Bot,
  Bell,
  User,
  Search,
  Menu,
  X,
  LogOut,
  Sparkles,
  Shield,
  MessageSquare,
  FileCheck,
} from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSwitcher } from '@/components/language-switcher';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { initials } from '@/lib/helpers';
import { toast } from 'sonner';

const navItems = [
  { href: '/app', label: 'Home', icon: Home },
  { href: '/app/community', label: 'Community', icon: Users },
  { href: '/app/forum', label: 'Forum', icon: MessageSquare },
  { href: '/app/study', label: 'Challenges', icon: BookOpen },
  { href: '/app/projects', label: 'Projects', icon: Target },
  { href: '/app/my-life', label: 'My Life', icon: Heart },
  { href: '/app/ai', label: 'AI', icon: Bot },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, profile, role, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const isAdmin = role === 'admin' || role === 'super_admin';

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false)
        .then(({ count }) => setUnreadCount(count ?? 0));
    }
  }, [user]);

  if (loading || (user && !profile)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-pulse rounded-xl bg-primary/20" />
          <p className="text-sm text-muted-foreground">Loading...</p>
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

  const isActive = (href: string) => {
    if (href === '/app') return pathname === '/app';
    return pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header */}
      <header className="lg:hidden sticky top-0 z-40 glass border-b border-border/50">
        <div className="flex h-14 items-center justify-between px-4">
          <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2">
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/app" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
              L
            </div>
            <span className="font-display font-bold">Life OS</span>
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 bg-sidebar border-r border-sidebar-border animate-slide-in-right">
            <div className="flex h-14 items-center justify-between px-4 border-b border-sidebar-border">
              <Link href="/app" className="flex items-center gap-2" onClick={() => setSidebarOpen(false)}>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
                  L
                </div>
                <span className="font-display font-bold">Life OS</span>
              </Link>
              <button onClick={() => setSidebarOpen(false)} className="p-2 -mr-2">
                <X className="h-5 w-5" />
              </button>
            </div>
            <SidebarContent
              pathname={pathname}
              isActive={isActive}
              profile={profile}
              unreadCount={unreadCount}
              isAdmin={isAdmin}
              onNavigate={() => setSidebarOpen(false)}
              onSignOut={handleSignOut}
            />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col border-r border-sidebar-border bg-sidebar">
        <div className="flex h-16 items-center gap-2 px-6 border-b border-sidebar-border">
          <Link href="/app" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold">
              L
            </div>
            <span className="font-display font-bold text-lg">Life OS</span>
          </Link>
        </div>
        <SidebarContent
          pathname={pathname}
          isActive={isActive}
          profile={profile}
          unreadCount={unreadCount}
          isAdmin={isAdmin}
          onSignOut={handleSignOut}
        />
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Desktop top bar */}
        <header className="hidden lg:flex sticky top-0 z-30 h-16 items-center justify-between px-8 glass border-b border-border/50">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Link href="/app/search" className="block">
              <div className="w-full rounded-lg border border-input bg-muted/50 px-10 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors">
                Search communities, projects, people...
              </div>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
            <Link href="/app/notifications">
              <Button variant="ghost" size="icon" className="relative h-9 w-9">
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Button>
            </Link>
            <Link href={profile ? `/app/profile/${profile.username}` : '/app/profile'}>
              <Avatar className="h-9 w-9 border-2 border-transparent hover:border-primary/30 transition-colors">
                <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                  {profile ? initials(profile.username) : 'U'}
                </AvatarFallback>
              </Avatar>
            </Link>
          </div>
        </header>

        <main className="p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

function SidebarContent({
  pathname,
  isActive,
  profile,
  unreadCount,
  isAdmin,
  onNavigate,
  onSignOut,
}: {
  pathname: string;
  isActive: (href: string) => boolean;
  profile: { username: string; verification_status: string } | null;
  unreadCount: number;
  isAdmin: boolean;
  onNavigate?: () => void;
  onSignOut: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto scrollbar-thin">
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? 'bg-primary/10 text-primary'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
              }`}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
              {item.href === '/app/ai' && (
                <Sparkles className="ml-auto h-3 w-3 text-primary" />
              )}
            </Link>
          );
        })}

        <div className="my-3 border-t border-sidebar-border" />

        <Link
          href="/app/notifications"
          onClick={onNavigate}
          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
            isActive('/app/notifications')
              ? 'bg-primary/10 text-primary'
              : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
          }`}
        >
          <Bell className="h-5 w-5" />
          Notifications
          {unreadCount > 0 && (
            <Badge className="ml-auto h-5 min-w-5 px-1.5 text-xs">{unreadCount}</Badge>
          )}
        </Link>
        <Link
          href={profile ? `/app/profile/${profile.username}` : '/app/profile'}
          onClick={onNavigate}
          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
            pathname.startsWith('/app/profile')
              ? 'bg-primary/10 text-primary'
              : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
          }`}
        >
          <User className="h-5 w-5" />
          Profile
        </Link>

        {isAdmin && (
          <>
            <div className="my-3 border-t border-sidebar-border" />
            <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground/50">
              Admin
            </p>
            <Link
              href="/app/admin"
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                pathname === '/app/admin'
                  ? 'bg-primary/10 text-primary'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
              }`}
            >
              <Shield className="h-5 w-5" />
              Admin Dashboard
            </Link>
            <Link
              href="/app/admin/verifications"
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                pathname === '/app/admin/verifications'
                  ? 'bg-primary/10 text-primary'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
              }`}
            >
              <FileCheck className="h-5 w-5" />
              Verification Requests
            </Link>
            <Link
              href="/app/admin/forum-moderation"
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                pathname === '/app/admin/forum-moderation'
                  ? 'bg-primary/10 text-primary'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
              }`}
            >
              <MessageSquare className="h-5 w-5" />
              Forum Moderation
            </Link>
          </>
        )}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <button
          onClick={onSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <LogOut className="h-5 w-5" />
          Sign out
        </button>
      </div>
    </div>
  );
}
