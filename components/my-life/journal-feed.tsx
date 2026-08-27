'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  BookOpen,
  Users,
  Search,
  Plus,
  UserPlus,
  Smile,
  Globe,
  Filter,
  Sparkles,
} from 'lucide-react';
import { JournalComposer } from './journal-composer';
import { JournalPostCard } from './journal-post-card';
import { FriendsDialog } from './friends-dialog';
import { moodEmoji } from '@/lib/helpers';
import type {
  JournalEntry,
  JournalEntryWithRelations,
  JournalPostAttachment,
  JournalPostReaction,
  Profile,
} from '@/lib/types';
import { toast } from 'sonner';

type FeedTab = 'friends' | 'mine' | 'public';

export function JournalFeed() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<JournalEntryWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FeedTab>('friends');
  const [search, setSearch] = useState('');
  const [filterMood, setFilterMood] = useState<number | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const [postToEdit, setPostToEdit] = useState<JournalEntryWithRelations | null>(null);
  const [friendsOpen, setFriendsOpen] = useState(false);

  const loadFeed = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      let query = supabase
        .from('journal_entries')
        .select('*, author:profiles!journal_entries_user_id_fkey(username, avatar_url, verification_status)')
        .order('created_at', { ascending: false });

      if (activeTab === 'mine') {
        query = query.eq('user_id', user.id);
      } else if (activeTab === 'public') {
        query = query.eq('visibility', 'public');
      }
      // Note: For 'friends', Supabase RLS policy automatically filters entries to (own OR public OR friends)

      const { data: rawData, error } = await query;
      if (error) throw error;

      let p = (rawData as JournalEntryWithRelations[]) ?? [];

      if (p.length === 0) {
        setPosts([]);
        return;
      }

      const postIds = p.map((item) => item.id);

      // Batch load attachments without N+1
      const [attsRes, reactsRes] = await Promise.all([
        supabase.from('journal_post_attachments').select('*').in('journal_id', postIds),
        supabase.from('journal_post_reactions').select('*').in('journal_id', postIds),
      ]);

      const attMap = new Map<string, JournalPostAttachment[]>();
      (attsRes.data as JournalPostAttachment[] | null)?.forEach((a) => {
        const arr = attMap.get(a.journal_id) ?? [];
        arr.push(a);
        attMap.set(a.journal_id, arr);
      });

      const reactMap = new Map<string, JournalPostReaction[]>();
      (reactsRes.data as JournalPostReaction[] | null)?.forEach((r) => {
        const arr = reactMap.get(r.journal_id) ?? [];
        arr.push(r);
        reactMap.set(r.journal_id, arr);
      });

      setPosts(
        p.map((item) => ({
          ...item,
          attachments: attMap.get(item.id) ?? [],
          reactions: reactMap.get(item.id) ?? [],
        }))
      );
    } catch {
      // Error fallback
    } finally {
      setLoading(false);
    }
  }, [user, activeTab]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  const handlePostCreated = (newEntry: JournalEntry) => {
    setShowComposer(false);
    setPostToEdit(null);
    loadFeed();
  };

  const handlePostUpdated = (updated: JournalEntryWithRelations) => {
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  const handlePostDeleted = (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  const filteredPosts = posts.filter((p) => {
    const q = search.toLowerCase().trim();
    const matchSearch =
      !q ||
      p.title?.toLowerCase().includes(q) ||
      p.content.toLowerCase().includes(q) ||
      p.author?.username?.toLowerCase().includes(q);

    const matchMood = filterMood === null || p.mood === filterMood;
    return matchSearch && matchMood;
  });

  return (
    <div className="space-y-6">
      {/* Header & Quick Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-bold flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" /> Nhật ký học tập & Chia sẻ
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Không gian ghi lại hành trình học tập, kinh nghiệm và kết nối với bạn bè cùng tiến bộ.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFriendsOpen(true)}
            className="gap-1.5 shadow-sm text-xs"
          >
            <Users className="h-4 w-4 text-primary" /> Bạn bè & Kết nối
          </Button>

          <Button
            size="sm"
            onClick={() => {
              setPostToEdit(null);
              setShowComposer(!showComposer);
            }}
            className="gap-1.5 shadow-sm text-xs"
          >
            <Plus className="h-4 w-4" /> {showComposer ? 'Đóng soạn bài' : 'Viết nhật ký mới'}
          </Button>
        </div>
      </div>

      {/* Composer Section */}
      {showComposer && (
        <div className="animate-in fade-in duration-200">
          <JournalComposer
            onPostCreated={handlePostCreated}
            entryToEdit={postToEdit}
            onCancelEdit={() => {
              setPostToEdit(null);
              setShowComposer(false);
            }}
          />
        </div>
      )}

      {/* Feed Filters & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        {/* Tab switcher */}
        <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/60 w-fit">
          <button
            onClick={() => setActiveTab('friends')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'friends'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Users className="h-3.5 w-3.5 text-primary" /> Bạn bè ({posts.length})
          </button>
          <button
            onClick={() => setActiveTab('mine')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'mine'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <BookOpen className="h-3.5 w-3.5 text-amber-500" /> Nhật ký của tôi
          </button>
          <button
            onClick={() => setActiveTab('public')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'public'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Globe className="h-3.5 w-3.5 text-emerald-500" /> Cộng đồng
          </button>
        </div>

        {/* Search & Mood Filter */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-60">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm kiếm nhật ký..."
              className="h-8 pl-8 text-xs bg-background/50 border-border/60"
            />
          </div>

          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setFilterMood(filterMood === m ? null : m)}
                className={`text-base p-1 rounded-lg transition-transform ${
                  filterMood === m ? 'bg-primary/20 scale-110 shadow-sm' : 'opacity-50 hover:opacity-100'
                }`}
                title={`Lọc cảm xúc: ${moodEmoji(m)}`}
              >
                {moodEmoji(m)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Posts Feed List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 rounded-2xl animate-shimmer bg-muted/40" />
          ))}
        </div>
      ) : filteredPosts.length === 0 ? (
        <Card className="border-dashed border-border/80">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center space-y-3">
            <div className="p-3 rounded-2xl bg-primary/10 text-primary">
              <BookOpen className="h-8 w-8" />
            </div>
            <div>
              <p className="font-semibold text-base">Chưa có bài nhật ký nào</p>
              <p className="text-sm text-muted-foreground max-w-sm mt-1">
                {activeTab === 'friends'
                  ? 'Hãy kết nối với bạn bè hoặc bắt đầu viết bài nhật ký đầu tiên của bạn để chia sẻ.'
                  : 'Hãy ghi lại những điều bạn học được hôm nay.'}
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <Button size="sm" onClick={() => setShowComposer(true)} className="gap-1.5">
                <Plus className="h-4 w-4" /> Viết bài nhật ký đầu tiên
              </Button>
              {activeTab === 'friends' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setFriendsOpen(true)}
                  className="gap-1.5"
                >
                  <UserPlus className="h-4 w-4" /> Kết nối bạn bè
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredPosts.map((post) => (
            <JournalPostCard
              key={post.id}
              post={post}
              onPostUpdated={handlePostUpdated}
              onPostDeleted={handlePostDeleted}
              onEditRequested={(item) => {
                setPostToEdit(item);
                setShowComposer(true);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          ))}
        </div>
      )}

      {/* Friends Dialog */}
      <FriendsDialog open={friendsOpen} onOpenChange={setFriendsOpen} />
    </div>
  );
}
