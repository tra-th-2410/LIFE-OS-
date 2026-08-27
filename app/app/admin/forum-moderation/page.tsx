'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Shield, Flag, Loader2, Check, X, Eye, MessageSquare, FileText } from 'lucide-react';
import type { ForumReport, Profile, ForumPost, ForumComment } from '@/lib/types';
import { formatRelativeTime } from '@/lib/helpers';
import { toast } from 'sonner';

type Filter = 'pending' | 'resolved' | 'dismissed';

export default function ForumModerationPage() {
  const router = useRouter();
  const { user, loading, role } = useAuth();
  const [reports, setReports] = useState<(ForumReport & { reporter?: Profile | null })[]>([]);
  const [filter, setFilter] = useState<Filter>('pending');
  const [pageLoading, setPageLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [reportContent, setReportContent] = useState<Record<string, { type: string; title?: string; content?: string; author?: string }>>({});

  useEffect(() => {
    if (!loading && user && role !== 'admin' && role !== 'super_admin' && role !== 'moderator') {
      router.push('/app');
    }
  }, [user, loading, role, router]);

  const loadData = useCallback(async () => {
    const { data } = await supabase
      .from('forum_reports')
      .select('*, reporter:profiles!forum_reports_reporter_id_fkey(username, avatar_url, id)')
      .order('created_at', { ascending: false });
    const reportsData = (data as (ForumReport & { reporter?: Profile | null })[]) ?? [];
    setReports(reportsData);

    // Load content for each report
    const contentMap: Record<string, { type: string; title?: string; content?: string; author?: string }> = {};
    await Promise.all(reportsData.map(async (r) => {
      if (r.target_type === 'post') {
        const { data: post } = await supabase
          .from('forum_posts')
          .select('*, author:profiles!forum_posts_author_id_fkey(username)')
          .eq('id', r.target_id)
          .maybeSingle();
        const p = post as (ForumPost & { author?: Profile | null }) | null;
        if (p) contentMap[r.id] = { type: 'Post', title: p.title, content: p.content, author: p.is_anonymous ? 'Anonymous Student' : (p.author?.username ?? 'Unknown') };
      } else if (r.target_type === 'comment') {
        const { data: comment } = await supabase
          .from('forum_comments')
          .select('*, author:profiles!forum_comments_author_id_fkey(username)')
          .eq('id', r.target_id)
          .maybeSingle();
        const c = comment as (ForumComment & { author?: Profile | null }) | null;
        if (c) contentMap[r.id] = { type: 'Comment', content: c.content, author: c.is_anonymous ? 'Anonymous Student' : (c.author?.username ?? 'Unknown') };
      }
    }));
    setReportContent(contentMap);
    setPageLoading(false);
  }, []);

  useEffect(() => {
    if (role === 'admin' || role === 'super_admin' || role === 'moderator') {
      loadData();
    } else {
      setPageLoading(false);
    }
  }, [role, loadData]);

  const handleResolve = async (id: string) => {
    setActing(id);
    try {
      const { error } = await supabase.from('forum_reports').update({ status: 'resolved', reviewed_by: user!.id, reviewed_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      toast.success('Report resolved');
      await loadData();
    } catch {
      toast.error('Failed to resolve report');
    } finally {
      setActing(null);
    }
  };

  const handleDismiss = async (id: string) => {
    setActing(id);
    try {
      const { error } = await supabase.from('forum_reports').update({ status: 'dismissed', reviewed_by: user!.id, reviewed_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      toast.success('Report dismissed');
      await loadData();
    } catch {
      toast.error('Failed to dismiss report');
    } finally {
      setActing(null);
    }
  };

  const handleHidePost = async (reportId: string, targetId: string) => {
    setActing(reportId);
    try {
      const { error } = await supabase.from('forum_posts').update({ status: 'hidden' }).eq('id', targetId);
      if (error) throw error;
      await supabase.from('forum_reports').update({ status: 'resolved', reviewed_by: user!.id, reviewed_at: new Date().toISOString() }).eq('id', reportId);
      toast.success('Post hidden and report resolved');
      await loadData();
    } catch {
      toast.error('Failed to hide post');
    } finally {
      setActing(null);
    }
  };

  const handleHideComment = async (reportId: string, targetId: string) => {
    setActing(reportId);
    try {
      const { error } = await supabase.from('forum_comments').update({ is_hidden: true }).eq('id', targetId);
      if (error) throw error;
      await supabase.from('forum_reports').update({ status: 'resolved', reviewed_by: user!.id, reviewed_at: new Date().toISOString() }).eq('id', reportId);
      toast.success('Comment hidden and report resolved');
      await loadData();
    } catch {
      toast.error('Failed to hide comment');
    } finally {
      setActing(null);
    }
  };

  if (loading || pageLoading) {
    return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (role !== 'admin' && role !== 'super_admin' && role !== 'moderator') {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <Shield className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
        <p className="text-lg font-medium">Moderator access required</p>
        <Link href="/app" className="mt-4 inline-block"><Button variant="outline">Back to Home</Button></Link>
      </div>
    );
  }

  const filtered = reports.filter((r) => r.status === filter);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link href="/app/admin" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Admin Dashboard
      </Link>

      <div>
        <h1 className="text-2xl font-display font-bold flex items-center gap-2"><Flag className="h-6 w-6" /> Forum Moderation</h1>
        <p className="text-muted-foreground mt-1">Review reported forum posts and comments.</p>
      </div>

      <div className="flex gap-2">
        {(['pending', 'resolved', 'dismissed'] as Filter[]).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${filter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
            {f} ({reports.filter((r) => r.status === f).length})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Flag className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">No {filter} reports.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const content = reportContent[r.id];
            return (
              <Card key={r.id} className="border-border/60">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
                      {r.target_type === 'post' ? <FileText className="h-5 w-5 text-destructive" /> : <MessageSquare className="h-5 w-5 text-destructive" />}
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs capitalize">{r.target_type}</Badge>
                        <Badge className={r.status === 'pending' ? 'bg-warning/10 text-warning text-xs' : r.status === 'resolved' ? 'bg-success/10 text-success text-xs' : 'bg-muted text-muted-foreground text-xs'}>
                          {r.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{formatRelativeTime(r.created_at)}</span>
                      </div>

                      <div className="rounded-lg bg-muted/50 p-3">
                        <p className="text-xs text-muted-foreground mb-1">Reported content:</p>
                        {content?.title && <p className="font-medium text-sm">{content.title}</p>}
                        {content?.content && <p className="text-sm text-muted-foreground line-clamp-3">{content.content}</p>}
                        {content?.author && <p className="text-xs text-muted-foreground mt-1">By: {content.author}</p>}
                      </div>

                      <div className="text-sm">
                        <p><span className="text-muted-foreground">Reason:</span> {r.reason}</p>
                        {r.description && <p><span className="text-muted-foreground">Details:</span> {r.description}</p>}
                        <p className="text-xs text-muted-foreground mt-1">Reported by: {r.reporter?.username ?? 'Unknown'}</p>
                      </div>

                      {r.status === 'pending' && (
                        <div className="flex flex-wrap gap-2 pt-2">
                          {r.target_type === 'post' && (
                            <Button size="sm" variant="destructive" onClick={() => handleHidePost(r.id, r.target_id)} disabled={acting === r.id} className="gap-1.5">
                              <Eye className="h-3.5 w-3.5" /> Hide Post
                            </Button>
                          )}
                          {r.target_type === 'comment' && (
                            <Button size="sm" variant="destructive" onClick={() => handleHideComment(r.id, r.target_id)} disabled={acting === r.id} className="gap-1.5">
                              <Eye className="h-3.5 w-3.5" /> Hide Comment
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => handleResolve(r.id)} disabled={acting === r.id} className="gap-1.5">
                            {acting === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Resolve
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleDismiss(r.id)} disabled={acting === r.id} className="gap-1.5">
                            <X className="h-3.5 w-3.5" /> Dismiss
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
