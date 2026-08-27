'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { ArrowLeft, Users, Plus, Loader2, Check, Circle, Clock, ListChecks, Pencil, Trash2 } from 'lucide-react';
import type { Project, ProjectTask, Profile, TaskStatus } from '@/lib/types';
import { initials } from '@/lib/helpers';
import { toast } from 'sonner';

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const { user } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<(ProjectTask & { assignee?: Profile | null })[]>([]);
  const [members, setMembers] = useState<(Profile & { role: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMember, setIsMember] = useState(false);
  const [newTask, setNewTask] = useState('');
  const [addingTask, setAddingTask] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isOwner = user?.id === project?.owner_id;

  const loadData = useCallback(async () => {
    const { data: p } = await supabase.from('projects').select('*').eq('id', projectId).maybeSingle();
    setProject(p as Project | null);

    const { data: t } = await supabase
      .from('project_tasks')
      .select('*, assignee:profiles!project_tasks_assignee_id_fkey(username, avatar_url, id)')
      .eq('project_id', projectId)
      .order('order', { ascending: true });
    setTasks((t as (ProjectTask & { assignee?: Profile | null })[]) ?? []);

    const { data: m } = await supabase
      .from('project_members')
      .select('role, profile:profiles!project_members_user_id_fkey(username, avatar_url, id, bio)')
      .eq('project_id', projectId);
    const memberList = ((m ?? []) as unknown as { role: string; profile: Profile }[]).map((r) => ({ ...r.profile, role: r.role }));
    setMembers(memberList);

    if (user) {
      setIsMember(memberList.some((m) => m.id === user.id));
    }
    setLoading(false);
  }, [projectId, user]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleJoin = async () => {
    if (!user || !project) return;
    try {
      await supabase.from('project_members').insert({ project_id: project.id, user_id: user.id, role: 'Member' });
      await supabase.from('projects').update({ members_count: project.members_count + 1 }).eq('id', project.id);
      setIsMember(true);
      setProject({ ...project, members_count: project.members_count + 1 });
      toast.success('Joined project!');
      loadData();
    } catch {
      toast.error('Failed to join');
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !project || !isMember || !newTask.trim()) return;
    setAddingTask(true);
    try {
      const { data, error } = await supabase
        .from('project_tasks')
        .insert({ project_id: project.id, title: newTask, order: tasks.length })
        .select('*, assignee:profiles!project_tasks_assignee_id_fkey(username, avatar_url, id)')
        .single();
      if (error) throw error;
      setTasks([...tasks, data as ProjectTask & { assignee?: Profile | null }]);
      setNewTask('');
      toast.success('Task added');
    } catch {
      toast.error('Failed to add task');
    } finally {
      setAddingTask(false);
    }
  };

  const handleToggleTask = async (taskId: string, currentStatus: TaskStatus) => {
    const newStatus: TaskStatus = currentStatus === 'done' ? 'todo' : currentStatus === 'todo' ? 'in_progress' : 'done';
    await supabase.from('project_tasks').update({ status: newStatus }).eq('id', taskId);
    setTasks(tasks.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));
    const doneCount = tasks.filter((t) => (t.id !== taskId ? t.status === 'done' : newStatus === 'done')).length;
    const progress = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0;
    if (project) {
      await supabase.from('projects').update({ progress }).eq('id', project.id);
      setProject({ ...project, progress });
    }
  };

  const handleDeleteProject = async () => {
    if (!user || !project) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', project.id)
        .eq('owner_id', user.id);
      if (error) throw error;
      toast.success('Project deleted');
      router.push('/app/projects');
    } catch {
      toast.error('Failed to delete project');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="h-32 rounded-2xl animate-shimmer" />
        <div className="h-64 rounded-2xl animate-shimmer" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <p className="text-lg font-medium">Project not found</p>
        <Link href="/app/projects" className="mt-4 inline-block">
          <Button variant="outline">Back to Projects</Button>
        </Link>
      </div>
    );
  }

  const statusIcon = (status: TaskStatus) => {
    if (status === 'done') return <Check className="h-4 w-4 text-success" />;
    if (status === 'in_progress') return <Clock className="h-4 w-4 text-warning" />;
    return <Circle className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link href="/app/projects" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Projects
      </Link>

      <Card className="border-border/60">
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-display font-bold">{project.name}</h1>
                <Badge variant="outline" className="capitalize">{project.status}</Badge>
              </div>
              <p className="mt-2 text-muted-foreground">{project.description}</p>
              <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5"><Users className="h-4 w-4" /> {project.members_count} members</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {user && !isMember && (
                <Button onClick={handleJoin} className="gap-1.5">Join Project</Button>
              )}
              {isOwner && (
                <>
                  <Button size="sm" variant="ghost" onClick={() => setShowEdit(true)} className="gap-1.5">
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowDelete(true)} className="gap-1.5 text-destructive hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </Button>
                </>
              )}
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-primary to-chart-2 transition-all duration-500" style={{ width: `${project.progress}%` }} />
            </div>
            <span className="text-sm font-medium text-muted-foreground">{project.progress}%</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-2">
            <ListChecks className="h-5 w-5" />
            <h2 className="text-lg font-display font-bold">Tasks</h2>
          </div>

          {isMember && (
            <form onSubmit={handleAddTask} className="flex gap-2">
              <Input value={newTask} onChange={(e) => setNewTask(e.target.value)} placeholder="Add a task..." />
              <Button type="submit" size="icon" disabled={addingTask || !newTask.trim()}>
                {addingTask ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            </form>
          )}

          {tasks.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <ListChecks className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">No tasks yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {tasks.map((t) => (
                <Card key={t.id} className="border-border/60">
                  <CardContent className="flex items-center gap-3 p-3">
                    <button
                      onClick={() => isMember && handleToggleTask(t.id, t.status)}
                      className={`p-1 rounded hover:bg-muted transition-colors ${!isMember ? 'cursor-default' : 'cursor-pointer'}`}
                    >
                      {statusIcon(t.status)}
                    </button>
                    <span className={`flex-1 text-sm ${t.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                      {t.title}
                    </span>
                    {t.assignee && (
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-[10px]">{initials(t.assignee.username)}</AvatarFallback>
                      </Avatar>
                    )}
                    {t.priority === 'high' && <Badge variant="outline" className="text-xs">High</Badge>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <h2 className="text-lg font-display font-bold">Members</h2>
          </div>
          <div className="space-y-2">
            {members.map((m) => (
              <Card key={m.id} className="border-border/60">
                <CardContent className="flex items-center gap-3 p-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials(m.username)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.username}</p>
                    <p className="text-xs text-muted-foreground">{m.role}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {project.roles_needed.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Looking for:</p>
              <div className="flex flex-wrap gap-1.5">
                {project.roles_needed.map((r) => (
                  <Badge key={r} variant="secondary" className="text-xs">{r}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {showEdit && project && (
        <EditProjectDialog project={project} onOpenChange={setShowEdit} onUpdated={(updated) => setProject(updated)} />
      )}

      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this project?</DialogTitle>
            <DialogDescription>
              This will permanently delete the project and all its tasks. Member associations will be removed. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button variant="destructive" onClick={handleDeleteProject} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditProjectDialog({
  project,
  onOpenChange,
  onUpdated,
}: {
  project: Project;
  onOpenChange: (v: boolean) => void;
  onUpdated: (p: Project) => void;
}) {
  const { user } = useAuth();
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [status, setStatus] = useState(project.status);
  const [roles, setRoles] = useState(project.roles_needed.join(', '));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const rolesArray = roles.split(',').map((r) => r.trim()).filter(Boolean);
      const { data, error } = await supabase
        .from('projects')
        .update({ name: name.trim(), description: description.trim(), status, roles_needed: rolesArray })
        .eq('id', project.id)
        .eq('owner_id', user.id)
        .select('*')
        .single();
      if (error) throw error;
      onUpdated(data as Project);
      onOpenChange(false);
      toast.success('Project updated');
    } catch {
      toast.error('Failed to update project');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Edit Project</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="p-name">Name</Label>
            <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-desc">Description</Label>
            <Textarea id="p-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-status">Status</Label>
            <select id="p-status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="recruiting">Recruiting</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="on_hold">On Hold</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-roles">Roles needed (comma-separated)</Label>
            <Input id="p-roles" value={roles} onChange={(e) => setRoles(e.target.value)} placeholder="Developer, Designer" />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
