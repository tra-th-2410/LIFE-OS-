'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Target, Trophy, Bot, BookOpen, TrendingUp, ArrowRight, Sparkles, Heart } from 'lucide-react';
import { formatRelativeTime } from '@/lib/helpers';
import { useLanguage } from '@/components/language-provider';
import type { Community, Challenge, Project } from '@/lib/types';

export default function AppHomePage() {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from('communities').select('*').is('archived_at', null).order('members_count', { ascending: false }).limit(6),
      supabase.from('challenges').select('*').limit(4),
      supabase.from('projects').select('*').eq('status', 'recruiting').limit(4),
    ]).then(([cRes, chRes, pRes]) => {
      setCommunities((cRes.data as Community[]) ?? []);
      setChallenges((chRes.data as Challenge[]) ?? []);
      setProjects((pRes.data as Project[]) ?? []);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-48 rounded-2xl animate-shimmer" />
        ))}
      </div>
    );
  }

  const hour = new Date().getHours();
  const greeting = t(hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening');

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">
            {greeting}, {profile?.username ?? t('there')}!
          </h1>
          <p className="text-muted-foreground mt-1">Here&apos;s what&apos;s happening in your world today.</p>
        </div>
        {profile && (
          <div className="flex items-center gap-2">
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
              <Link href="/app/settings">
                <Badge variant="outline" className="gap-1 cursor-pointer hover:bg-muted">
                  Basic Account
                </Badge>
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={BookOpen} label={t('Study')} value={t('0 goals')} href="/app/study" color="text-blue-500" bg="bg-blue-500/10" />
        <StatCard icon={Users} label={t('Communities')} value={`${communities.length} ${t('joined')}`} href="/app/community" color="text-teal-500" bg="bg-teal-500/10" />
        <StatCard icon={Target} label={t('Projects')} value={`${projects.length} ${t('active')}`} href="/app/projects" color="text-green-500" bg="bg-green-500/10" />
        <StatCard icon={Trophy} label={t('Streak')} value={t('0 days')} href="/app/my-life" color="text-amber-500" bg="bg-amber-500/10" />
      </div>

      {/* AI Assistant quick access */}
      <Card className="border-border/60 overflow-hidden">
        <CardContent className="p-0">
          <div className="flex flex-col md:flex-row items-stretch">
            <div className="flex-1 p-6">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-xl">🌟</div>
                <div>
                  <h3 className="font-semibold">AI Assistant</h3>
                  <p className="text-sm text-muted-foreground">Your personal growth companions</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-3">
                Get help with homework, set goals, write in your private journal, or just chat. All AI assistants are transparent and safe.
              </p>
              <Link href="/app/ai">
                <Button className="mt-4 gap-1.5" size="sm">
                  Open AI Center <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-2 p-4 md:w-64 md:border-l border-border/60">
              {[
                { icon: '📚', name: 'Study Buddy', bot: 'study' },
                { icon: '🎯', name: 'Life Coach', bot: 'life_coach' },
                { icon: '📔', name: 'Journal', bot: 'journal' },
                { icon: '🌟', name: 'Companion', bot: 'companion' },
              ].map((b) => (
                <Link key={b.bot} href={`/app/ai/${b.bot}`}>
                  <div className="flex flex-col items-center gap-1 rounded-lg p-3 hover:bg-muted transition-colors cursor-pointer">
                    <span className="text-2xl">{b.icon}</span>
                    <span className="text-xs font-medium">{b.name}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Featured Communities */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-display font-bold">Featured Communities</h2>
          <Link href="/app/community">
            <Button variant="ghost" size="sm" className="gap-1">View all <ArrowRight className="h-3.5 w-3.5" /></Button>
          </Link>
        </div>
        {communities.length === 0 ? (
          <EmptyState icon={Users} text="No communities yet" />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {communities.map((c) => (
              <Link key={c.id} href={`/app/community/${c.slug}`}>
                <Card className="group cursor-pointer border-border/60 hover:border-primary/40 hover:shadow-md transition-all duration-300 h-full">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-2xl">{c.icon}</span>
                      <Badge variant="outline" className="text-xs">{c.members_count.toLocaleString()}</Badge>
                    </div>
                    <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">{c.name}</h3>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{c.description}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Active Challenges */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-display font-bold">Active Challenges</h2>
          <Link href="/app/study">
            <Button variant="ghost" size="sm" className="gap-1">View all <ArrowRight className="h-3.5 w-3.5" /></Button>
          </Link>
        </div>
        {challenges.length === 0 ? (
          <EmptyState icon={Trophy} text="No challenges yet" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {challenges.map((ch) => (
              <Link key={ch.id} href="/app/study">
                <Card className="group cursor-pointer border-border/60 hover:border-primary/40 hover:shadow-md transition-all duration-300 h-full">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-2xl">{ch.icon}</span>
                      <Badge variant="outline" className="text-xs gap-1"><Trophy className="h-3 w-3" />{ch.duration_days}d</Badge>
                    </div>
                    <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">{ch.title}</h3>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{ch.description}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{ch.participants_count} {t('joined')}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Recruiting Projects */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-display font-bold">Projects Looking for Members</h2>
          <Link href="/app/projects">
            <Button variant="ghost" size="sm" className="gap-1">View all <ArrowRight className="h-3.5 w-3.5" /></Button>
          </Link>
        </div>
        {projects.length === 0 ? (
          <EmptyState icon={Target} text="No recruiting projects yet" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.map((p) => (
              <Link key={p.id} href={`/app/projects/${p.id}`}>
                <Card className="group cursor-pointer border-border/60 hover:border-primary/40 hover:shadow-md transition-all duration-300 h-full">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold group-hover:text-primary transition-colors">{p.name}</h3>
                      <Badge variant="outline" className="text-xs">{p.members_count} {t('members')}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{p.description}</p>
                    {p.roles_needed.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {p.roles_needed.slice(0, 3).map((r) => (
                          <Badge key={r} variant="secondary" className="text-xs">{r}</Badge>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-3">
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-primary to-chart-2" style={{ width: `${p.progress}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground">{p.progress}%</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, href, color, bg }: { icon: React.ElementType; label: string; value: string; href: string; color: string; bg: string }) {
  return (
    <Link href={href}>
      <Card className="border-border/60 hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer">
        <CardContent className="p-4">
          <div className={`mb-2 flex h-9 w-9 items-center justify-center rounded-lg ${bg}`}>
            <Icon className={`h-4.5 w-4.5 ${color}`} />
          </div>
          <p className="text-lg font-bold font-display">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

function EmptyState({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <Card className="border-dashed border-border/60">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <Icon className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">{text}</p>
      </CardContent>
    </Card>
  );
}
