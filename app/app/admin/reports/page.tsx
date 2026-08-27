'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Shield, Flag, Loader2, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { Report } from '@/lib/types';
import { formatDate } from '@/lib/helpers';
import { toast } from 'sonner';

export default function AdminReportsPage() {
  const router = useRouter();
  const { user, loading, role } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user && role !== 'admin' && role !== 'super_admin') router.push('/app');
  }, [user, loading, role, router]);

  const loadData = useCallback(async () => {
    const { data } = await supabase.from('reports').select('*').order('created_at', { ascending: false });
    setReports((data as Report[]) ?? []);
    setPageLoading(false);
  }, []);

  useEffect(() => {
    if (role === 'admin' || role === 'super_admin') loadData();
    else setPageLoading(false);
  }, [role, loadData]);

  const handleResolve = async (id: string) => {
    setActing(id);
    try {
      await supabase.from('reports').update({ status: 'resolved' }).eq('id', id);
      await loadData();
      toast.success('Report resolved');
    } catch {
      toast.error('Failed to resolve report');
    } finally {
      setActing(null);
    }
  };

  if (loading || pageLoading) return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (role !== 'admin' && role !== 'super_admin') {
    return <div className="max-w-2xl mx-auto text-center py-20"><Shield className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" /><p className="text-lg font-medium">Admin access required</p><Link href="/app" className="mt-4 inline-block"><Badge variant="outline">Back to Home</Badge></Link></div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link href="/app/admin" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"><ArrowLeft className="h-4 w-4" /> Back to Admin Dashboard</Link>
      <div><h1 className="text-2xl font-display font-bold">Reports</h1><p className="text-muted-foreground mt-1">Review user-submitted reports.</p></div>
      {reports.length === 0 ? (
        <Card className="border-dashed"><CardContent className="flex flex-col items-center justify-center py-16 text-center"><Flag className="h-10 w-10 text-muted-foreground/40 mb-3" /><p className="text-sm text-muted-foreground">No reports.</p></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {reports.map((r) => (
            <Card key={r.id} className="border-border/60">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{r.target_type}</Badge>
                      {r.status === 'pending' && <Badge className="bg-warning/10 text-warning text-xs">Pending</Badge>}
                      {r.status === 'resolved' && <Badge className="bg-success/10 text-success text-xs">Resolved</Badge>}
                    </div>
                    <p className="text-sm mt-1">{r.reason}</p>
                    <p className="text-xs text-muted-foreground mt-1">{formatDate(r.created_at)}</p>
                  </div>
                  {r.status === 'pending' && (
                    <Button size="sm" variant="outline" onClick={() => handleResolve(r.id)} disabled={acting === r.id} className="gap-1.5">
                      {acting === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Resolve
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
