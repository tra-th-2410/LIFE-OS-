'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Search,
  MessageSquare,
  Heart,
  Bookmark,
  ArrowLeft,
  Loader2,
  MoreVertical,
  Pencil,
  Trash2,
  EyeOff,
} from 'lucide-react';
import { toast } from 'sonner';
import type { ForumPost, ForumCategory, Profile } from '@/lib/types';
import { formatRelativeTime, initials } from '@/lib/helpers';
import { useLanguage } from '@/components/language-provider';

export default function ForumSearchPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<(ForumPost & { author?: Profile | null; category?: ForumCategory | null })[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [categories, setCategories] = useState<ForumCategory[]>([]);

  // Edit / Delete State
  const [editingPost, setEditingPost] = useState<(ForumPost & { author?: Profile | null; category?: ForumCategory | null }) | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingPost, setDeletingPost] = useState<(ForumPost & { author?: Profile | null; category?: ForumCategory | null }) | null>(null);
  const [deletingLoading, setDeletingLoading] = useState(false);

  useEffect(() => {
    supabase.from('forum_categories').select('*').order('sort_order').then(({ data }) => {
      setCategories((data as ForumCategory[]) ?? []);
    });
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    const q = query.toLowerCase();
    let dbQuery = supabase
      .from('forum_posts')
      .select('*, author:profiles!forum_posts_author_id_fkey(username, avatar_url, id), category:forum_categories!forum_posts_category_id_fkey(*)')
      .eq('status', 'active')
      .or(`title.ilike.%${q}%,content.ilike.%${q}%`)
      .order('created_at', { ascending: false })
      .limit(20);

    if (categoryFilter) {
      dbQuery = dbQuery.eq('category_id', categoryFilter);
    }

    dbQuery.then(({ data }) => {
      const filtered = (data as (ForumPost & { author?: Profile | null; category?: ForumCategory | null })[]) ?? [];
      // Also filter by tags
      const tagFiltered = query.trim()
        ? filtered.filter((p) => p.tags.some((t) => t.toLowerCase().includes(q)) || p)
        : filtered;
      setResults(tagFiltered);
      setLoading(false);
      setSearched(true);
    });
  }, [query, categoryFilter]);

  const handleStartEdit = (post: ForumPost & { author?: Profile | null; category?: ForumCategory | null }) => {
    setEditingPost(post);
    setEditTitle(post.title || '');
    setEditContent(post.content || '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingPost) return;
    if (!editTitle.trim() || !editContent.trim()) {
      toast.error(t('Please fill in both title and content'));
      return;
    }
    setSavingEdit(true);
    try {
      const { data, error } = await supabase
        .from('forum_posts')
        .update({
          title: editTitle.trim(),
          content: editContent.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingPost.id)
        .eq('author_id', user.id)
        .select('*, author:profiles!forum_posts_author_id_fkey(username, avatar_url, id), category:forum_categories!forum_posts_category_id_fkey(*)')
        .single();

      if (error) throw error;

      setResults((prev) =>
        prev.map((p) => (p.id === editingPost.id ? (data as any) : p))
      );
      setEditingPost(null);
      toast.success(t('Post updated'));
    } catch (err: any) {
      console.error(err);
      toast.error(t('Failed to update post'));
    } finally {
      setSavingEdit(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!user || !deletingPost) return;
    setDeletingLoading(true);
    try {
      const { error } = await supabase
        .from('forum_posts')
        .delete()
        .eq('id', deletingPost.id)
        .eq('author_id', user.id);

      if (error) throw error;

      setResults((prev) => prev.filter((p) => p.id !== deletingPost.id));
      setDeletingPost(null);
      toast.success(t('Post deleted'));
    } catch (err: any) {
      console.error(err);
      toast.error(t('Failed to delete post'));
    } finally {
      setDeletingLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link href="/app/forum" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Forum
      </Link>

      <div>
        <h1 className="text-2xl font-display font-bold">Search Forum</h1>
        <p className="text-muted-foreground mt-1">Search by title, content, or tags.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search posts..." value={query} onChange={(e) => setQuery(e.target.value)} className="pl-10" autoFocus />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
        </select>
      </div>

      {loading && <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}

      {!loading && searched && results.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Search className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">{t('No results found for')} &ldquo;{query}&rdquo;</p>
          </CardContent>
        </Card>
      )}

      {!loading && results.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{results.length} {t(results.length !== 1 ? 'result' : 'results')}</p>
          {results.map((p) => {
            const isOwner = Boolean(user && (user.id === p.author_id || user.id === p.author?.id));
            const displayName = p.is_anonymous ? t('Anonymous Student') : (p.author?.username ?? t('Unknown'));
            const avatarInit = p.is_anonymous ? 'A' : initials(p.author?.username ?? 'U');
            return (
              <Card key={p.id} className="group relative border-border/60 hover:border-primary/30 hover:shadow-md transition-all duration-200">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold">{avatarInit}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{displayName}</span>
                          <span className="text-xs text-muted-foreground">{formatRelativeTime(p.created_at)}</span>
                          {p.is_anonymous && (
                            <Badge variant="outline" className="text-xs gap-1">
                              <EyeOff className="h-3 w-3" /> Anonymous
                            </Badge>
                          )}
                          {p.category && <Badge variant="secondary" className="text-xs">{p.category.icon} {p.category.name}</Badge>}
                        </div>

                        {/* Owner Actions Menu */}
                        {isOwner && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground shrink-0"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreVertical className="h-4 w-4" />
                                <span className="sr-only">Options</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-36">
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartEdit(p);
                                }}
                                className="gap-2 cursor-pointer"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                <span>Edit</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeletingPost(p);
                                }}
                                className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>Delete</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>

                      <Link href={`/app/forum/post/${p.id}`} className="block">
                        <h3 className="font-semibold text-base mt-1 group-hover:text-primary transition-colors">{p.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{p.content}</p>
                      </Link>

                      {p.tags.length > 0 && <div className="flex flex-wrap gap-1 mt-2">{p.tags.map((t) => <Badge key={t} variant="outline" className="text-xs">#{t}</Badge>)}</div>}
                      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                        <Link href={`/app/forum/post/${p.id}`} className="flex items-center gap-1 hover:text-primary transition-colors">
                          <MessageSquare className="h-3.5 w-3.5" /> {p.comments_count}
                        </Link>
                        <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" /> {p.reactions_count}</span>
                        <span className="flex items-center gap-1"><Bookmark className="h-3.5 w-3.5" /> {p.bookmark_count}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {!searched && !loading && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Search className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">Start typing to search the forum.</p>
          </CardContent>
        </Card>
      )}

      {/* Edit Post Dialog */}
      <Dialog open={Boolean(editingPost)} onOpenChange={(open) => !open && setEditingPost(null)}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>{t('Edit Post')}</DialogTitle>
            <DialogDescription>
              {t('Make changes to your forum post.')}
              {editingPost?.is_anonymous && ` ${t('This post will remain anonymous.')}`}
            </DialogDescription>
          </DialogHeader>
          {editingPost && (
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="searchEditTitle">{t('Title')}</Label>
                <Input
                  id="searchEditTitle"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder={t('Post title')}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="searchEditContent">{t('Content')}</Label>
                <Textarea
                  id="searchEditContent"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder={t('Post content')}
                  rows={6}
                  required
                />
              </div>

              {editingPost.is_anonymous && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/40 border border-border/40 text-xs text-muted-foreground">
                  <EyeOff className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>{t('This post is published anonymously. Your identity remains private.')}</span>
                </div>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingPost(null)}>
                  {t('Cancel')}
                </Button>
                <Button type="submit" disabled={savingEdit || !editTitle.trim() || !editContent.trim()}>
                  {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : t('Save Changes')}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={Boolean(deletingPost)} onOpenChange={(open) => !open && setDeletingPost(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('Delete Post')}</DialogTitle>
            <DialogDescription>
              {t('Are you sure you want to delete this post? This action cannot be undone.')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingPost(null)} disabled={deletingLoading}>
              {t('Cancel')}
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={deletingLoading}>
              {deletingLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('Delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
