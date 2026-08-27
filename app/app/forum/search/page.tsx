'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, MessageSquare, Heart, Bookmark, ArrowLeft, Loader2 } from 'lucide-react';

import type { ForumPost, ForumCategory, Profile } from '@/lib/types';
import { formatRelativeTime, initials } from '@/lib/helpers';
import { useLanguage } from '@/components/language-provider';

export default function ForumSearchPage() {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<(ForumPost & { author?: Profile | null; category?: ForumCategory | null })[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [categories, setCategories] = useState<ForumCategory[]>([]);

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
            <p className="text-sm text-muted-foreground">{t('No results found for')} \u201c{query}\u201d</p>
          </CardContent>
        </Card>
      )}

      {!loading && results.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{results.length} {t(results.length !== 1 ? 'result' : 'results')}</p>
          {results.map((p) => {
            const displayName = p.is_anonymous ? t('Anonymous Student') : (p.author?.username ?? t('Unknown'));
            const avatarInit = p.is_anonymous ? 'A' : initials(p.author?.username ?? 'U');
            return (
              <Link key={p.id} href={`/app/forum/post/${p.id}`}>
                <Card className="group cursor-pointer border-border/60 hover:border-primary/30 hover:shadow-md transition-all duration-200">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold">{avatarInit}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{displayName}</span>
                          <span className="text-xs text-muted-foreground">{formatRelativeTime(p.created_at)}</span>
                          {p.category && <Badge variant="secondary" className="text-xs">{p.category.icon} {p.category.name}</Badge>}
                        </div>
                        <h3 className="font-semibold text-base mt-1 group-hover:text-primary transition-colors">{p.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{p.content}</p>
                        {p.tags.length > 0 && <div className="flex flex-wrap gap-1 mt-2">{p.tags.map((t) => <Badge key={t} variant="outline" className="text-xs">#{t}</Badge>)}</div>}
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
    </div>
  );
}
