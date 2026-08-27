'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Users, Target, User } from 'lucide-react';
import type { Community, Project, Profile } from '@/lib/types';
import { initials } from '@/lib/helpers';

type Tab = 'all' | 'communities' | 'projects' | 'people';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [communities, setCommunities] = useState<Community[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [people, setPeople] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setCommunities([]);
      setProjects([]);
      setPeople([]);
      return;
    }
    setLoading(true);
    const q = query.toLowerCase();
    Promise.all([
      supabase.from('communities').select('*').is('archived_at', null).ilike('name', `%${q}%`).limit(10),
      supabase.from('projects').select('*').ilike('name', `%${q}%`).limit(10),
      supabase.from('profiles').select('*').ilike('username', `%${q}%`).limit(10),
    ]).then(([c, p, ppl]) => {
      setCommunities((c.data as Community[]) ?? []);
      setProjects((p.data as Project[]) ?? []);
      setPeople((ppl.data as Profile[]) ?? []);
      setLoading(false);
    });
  }, [query]);

  const showCommunities = tab === 'all' || tab === 'communities';
  const showProjects = tab === 'all' || tab === 'projects';
  const showPeople = tab === 'all' || tab === 'people';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-display font-bold">Search</h1>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search communities, projects, people..." value={query} onChange={(e) => setQuery(e.target.value)} className="pl-10" autoFocus />
      </div>

      <div className="flex gap-2">
        {(['all', 'communities', 'projects', 'people'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${tab === t ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
            {t}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-muted-foreground">Searching...</p>}

      {!loading && query.trim() && showCommunities && communities.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5"><Users className="h-4 w-4" /> Communities</h2>
          {communities.map((c) => (
            <Link key={c.id} href={`/app/community/${c.slug}`}>
              <Card className="border-border/60 hover:border-primary/30 transition-colors cursor-pointer">
                <CardContent className="flex items-center gap-3 p-3">
                  <span className="text-2xl">{c.icon}</span>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{c.name}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">{c.description}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">{c.members_count.toLocaleString()}</Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </section>
      )}

      {!loading && query.trim() && showProjects && projects.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5"><Target className="h-4 w-4" /> Projects</h2>
          {projects.map((p) => (
            <Link key={p.id} href={`/app/projects/${p.id}`}>
              <Card className="border-border/60 hover:border-primary/30 transition-colors cursor-pointer">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">{p.name}</p>
                    <Badge variant="outline" className="text-xs capitalize">{p.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{p.description}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </section>
      )}

      {!loading && query.trim() && showPeople && people.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5"><User className="h-4 w-4" /> People</h2>
          {people.map((p) => (
            <Link key={p.id} href={`/app/profile/${p.username}`}>
              <Card className="border-border/60 hover:border-primary/30 transition-colors cursor-pointer">
                <CardContent className="flex items-center gap-3 p-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">{initials(p.username)}</div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{p.username}</p>
                    {p.bio && <p className="text-xs text-muted-foreground line-clamp-1">{p.bio}</p>}
                  </div>
                  {p.verification_status === 'verified' && <Badge className="gap-1 bg-success/10 text-success text-xs">Verified</Badge>}
                </CardContent>
              </Card>
            </Link>
          ))}
        </section>
      )}

      {!loading && query.trim() && communities.length === 0 && projects.length === 0 && people.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Search className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">No results found for &quot;{query}&quot;</p>
          </CardContent>
        </Card>
      )}

      {!query.trim() && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Search className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">Start typing to search across communities, projects, and people.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
