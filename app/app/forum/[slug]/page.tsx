'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
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
  ArrowLeft,
  Plus,
  Search,
  MessageSquare,
  Heart,
  Bookmark,
  Loader2,
  Clock,
  MoreVertical,
  Pencil,
  Trash2,
  EyeOff,
} from 'lucide-react';
import { toast } from 'sonner';
import type { ForumCategory, ForumPost, Profile } from '@/lib/types';
import { formatRelativeTime, initials } from '@/lib/helpers';
import { useLanguage } from '@/components/language-provider';

type SortMode = 'latest' | 'discussed' | 'helpful';

export default function ForumCategoryPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const params = useParams();
  const slug = params.slug as string;
  const [category, setCategory] = useState<ForumCategory | null>(null);
  const [posts, setPosts] = useState<(ForumPost & { author?: Profile | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortMode>('latest');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 10;
  const pageRef = useRef(0);

  // Edit / Delete State
  const [editingPost, setEditingPost] = useState<(ForumPost & { author?: Profile | null }) | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingPost, setDeletingPost] = useState<(ForumPost & { author?: Profile | null }) | null>(null);
  const [deletingLoading, setDeletingLoading] = useState(false);

  useEffect(() => {
    supabase.from('forum_categories').select('*').eq('slug', slug).maybeSingle().then(({ data }) => {
      setCategory(data as ForumCategory | null);
    });
  }, [slug]);

  const loadPosts = useCallback(async (reset = false, pageToLoad = 0) => {
    if (!category) return;
    const offset = pageToLoad * PAGE_SIZE;
    let query = supabase
      .from('forum_posts')
      .select('*, author:profiles!forum_posts_author_id_fkey(username, avatar_url, id)')
      .eq('status', 'active')
      .eq('category_id', category.id);

    if (sort === 'latest') query = query.order('created_at', { ascending: false });
    if (sort === 'discussed') query = query.order('comments_count', { ascending: false }).order('created_at', { ascending: false });
    if (sort === 'helpful') query = query.order('reactions_count', { ascending: false }).order('created_at', { ascending: false });

    query = query.range(offset, offset + PAGE_SIZE - 1);
    const { data } = await query;
    const newPosts = (data as (ForumPost & { author?: Profile | null })[]) ?? [];

    if (reset) {
      setPosts(newPosts);
      setPage(1);
      pageRef.current = 1;
    } else {
      setPosts((prev) => [...prev, ...newPosts]);
      setPage(pageToLoad + 1);
      pageRef.current = pageToLoad + 1;
    }
    setHasMore(newPosts.length === PAGE_SIZE);
    setLoading(false);
  }, [category, sort]);

  useEffect(() => {
    if (category) {
      setLoading(true);
      loadPosts(true, 0);
    }
  }, [category, sort, loadPosts]);

  const handleLoadMore = () => {
    loadPosts(false, pageRef.current);
  };

  const handleStartEdit = (post: ForumPost & { author?: Profile | null }) => {
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
        .select('*, author:profiles!forum_posts_author_id_fkey(username, avatar_url, id)')
        .single();

      if (error) throw error;

      setPosts((prev) =>
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

      setPosts((prev) => prev.filter((p) => p.id !== deletingPost.id));
      setDeletingPost(null);
      toast.success(t('Post deleted'));
    } catch (err: any) {
      console.error(err);
      toast.error(t('Failed to delete post'));
    } finally {
      setDeletingLoading(false);
    }
  };

  const filtered = search.trim()
    ? posts.filter((p) => p.title.toLowerCase().includes(search.toLowerCase()) || p.content.toLowerCase().includes(search.toLowerCase()))
    : posts;

  if (!loading && !category) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <p className="text-lg font-medium">Category not found</p>
        <Link href="/app/forum" className="mt-4 inline-block"><Button variant="outline">Back to Forum</Button></Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link href="/app/forum" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Forum
      </Link>

      {category && (
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="text-4xl">{category.icon}</span>
            <div>
              <h1 className="text-2xl font-display font-bold">{category.name}</h1>
              <p className="text-muted-foreground mt-1">{category.description}</p>
              <p className="text-xs text-muted-foreground mt-1">{category.posts_count} {t('posts')}</p>
            </div>
          </div>
          <Link href={`/app/forum/create?category=${category.slug}`}>
            <Button className="gap-1.5 shrink-0"><Plus className="h-4 w-4" /> New Post</Button>
          </Link>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search in this category..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <div className="flex gap-2">
          {([
            { key: 'latest' as const, label: 'Latest', icon: Clock },
            { key: 'discussed' as const, label: 'Discussed', icon: MessageSquare },
            { key: 'helpful' as const, label: 'Helpful', icon: Heart },
          ]).map((s) => (
            <button key={s.key} onClick={() => setSort(s.key)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${sort === s.key ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
              <s.icon className="h-3.5 w-3.5" /> {s.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-28 rounded-2xl animate-shimmer" />)}</div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <MessageSquare className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">No posts in this category yet.</p>
            <Link href={`/app/forum/create?category=${slug}`} className="mt-4">
              <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Be the first to post</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => {
            const isOwner = Boolean(user && (user.id === p.author_id || user.id === p.author?.id));
            const displayName = p.is_anonymous ? t('Anonymous Student') : p.author?.username ?? t('Unknown');
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

                      {p.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">{p.tags.map((t) => <Badge key={t} variant="outline" className="text-xs">#{t}</Badge>)}</div>
                      )}
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
          {!search && hasMore && (
            <div className="flex justify-center pt-4"><Button variant="outline" onClick={handleLoadMore}>Load More</Button></div>
          )}
        </div>
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
                <Label htmlFor="slugEditTitle">{t('Title')}</Label>
                <Input
                  id="slugEditTitle"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder={t('Post title')}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="slugEditContent">{t('Content')}</Label>
                <Textarea
                  id="slugEditContent"
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
