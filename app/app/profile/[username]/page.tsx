'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ArrowLeft, Loader2, Sparkles, Shield, MapPin, Target, BookOpen, Check, Edit, Save } from 'lucide-react';
import type { Profile, Project, Community } from '@/lib/types';
import { initials } from '@/lib/helpers';
import { toast } from 'sonner';

export default function ProfilePage() {
  const params = useParams();
  const username = params.username as string;
  const { user, profile: ownProfile, refreshProfile } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwn, setIsOwn] = useState(false);
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState('');
  const [interests, setInterests] = useState('');
  const [skills, setSkills] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data: p } = await supabase.from('profiles').select('*').eq('username', username).maybeSingle();
    setProfile(p as Profile | null);
    if (p) {
      setBio(p.bio ?? '');
      setInterests(p.interests.join(', '));
      setSkills(p.skills.join(', '));
      setIsOwn(user?.id === p.id);

      const { data: projs } = await supabase.from('projects').select('*').or(`owner_id.eq.${p.id}`).limit(5);
      setProjects((projs as Project[]) ?? []);

      const { data: cm } = await supabase
        .from('community_members')
        .select('community:communities(*)')
        .eq('user_id', p.id);
      setCommunities(((cm ?? []) as unknown as { community: Community }[]).map((r) => r.community));
    }
    setLoading(false);
  }, [username, user]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!user || !profile) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({
        bio,
        interests: interests.split(',').map((s) => s.trim()).filter(Boolean),
        skills: skills.split(',').map((s) => s.trim()).filter(Boolean),
      }).eq('id', user.id);
      if (error) throw error;
      await refreshProfile();
      setProfile({ ...profile, bio, interests: interests.split(',').map((s) => s.trim()).filter(Boolean), skills: skills.split(',').map((s) => s.trim()).filter(Boolean) });
      setEditing(false);
      toast.success('Profile updated!');
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="max-w-3xl mx-auto space-y-4">{[1, 2].map((i) => <div key={i} className="h-48 rounded-2xl animate-shimmer" />)}</div>;
  }

  if (!profile) {
    return (
      <div className="max-w-3xl mx-auto text-center py-20">
        <p className="text-lg font-medium">Profile not found</p>
        <Link href="/app" className="mt-4 inline-block"><Button variant="outline">Go Home</Button></Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link href="/app" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      {/* Profile header */}
      <Card className="border-border/60">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start gap-4">
            <Avatar className="h-20 w-20 shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">{initials(profile.username)}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-display font-bold">{profile.username}</h1>
                {profile.verification_status === 'verified' && (
                  <Badge className="gap-1 bg-success/10 text-success border-success/20">
                    <Sparkles className="h-3 w-3" /> Verified Student
                  </Badge>
                )}
                {profile.verification_status === 'pending' && (
                  <Badge className="gap-1 bg-warning/10 text-warning border-warning/20">
                    Verification Pending
                  </Badge>
                )}
                {profile.verification_status === 'basic' && (
                  <Badge variant="outline">Basic Account</Badge>
                )}
              </div>
              {profile.bio && <p className="mt-2 text-muted-foreground">{profile.bio}</p>}
              {profile.country && (
                <p className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" /> {profile.country}{profile.province ? `, ${profile.province}` : ''}
                </p>
              )}
              {isOwn && !editing && (
                <Button onClick={() => setEditing(true)} variant="outline" size="sm" className="mt-3 gap-1.5">
                  <Edit className="h-3.5 w-3.5" /> Edit Profile
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit mode */}
      {isOwn && editing && (
        <Card className="border-border/60">
          <CardContent className="p-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="bio">Bio</Label>
              <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell others about yourself..." rows={3} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="interests">Interests (comma-separated)</Label>
              <Input id="interests" value={interests} onChange={(e) => setInterests(e.target.value)} placeholder="Programming, Anime, Music" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="skills">Skills (comma-separated)</Label>
              <Input id="skills" value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="React, Design, Writing" />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
              </Button>
              <Button onClick={() => setEditing(false)} variant="outline" size="sm">Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Interests & Skills */}
      {!editing && (profile.interests.length > 0 || profile.skills.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {profile.interests.length > 0 && (
            <Card className="border-border/60">
              <CardContent className="p-4">
                <h3 className="text-sm font-medium mb-2 flex items-center gap-1.5"><Target className="h-4 w-4" /> Interests</h3>
                <div className="flex flex-wrap gap-1.5">
                  {profile.interests.map((i) => <Badge key={i} variant="secondary" className="text-xs">{i}</Badge>)}
                </div>
              </CardContent>
            </Card>
          )}
          {profile.skills.length > 0 && (
            <Card className="border-border/60">
              <CardContent className="p-4">
                <h3 className="text-sm font-medium mb-2 flex items-center gap-1.5"><BookOpen className="h-4 w-4" /> Skills</h3>
                <div className="flex flex-wrap gap-1.5">
                  {profile.skills.map((s) => <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>)}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Projects */}
      {projects.length > 0 && (
        <div>
          <h2 className="text-lg font-display font-bold mb-3">Projects</h2>
          <div className="space-y-2">
            {projects.map((p) => (
              <Link key={p.id} href={`/app/projects/${p.id}`}>
                <Card className="border-border/60 hover:border-primary/30 transition-colors cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-sm">{p.name}</h3>
                      <Badge variant="outline" className="text-xs capitalize">{p.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{p.description}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Communities */}
      {communities.length > 0 && (
        <div>
          <h2 className="text-lg font-display font-bold mb-3">Communities</h2>
          <div className="flex flex-wrap gap-2">
            {communities.map((c) => (
              <Link key={c.id} href={`/app/community/${c.slug}`}>
                <Badge variant="outline" className="cursor-pointer hover:bg-muted gap-1.5">
                  {c.icon} {c.name}
                </Badge>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Privacy notice */}
      <Card className="border-border/60 bg-muted/30">
        <CardContent className="p-4 flex items-start gap-2">
          <Shield className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            Personal information like date of birth, school email, and student ID are never shown publicly.
            Only your username, bio, interests, skills, and verification badge are visible to others.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
