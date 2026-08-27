'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageSquare, Plus, Search, Clock, Flame, Bookmark, Heart, Loader2, Paperclip } from 'lucide-react';
import type { ForumCategory, ForumPost, Profile, ForumPostAttachment, ForumPostReaction } from '@/lib/types';
import { formatRelativeTime, initials } from '@/lib/helpers';
import { useLanguage } from '@/components/language-provider';

type SortMode = 'latest' | 'discussed' | 'helpful' | 'trending';

export default function ForumPage() {
  const { t } = useLanguage();
  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [posts, setPosts] = useState<(ForumPost & { author?: Profile | null; category?: ForumCategory | null; attachments?: ForumPostAttachment[]; reactions?: ForumPostReaction[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortMode>('latest');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 10;

  useEffect(() => {
    supabase.from('forum_categories').select('*').order('sort_order').then(({ data }) => {
      setCategories((data as ForumCategory[]) ?? []);
    });
  }, []);

  const loadPosts = useCallback(async (reset = false, pageToLoad = 0) => {
    const offset = pageToLoad * PAGE_SIZE;
    let query = supabase
      .from('forum_posts')
      .select('*, author:profiles!forum_posts_author_id_fkey(username, avatar_url, id), category:forum_categories!forum_posts_category_id_fkey(*)')
      .eq('status', 'active');

    if (sort === 'latest') query = query.order('created_at', { ascending: false });
    if (sort === 'discussed') query = query.order('comments_count', { ascending: false }).order('created_at', { ascending: false });
    if (sort === 'helpful') query = query.order('reactions_count', { ascending: false }).order('created_at', { ascending: false });
    if (sort === 'trending') query = query.order('reactions_count', { ascending: false }).order('comments_count', { ascending: false }).order('created_at', { ascending: false });

    query = query.range(offset, offset + PAGE_SIZE - 1);
    const { data, error } = await query;
    if (error) {
      console.error('forum posts load failed', error);
      setHasMore(false);
      setLoading(false);
      return;
    }

    const newPosts = (data as (ForumPost & { author?: Profile | null; category?: ForumCategory | null; attachments?: ForumPostAttachment[]; reactions?: ForumPostReaction[] })[]) ?? [];

    if (newPosts.length > 0) {
      const postIds = newPosts.map((p) => p.id);
      const [attsRes, reactsRes] = await Promise.all([
        supabase.from('forum_post_attachments').select('*').in('post_id', postIds),
        supabase.from('forum_post_reactions').select('*').in('post_id', postIds),
      ]);
      const attMap = new Map<string, ForumPostAttachment[]>();
      (attsRes.data as ForumPostAttachment[] | null)?.forEach((a) => {
        const arr = attMap.get(a.post_id) ?? [];
        arr.push(a);
        attMap.set(a.post_id, arr);
      });
      const reactMap = new Map<string, ForumPostReaction[]>();
      (reactsRes.data as ForumPostReaction[] | null)?.forEach((r) => {
        const arr = reactMap.get(r.post_id) ?? [];
        arr.push(r);
        reactMap.set(r.post_id, arr);
      });
      newPosts.forEach((p) => {
        p.attachments = attMap.get(p.id) ?? [];
        p.reactions = reactMap.get(p.id) ?? [];
      });
    }

    if (reset) {
      setPosts(newPosts);
      setPage(1);
    } else {
      setPosts((prev) => [...prev, ...newPosts]);
      setPage(pageToLoad + 1);
    }
    setHasMore(newPosts.length === PAGE_SIZE);
    setLoading(false);
  }, [sort]);

  useEffect(() => {
    setLoading(true);
    setPage(0);
    loadPosts(true, 0);
  }, [sort, loadPosts]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return posts;
    return posts.filter((p) =>
      p.title.toLowerCase().includes(query) ||
      p.content.toLowerCase().includes(query) ||
      p.tags.some((tag) => tag.toLowerCase().includes(query))
    );
  }, [posts, search]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <MessageSquare className="h-6 w-6" /> Forum
          </h1>
          <p className="text-muted-foreground mt-1">A space to discuss, ask questions, and share with the Life OS community.</p>
        </div>
        <Link href="/app/forum/create">
          <Button className="gap-1.5">
            <Plus className="h-4 w-4" /> Create Post
          </Button>
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search the forum..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Categories */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Categories</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {categories.map((c) => (
            <Link key={c.id} href={`/app/forum/${c.slug}`}>
              <Card className="group cursor-pointer border-border/60 hover:border-primary/40 hover:shadow-md transition-all duration-200 h-full">
                <CardContent className="p-4">
                  <div className="flex items-start gap-2">
                    <span className="text-2xl">{c.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm group-hover:text-primary transition-colors">{c.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{c.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">{c.posts_count} {t('posts')}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Sort tabs */}
      <div className="flex items-center gap-2 border-b border-border/60 pb-3">
        {([
          { key: 'latest' as const, label: 'Latest', icon: Clock },
          { key: 'discussed' as const, label: 'Most Discussed', icon: MessageSquare },
          { key: 'helpful' as const, label: 'Most Helpful', icon: Heart },
          { key: 'trending' as const, label: 'Trending', icon: Flame },
        ]).map((s) => (
          <button
            key={s.key}
            onClick={() => setSort(s.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              sort === s.key ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            <s.icon className="h-3.5 w-3.5" />
            {s.label}
          </button>
        ))}
      </div>

      {/* Posts */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-28 rounded-2xl animate-shimmer" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <MessageSquare className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">No posts yet. Be the first to start a discussion!</p>
            <Link href="/app/forum/create" className="mt-4">
              <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Create Post</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
          {!search && hasMore && (
            <div className="flex justify-center pt-4">
              <Button variant="outline" onClick={() => loadPosts(false, page)}>Load More</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PostCard({ post }: { post: ForumPost & { author?: Profile | null; category?: ForumCategory | null; attachments?: ForumPostAttachment[]; reactions?: ForumPostReaction[] } }) {
  const { t } = useLanguage();
  const displayName = post.is_anonymous ? t('Anonymous Student') : (post.author?.username ?? t('Unknown'));
  const avatarInit = post.is_anonymous ? 'A' : initials(post.author?.username ?? 'U');
  const atts = post.attachments ?? [];
  const imageAtts = atts.filter((a) => a.is_image);
  const fileAtts = atts.filter((a) => !a.is_image);
  const emojiReacts = post.reactions ?? [];
  const reactionSummary = ['❤️', '👍', '😂', '😮', '😢', '😡', '🎉', '🔥'].map((type) => ({
    type,
    count: emojiReacts.filter((r) => r.reaction_type === type).length,
  })).filter((r) => r.count > 0);

  return (
    <Link href={`/app/forum/post/${post.id}`}>
      <Card className="group cursor-pointer border-border/60 hover:border-primary/30 hover:shadow-md transition-all duration-200">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold">
              {avatarInit}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">{displayName}</span>
                <span className="text-xs text-muted-foreground">{formatRelativeTime(post.created_at)}</span>
                {post.category && (
                  <Link href={`/app/forum/${post.category.slug}`} onClick={(e) => e.stopPropagation()}>
                    <Badge variant="secondary" className="text-xs gap-1">
                      <span>{post.category.icon}</span> {post.category.name}
                    </Badge>
                  </Link>
                )}
              </div>
              <h3 className="font-semibold text-base mt-1 group-hover:text-primary transition-colors">{post.title}</h3>
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{post.content}</p>
              {imageAtts.length > 0 && (
                <div className="flex gap-1.5 mt-2">
                  {imageAtts.slice(0, 3).map((att) => (
                    <div key={att.id} className="h-16 w-16 rounded-lg overflow-hidden border border-border/60 bg-muted shrink-0">
                      <AsyncForumThumb attachment={att} />
                    </div>
                  ))}
                  {imageAtts.length > 3 && (
                    <div className="h-16 w-16 rounded-lg border border-border/60 bg-muted flex items-center justify-center text-xs text-muted-foreground shrink-0">
                      +{imageAtts.length - 3}
                    </div>
                  )}
                </div>
              )}
              {fileAtts.length > 0 && (
                <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                  <Paperclip className="h-3.5 w-3.5" />
                  {fileAtts.length} {fileAtts.length === 1 ? 'file' : 'files'}
                </div>
              )}
              {reactionSummary.length > 0 && (
                <div className="flex items-center gap-1 mt-2">
                  {reactionSummary.map(({ type, count }) => (
                    <span key={type} className="flex items-center gap-0.5 rounded-full bg-muted/50 px-2 py-0.5 text-xs">
                      <span>{type}</span>
                      <span className="font-medium">{count}</span>
                    </span>
                  ))}
                </div>
              )}
              {post.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {post.tags.map((t) => (
                    <Badge key={t} variant="outline" className="text-xs">#{t}</Badge>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" /> {post.comments_count}</span>
                <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" /> {post.reactions_count}</span>
                <span className="flex items-center gap-1"><Bookmark className="h-3.5 w-3.5" /> {post.bookmark_count}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function AsyncForumThumb({ attachment }: { attachment: ForumPostAttachment }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.storage.from('community-files').createSignedUrl(attachment.file_path, 3600);
      if (!cancelled && !error && data) setUrl(data.signedUrl);
    })();
    return () => { cancelled = true; };
  }, [attachment.file_path]);

  if (!url) return <div className="h-full w-full bg-muted animate-shimmer" />;
  return <img src={url} alt={attachment.file_name} className="h-full w-full object-cover" />;
}
