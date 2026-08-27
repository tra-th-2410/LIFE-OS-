'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Plus, Search, MessageSquare, Heart, Bookmark, Loader2, Clock } from 'lucide-react';
import type { ForumCategory, ForumPost, Profile } from '@/lib/types';
import { formatRelativeTime, initials } from '@/lib/helpers';
import { useLanguage } from '@/components/language-provider';

type SortMode = 'latest' | 'discussed' | 'helpful';

export default function ForumCategoryPage() {
  const { t } = useLanguage();
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
            const displayName = p.is_anonymous ? t('Anonymous Student') : p.author?.username ?? t('Unknown');
            const avatarInit = p.is_anonymous ? 'A' : initials(p.author?.username ?? 'U');
            return (
              <Link key={p.id} href={`/app/forum/post/${p.id}`}>
                <Card className="group cursor-pointer border-border/60 hover:border-primary/30 hover:shadow-md transition-all duration-200">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold">{avatarInit}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{displayName}</span>
                          <span className="text-xs text-muted-foreground">{formatRelativeTime(p.created_at)}</span>
                        </div>
                        <h3 className="font-semibold text-base mt-1 group-hover:text-primary transition-colors">{p.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{p.content}</p>
                        {p.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">{p.tags.map((t) => <Badge key={t} variant="outline" className="text-xs">#{t}</Badge>)}</div>
                        )}
                        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" /> {p.comments_count}</span>
                          <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" /> {p.reactions_count}</span>
                          <span className="flex items-center gap-1"><Bookmark className="h-3.5 w-3.5" /> {p.bookmark_count}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
          {!search && hasMore && (
            <div className="flex justify-center pt-4"><Button variant="outline" onClick={handleLoadMore}>Load More</Button></div>
          )}
        </div>
      )}
    </div>
  );
}
