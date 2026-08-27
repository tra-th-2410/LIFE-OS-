'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, Users, FileCheck, Flag, MessageSquare, Settings, Loader2, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
  const router = useRouter();
  const { user, loading, role } = useAuth();
  const [stats, setStats] = useState({ pendingVerifications: 0, totalUsers: 0, pendingReports: 0, totalCommunities: 0 });
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    if (!loading && user && role !== 'admin' && role !== 'super_admin') {
      router.push('/app');
    }
  }, [user, loading, role, router]);

  useEffect(() => {
    if (role === 'admin' || role === 'super_admin') {
      Promise.all([
        supabase.from('student_verifications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('communities').select('id', { count: 'exact', head: true }),
      ]).then(([v, u, r, c]) => {
        setStats({
          pendingVerifications: v.count ?? 0,
          totalUsers: u.count ?? 0,
          pendingReports: r.count ?? 0,
          totalCommunities: c.count ?? 0,
        });
        setPageLoading(false);
      });
    } else {
      setPageLoading(false);
    }
  }, [role]);

  if (loading || pageLoading) {
    return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (role !== 'admin' && role !== 'super_admin') {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <Shield className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
        <p className="text-lg font-medium">Admin access required</p>
        <p className="text-sm text-muted-foreground mt-2">You don&apos;t have permission to view this page.</p>
        <Link href="/app" className="mt-4 inline-block"><Badge variant="outline">Back to Home</Badge></Link>
      </div>
    );
  }

  const cards = [
    { title: 'Student Verifications', icon: FileCheck, value: stats.pendingVerifications, label: 'pending review', href: '/app/admin/verifications', color: 'text-warning', bg: 'bg-warning/10' },
    { title: 'Users', icon: Users, value: stats.totalUsers, label: 'total users', href: '/app/admin/users', color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { title: 'Reports', icon: Flag, value: stats.pendingReports, label: 'pending reports', href: '/app/admin/reports', color: 'text-destructive', bg: 'bg-destructive/10' },
    { title: 'Forum Moderation', icon: MessageSquare, value: 0, label: 'reported content', href: '/app/admin/forum-moderation', color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { title: 'Communities', icon: MessageSquare, value: stats.totalCommunities, label: 'total communities', href: '/app/community', color: 'text-teal-500', bg: 'bg-teal-500/10' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold flex items-center gap-2"><Shield className="h-6 w-6" /> Admin Dashboard</h1>
        <p className="text-muted-foreground mt-1">Manage verifications, users, reports, and platform settings.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.map((c) => (
          <Link key={c.title} href={c.href}>
            <Card className="border-border/60 hover:border-primary/30 hover:shadow-md transition-all cursor-pointer">
              <CardContent className="p-5 flex items-center gap-4">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${c.bg}`}>
                  <c.icon className={`h-5 w-5 ${c.color}`} />
                </div>
                <div className="flex-1">
                  <p className="text-2xl font-bold font-display">{c.value}</p>
                  <p className="text-sm text-muted-foreground">{c.title} — {c.label}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Link href="/app/admin/verifications" className="flex items-center justify-between rounded-lg border border-border/60 p-3 hover:bg-muted transition-colors">
            <span className="text-sm font-medium">Review pending verifications</span>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </Link>
          <Link href="/app/admin/forum-moderation" className="flex items-center justify-between rounded-lg border border-border/60 p-3 hover:bg-muted transition-colors">
            <span className="text-sm font-medium">Moderate forum content</span>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </Link>
          <Link href="/app/settings" className="flex items-center justify-between rounded-lg border border-border/60 p-3 hover:bg-muted transition-colors">
            <span className="text-sm font-medium">Platform settings</span>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
