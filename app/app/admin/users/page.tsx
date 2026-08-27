'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ArrowLeft, Shield, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { Profile } from '@/lib/types';
import { initials, formatDate } from '@/lib/helpers';

export default function AdminUsersPage() {
  const router = useRouter();
  const { user, loading, role } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    if (!loading && user && role !== 'admin' && role !== 'super_admin') router.push('/app');
  }, [user, loading, role, router]);

  useEffect(() => {
    if (role === 'admin' || role === 'super_admin') {
      supabase.from('profiles').select('*').order('created_at', { ascending: false }).then(({ data }) => {
        setUsers((data as Profile[]) ?? []);
        setPageLoading(false);
      });
    } else {
      setPageLoading(false);
    }
  }, [role]);

  if (loading || pageLoading) return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (role !== 'admin' && role !== 'super_admin') {
    return <div className="max-w-2xl mx-auto text-center py-20"><Shield className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" /><p className="text-lg font-medium">Admin access required</p><Link href="/app" className="mt-4 inline-block"><Badge variant="outline">Back to Home</Badge></Link></div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link href="/app/admin" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"><ArrowLeft className="h-4 w-4" /> Back to Admin Dashboard</Link>
      <div><h1 className="text-2xl font-display font-bold">Users</h1><p className="text-muted-foreground mt-1">All registered users on the platform.</p></div>
      <div className="space-y-2">
        {users.map((u) => (
          <Link key={u.id} href={`/app/profile/${u.username}`}>
            <Card className="border-border/60 hover:border-primary/30 transition-colors cursor-pointer">
              <CardContent className="flex items-center gap-3 p-3">
                <Avatar className="h-9 w-9"><AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{initials(u.username)}</AvatarFallback></Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{u.username}</p>
                  <p className="text-xs text-muted-foreground">Joined {formatDate(u.created_at)}</p>
                </div>
                {u.verification_status === 'verified' && <Badge className="bg-success/10 text-success text-xs gap-1"><Shield className="h-3 w-3" /> Verified</Badge>}
                {u.verification_status === 'pending' && <Badge className="bg-warning/10 text-warning text-xs">Pending</Badge>}
                {u.verification_status === 'basic' && <Badge variant="outline" className="text-xs">Unverified</Badge>}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
