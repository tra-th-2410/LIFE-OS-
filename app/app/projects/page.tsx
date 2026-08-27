'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Target, Plus, Search, Users, Zap, Loader2, ArrowRight } from 'lucide-react';
import type { Project } from '@/lib/types';
import { toast } from 'sonner';

export default function ProjectsPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [filtered, setFiltered] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newRoles, setNewRoles] = useState('');

  useEffect(() => {
    supabase.from('projects').select('*').order('created_at', { ascending: false }).then(({ data }) => {
      const p = (data as Project[]) ?? [];
      setProjects(p);
      setFiltered(p);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(projects.filter((p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)));
  }, [search, projects]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setCreating(true);
    try {
      const roles = newRoles.split(',').map((r) => r.trim()).filter(Boolean);
      const { data, error } = await supabase
        .from('projects')
        .insert({
          name: newName,
          description: newDesc,
          owner_id: user.id,
          status: 'recruiting',
          roles_needed: roles,
          tags: [],
        })
        .select()
        .single();
      if (error) throw error;
      await supabase.from('project_members').insert({ project_id: data.id, user_id: user.id, role: 'Owner' });
      setProjects([data as Project, ...projects]);
      setFiltered([data as Project, ...filtered]);
      setNewName('');
      setNewDesc('');
      setNewRoles('');
      setShowCreate(false);
      toast.success('Project created!');
    } catch {
      toast.error('Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Projects</h1>
          <p className="text-muted-foreground mt-1">Build real things together. Find teammates and ship products.</p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)} className="gap-1.5">
          <Plus className="h-4 w-4" /> {showCreate ? 'Cancel' : 'Create Project'}
        </Button>
      </div>

      {showCreate && (
        <Card className="border-border/60">
          <CardContent className="p-5">
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="pname">Project name</Label>
                <Input id="pname" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. English Learning Website" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pdesc">Description</Label>
                <Textarea id="pdesc" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="What are you building?" required rows={3} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="proles">Roles needed (comma-separated)</Label>
                <Input id="proles" value={newRoles} onChange={(e) => setNewRoles(e.target.value)} placeholder="Developer, Designer, Writer" />
              </div>
              <Button type="submit" disabled={creating}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Project'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search projects..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 max-w-md" />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-40 rounded-2xl animate-shimmer" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Target className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">No projects yet. Create one to get started!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((p) => (
            <Link key={p.id} href={`/app/projects/${p.id}`}>
              <Card className="group cursor-pointer border-border/60 hover:border-primary/40 hover:shadow-lg transition-all duration-300 h-full">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="font-semibold group-hover:text-primary transition-colors">{p.name}</h3>
                    <Badge variant="outline" className="shrink-0 capitalize">{p.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{p.description}</p>
                  {p.roles_needed.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {p.roles_needed.map((r) => (
                        <Badge key={r} variant="secondary" className="text-xs gap-1">
                          <Zap className="h-2.5 w-2.5" /> {r}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="mt-4 flex items-center gap-3">
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-primary to-chart-2" style={{ width: `${p.progress}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground">{p.progress}%</span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="h-3.5 w-3.5" /> {p.members_count}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
