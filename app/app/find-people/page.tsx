'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Users, Sparkles } from 'lucide-react';
import type { Profile } from '@/lib/types';
import { initials } from '@/lib/helpers';

const INTEREST_OPTIONS = ['Programming', 'Anime', 'Gaming', 'Music', 'Art', 'Science', 'Books', 'Sports', 'Writing', 'Photography', 'Languages', 'Math'];
const SKILL_OPTIONS = ['React', 'Python', 'Design', 'Writing', 'Video Editing', 'Marketing', 'Research', 'Public Speaking'];

export default function FindPeoplePage() {
  const [people, setPeople] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);

  useEffect(() => {
    supabase.from('profiles').select('*').limit(20).then(({ data }) => {
      setPeople((data as Profile[]) ?? []);
      setLoading(false);
    });
  }, []);

  const toggleInterest = (i: string) => {
    setSelectedInterests((prev) => prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]);
  };
  const toggleSkill = (s: string) => {
    setSelectedSkills((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  };

  const filtered = people.filter((p) => {
    if (selectedInterests.length > 0 && !selectedInterests.some((i) => p.interests.includes(i))) return false;
    if (selectedSkills.length > 0 && !selectedSkills.some((s) => p.skills.includes(s))) return false;
    return true;
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Find Your People</h1>
        <p className="text-muted-foreground mt-1">Connect with students who share your interests and goals. This is for finding study buddies and project teammates — not dating.</p>
      </div>

      <Card className="border-border/60">
        <CardContent className="p-5 space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">Interests</p>
            <div className="flex flex-wrap gap-2">
              {INTEREST_OPTIONS.map((i) => (
                <button key={i} onClick={() => toggleInterest(i)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedInterests.includes(i) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
                  {i}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium mb-2">Skills</p>
            <div className="flex flex-wrap gap-2">
              {SKILL_OPTIONS.map((s) => (
                <button key={s} onClick={() => toggleSkill(s)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedSkills.includes(s) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[1, 2, 3, 4].map((i) => <div key={i} className="h-24 rounded-2xl animate-shimmer" />)}</div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">No people found matching your filters.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((p) => {
            const sharedInterests = p.interests.filter((i) => selectedInterests.includes(i));
            const matchScore = selectedInterests.length > 0 ? Math.round((sharedInterests.length / selectedInterests.length) * 100) : 0;
            return (
              <Link key={p.id} href={`/app/profile/${p.username}`}>
                <Card className="border-border/60 hover:border-primary/30 transition-colors cursor-pointer">
                  <CardContent className="flex items-start gap-3 p-4">
                    <Avatar className="h-12 w-12 shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">{initials(p.username)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{p.username}</p>
                        {p.verification_status === 'verified' && <Badge className="gap-1 bg-success/10 text-success text-xs">Verified</Badge>}
                      </div>
                      {p.bio && <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{p.bio}</p>}
                      {p.interests.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {p.interests.slice(0, 3).map((i) => <Badge key={i} variant="secondary" className="text-xs">{i}</Badge>)}
                        </div>
                      )}
                      {matchScore > 0 && (
                        <p className="text-xs text-primary font-medium mt-2 flex items-center gap-1">
                          <Sparkles className="h-3 w-3" /> {matchScore}% interests match
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
