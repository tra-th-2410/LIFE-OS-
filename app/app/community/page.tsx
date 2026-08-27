'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Search, Users, Plus, Eye, Lock, Loader2 } from 'lucide-react';
import type { Community } from '@/lib/types';
import { COMMUNITY_COLORS, slugify } from '@/lib/helpers';
import { toast } from 'sonner';

const EMOJI_OPTIONS = ['💬', '📚', '🎮', '🎨', '🏆', '🌱', '💻', '🎵', '⚽', '🔬', '🌍', '✨'];
const COLOR_OPTIONS = ['teal', 'blue', 'green', 'amber', 'rose', 'purple', 'orange', 'cyan'];

export default function CommunityListPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [filtered, setFiltered] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('💬');
  const [color, setColor] = useState('teal');
  const [isPrivate, setIsPrivate] = useState(false);
  const [creating, setCreating] = useState(false);

  const loadCommunities = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('communities')
      .select('*')
      .is('archived_at', null)
      .order('members_count', { ascending: false });
    if (error) {
      console.error('community list failed', error);
      setCommunities([]);
      setFiltered([]);
      toast.error('Unable to load communities. Please try again.');
    } else {
      const c = (data as Community[]) ?? [];
      setCommunities(c);
      setFiltered(c);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!authLoading) loadCommunities();
  }, [authLoading, user]);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(communities.filter((c) => c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)));
  }, [search, communities]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      router.push('/login');
      return;
    }
    if (!name.trim()) {
      toast.error('Community name is required');
      return;
    }
    if (!description.trim()) {
      toast.error('Description is required');
      return;
    }
    setCreating(true);
    try {
      const generatedSlug = slugify(name.trim());
      const slug = generatedSlug || `community-${Date.now().toString(36)}`;
      const { data, error } = await supabase.rpc('create_community', {
        p_name: name.trim(),
        p_slug: slug,
        p_description: description.trim(),
        p_icon: icon,
        p_color: color,
        p_is_private: isPrivate,
      });

      if (error) throw error;

      const newCommunity = data as Community;
      setCommunities([newCommunity, ...communities]);
      setFiltered([newCommunity, ...filtered]);
      setShowCreate(false);
      setName('');
      setDescription('');
      setIcon('💬');
      setColor('teal');
      setIsPrivate(false);
      toast.success('Community created!');
      router.push(`/app/community/${newCommunity.slug}`);
    } catch (cause) {
      console.error('community creation failed', cause);
      const message = cause instanceof Error ? cause.message : '';
      if (message.includes('AUTH_REQUIRED')) {
        toast.error('Please log in before creating a community.');
      } else if (message.includes('PROFILE_REQUIRED')) {
        toast.error('Your profile is not ready yet. Please log out and log in again.');
      } else if (message.includes('duplicate key') || message.includes('communities_slug_key')) {
        toast.error('That community name is already in use.');
      } else {
        toast.error('Unable to save the community. Please try again.');
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Communities</h1>
          <p className="text-muted-foreground mt-1">Find your people and join the conversation.</p>
        </div>
        <Button
          className="gap-1.5"
          onClick={() => {
            if (!user && !authLoading) {
              router.push('/login');
              return;
            }
            setShowCreate(true);
          }}
        >
          <Plus className="h-4 w-4" /> Create Community
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search communities..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 max-w-md"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-40 rounded-2xl animate-shimmer" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">No communities found. Try a different search.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <Link key={c.id} href={`/app/community/${c.slug}`}>
              <Card className="group cursor-pointer border-border/60 hover:border-primary/40 hover:shadow-lg transition-all duration-300 h-full">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/5 text-2xl">
                      {c.icon}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {c.is_anonymous && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <Eye className="h-3 w-3" /> Anonymous
                        </Badge>
                      )}
                      {c.is_private && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <Lock className="h-3 w-3" /> Private
                        </Badge>
                      )}
                    </div>
                  </div>
                  <h3 className="font-semibold text-base group-hover:text-primary transition-colors">{c.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{c.description}</p>
                  <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    {c.members_count.toLocaleString()} members
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Create Community</DialogTitle>
            <DialogDescription>
              Create a new community for students to connect and discuss.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Community Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Physics Lovers"
                required
                maxLength={50}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this community about?"
                required
                rows={3}
                maxLength={500}
              />
            </div>
            <div className="space-y-2">
              <Label>Icon</Label>
              <div className="flex flex-wrap gap-2">
                {EMOJI_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setIcon(emoji)}
                    className={`flex h-10 w-10 items-center justify-center rounded-lg text-xl transition-all ${
                      icon === emoji ? 'bg-primary/15 ring-2 ring-primary' : 'bg-muted hover:bg-muted/80'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`h-8 w-8 rounded-full transition-all ${
                      color === c ? 'ring-2 ring-foreground ring-offset-2' : ''
                    } ${COMMUNITY_COLORS[c]?.split(' ')[0] ?? 'bg-muted'}`}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
              <div>
                <Label className="flex items-center gap-1.5 cursor-pointer">
                  <Lock className="h-4 w-4" /> Private Community
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Private communities are only visible to members.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPrivate(!isPrivate)}
                className={`relative h-6 w-11 rounded-full transition-colors ${isPrivate ? 'bg-primary' : 'bg-muted'}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${isPrivate ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating || !name.trim() || !description.trim()}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
