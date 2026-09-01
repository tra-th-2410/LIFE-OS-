'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Sparkles,
  Users,
  Target,
  BookOpen,
  Heart,
  Shield,
  Zap,
  MessageSquare,
  Trophy,
  Bot,
  Lock,
  Eye,
  TrendingUp,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LanguageSwitcher } from '@/components/language-switcher';

const featuredCommunities = [
  { name: 'Programming', icon: '💻', members: '12.4k', color: 'blue', desc: 'Learn to code, share projects, debug together' },
  { name: 'Anime & Manga', icon: '🎌', members: '8.7k', color: 'rose', desc: 'Discuss your favorite series and characters' },
  { name: 'Gaming', icon: '🎮', members: '15.2k', color: 'purple', desc: 'Find teammates, share clips, discuss games' },
  { name: 'Music', icon: '🎵', members: '6.3k', color: 'amber', desc: 'Discover new artists, share your playlists' },
  { name: 'Art & Design', icon: '🎨', members: '4.8k', color: 'orange', desc: 'Show your work, get feedback, learn techniques' },
  { name: 'Science', icon: '🔬', members: '5.1k', color: 'teal', desc: 'Explore the wonders of the natural world' },
  { name: 'Books', icon: '📚', members: '3.2k', color: 'green', desc: 'Book clubs, reviews, and reading challenges' },
  { name: 'Heart to Heart', icon: '💬', members: '7.9k', color: 'cyan', desc: 'Anonymous space to share and support' },
];

const activeChallenges = [
  { title: '7-Day English Challenge', desc: 'Learn 10 new words every day for a week', icon: '🌍', participants: 342, duration: 7, color: 'blue' },
  { title: '30-Day Reading Challenge', desc: 'Read 20 minutes daily for a month', icon: '📖', participants: 891, duration: 30, color: 'amber' },
  { title: 'Coding Challenge', desc: 'Solve one problem every day', icon: '⚡', participants: 527, duration: 14, color: 'purple' },
  { title: 'Exercise Challenge', desc: '15 minutes of movement daily', icon: '🏃', participants: 438, duration: 21, color: 'green' },
];

const recruitingProjects = [
  { name: 'English Learning Website for Students', desc: 'Building an interactive platform to help Vietnamese students practice English.', roles: ['Developer', 'Designer', 'Content Writer'], progress: 35, members: 3 },
  { name: 'Mental Health App for Teens', desc: 'A simple mood tracker with AI-powered reflections and crisis resources.', roles: ['Developer', 'Researcher', 'Marketing'], progress: 60, members: 4 },
  { name: 'Student Recipe Sharing Platform', desc: 'A community-driven app for budget-friendly student meals.', roles: ['Developer', 'Designer', 'Video Editor'], progress: 15, members: 2 },
  { name: 'Open Source Study Timer', desc: 'A Pomodoro timer with analytics and social accountability.', roles: ['Developer', 'Writer'], progress: 80, members: 5 },
];

const aiBots = [
  { name: 'AI Study Buddy', icon: '📚', desc: 'Solve problems, understand concepts, plan your study', color: 'blue' },
  { name: 'AI Life Coach', icon: '🎯', desc: 'Set goals, build habits, track your progress', color: 'green' },
  { name: 'AI Journal', icon: '📔', desc: 'Private reflections with emotional pattern insights', color: 'purple' },
  { name: 'AI Companion', icon: '🌟', desc: 'Open conversation with a transparent AI friend', color: 'amber' },
];

const values = [
  { icon: Shield, title: 'Safety First', desc: 'AI moderation, age-appropriate design, and privacy-by-default for every user.' },
  { icon: Heart, title: 'No Vanity Metrics', desc: 'No follower counts. No like-chasing. Just real growth and real connections.' },
  { icon: Target, title: 'Goal-Oriented', desc: 'Built around learning, projects, and personal development — not endless scrolling.' },
  { icon: Users, title: 'Small Communities', desc: 'Find your people through shared interests, not algorithmic feeds.' },
];

const stats = [
  { value: '50K+', label: 'Active Students' },
  { value: '120+', label: 'Communities' },
  { value: '2.4K', label: 'Projects Built' },
  { value: '89%', label: 'Feel More Motivated' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-lg">
                L
              </div>
              <span className="font-display text-xl font-bold tracking-tight">Life OS</span>
            </div>
            <div className="hidden items-center gap-6 md:flex">
              <Link href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Features
              </Link>
              <Link href="#communities" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Communities
              </Link>
              <Link href="/app/forum" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Forum
              </Link>
              <Link href="#challenges" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Challenges
              </Link>
              <Link href="#projects" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Projects
              </Link>
              <Link href="#ai" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                AI Center
              </Link>
            </div>
            <div className="flex items-center gap-2">
              <LanguageSwitcher />
              <Link href="/login">
                <Button variant="ghost" size="sm">Log in</Button>
              </Link>
              <Link href="/signup">
                <Button size="sm" className="gap-1">
                  Get Started <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-[0.03]" />
        <div className="absolute -top-40 right-0 h-[500px] w-[500px] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute -bottom-40 -left-20 h-[400px] w-[400px] rounded-full bg-chart-2/10 blur-[100px]" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-20 pb-24 lg:pt-28 lg:pb-32">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="outline" className="mb-6 gap-1.5 py-1.5 px-3 border-primary/30 bg-primary/5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-medium">A Social OS built for young learners</span>
            </Badge>
            <h1 className="font-display text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              Learn. Connect. Build.
              <span className="block bg-gradient-to-r from-primary via-chart-2 to-chart-4 bg-clip-text text-transparent">
                Grow into who you want to be.
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground text-balance leading-relaxed">
              Life OS is a safe space for students and young people to study together, build real
              projects, join communities that matter, and understand themselves — without the
              toxicity and addiction of traditional social media.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/signup">
                <Button size="lg" className="w-full sm:w-auto gap-2 text-base h-12 px-8">
                  Join Life OS Free <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="#features">
                <Button variant="outline" size="lg" className="w-full sm:w-auto text-base h-12 px-8">
                  Explore Features
                </Button>
              </Link>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Free forever for students. No ads. No data selling. No infinite scroll.
            </p>
          </div>

          {/* Hero visual */}
          <div className="mx-auto mt-16 max-w-5xl">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: BookOpen, label: 'Study', value: '12 topics', color: 'text-blue-500', bg: 'bg-blue-500/10' },
                { icon: Users, label: 'Communities', value: '8 joined', color: 'text-teal-500', bg: 'bg-teal-500/10' },
                { icon: Target, label: 'Goals', value: '3 active', color: 'text-green-500', bg: 'bg-green-500/10' },
                { icon: Trophy, label: 'Streak', value: '14 days', color: 'text-amber-500', bg: 'bg-amber-500/10' },
              ].map((item, i) => (
                <div
                  key={item.label}
                  className="animate-fade-in rounded-2xl border border-border/60 bg-card p-5 shadow-sm"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${item.bg}`}>
                    <item.icon className={`h-5 w-5 ${item.color}`} />
                  </div>
                  <p className="text-2xl font-bold font-display">{item.value}</p>
                  <p className="text-sm text-muted-foreground">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-border/60 bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="font-display text-3xl font-bold text-primary">{stat.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values / Anti-social-media design */}
      <section id="features" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
        <div className="mx-auto max-w-2xl text-center mb-12">
          <Badge variant="secondary" className="mb-3">Why Life OS</Badge>
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl text-balance">
            Not another social media trap
          </h2>
          <p className="mt-4 text-muted-foreground text-balance">
            We designed Life OS to be the opposite of addictive platforms. No follower counts,
            no like-chasing, no infinite scroll. Just tools that help you grow.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {values.map((value) => (
            <Card key={value.title} className="border-border/60 hover:border-primary/30 hover:shadow-md transition-all duration-300">
              <CardHeader>
                <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                  <value.icon className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-lg">{value.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">{value.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Featured Communities */}
      <section id="communities" className="bg-muted/30 border-y border-border/60 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-10">
            <div>
              <Badge variant="secondary" className="mb-3">Communities</Badge>
              <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
                Find your people
              </h2>
              <p className="mt-2 text-muted-foreground">Join communities that match your interests and passions.</p>
            </div>
            <Link href="/signup" className="hidden md:block">
              <Button variant="outline" className="gap-1.5">
                Browse all <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {featuredCommunities.map((c, i) => (
              <Link href="/signup" key={c.name}>
                <Card
                  className="group cursor-pointer border-border/60 hover:border-primary/40 hover:shadow-lg transition-all duration-300 animate-fade-in h-full"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <span className="text-3xl">{c.icon}</span>
                      <Badge variant="outline" className="text-xs">{c.members}</Badge>
                    </div>
                    <h3 className="font-semibold text-base group-hover:text-primary transition-colors">{c.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{c.desc}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Challenges */}
      <section id="challenges" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
        <div className="mx-auto max-w-2xl text-center mb-12">
          <Badge variant="secondary" className="mb-3">Challenges</Badge>
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl text-balance">
            Grow with friendly challenges
          </h2>
          <p className="mt-4 text-muted-foreground text-balance">
            Join challenges that motivate you to build habits — without toxic competition.
            Track streaks, earn achievements, and celebrate progress together.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {activeChallenges.map((ch, i) => (
            <Card
              key={ch.title}
              className="group border-border/60 hover:border-primary/40 hover:shadow-lg transition-all duration-300 animate-fade-in"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <span className="text-3xl">{ch.icon}</span>
                  <Badge variant="outline" className="gap-1">
                    <Trophy className="h-3 w-3" /> {ch.duration}d
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <h3 className="font-semibold">{ch.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{ch.desc}</p>
                <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" /> {ch.participants} joined
                  </span>
                  <span className="flex items-center gap-1 text-primary font-medium">
                    Join <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Projects */}
      <section id="projects" className="bg-muted/30 border-y border-border/60 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-12">
            <Badge variant="secondary" className="mb-3">Project Hub</Badge>
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl text-balance">
              Build real things, together
            </h2>
            <p className="mt-4 text-muted-foreground text-balance">
              Create projects, recruit team members with the skills you need, and ship products
              with built-in task management and AI assistance.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {recruitingProjects.map((p, i) => (
              <Card
                key={p.name}
                className="group border-border/60 hover:border-primary/40 hover:shadow-lg transition-all duration-300 animate-fade-in"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">{p.name}</h3>
                    <Badge variant="outline" className="shrink-0">
                      {p.members} members
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">{p.desc}</p>
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {p.roles.map((role) => (
                      <Badge key={role} variant="secondary" className="text-xs gap-1">
                        <Zap className="h-2.5 w-2.5" /> {role}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary to-chart-2 transition-all duration-500"
                        style={{ width: `${p.progress}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground w-10 text-right">{p.progress}%</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* AI Center */}
      <section id="ai" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
        <div className="mx-auto max-w-2xl text-center mb-12">
          <Badge variant="secondary" className="mb-3 gap-1">
            <Bot className="h-3.5 w-3.5" /> AI Center
          </Badge>
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl text-balance">
            AI that actually helps you grow
          </h2>
          <p className="mt-4 text-muted-foreground text-balance">
            Four specialized AI assistants — for studying, goal-setting, journaling, and
            companionship. Always transparent. Always safe. Never pretending to be human.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {aiBots.map((bot, i) => (
            <Card
              key={bot.name}
              className="group border-border/60 hover:border-primary/40 hover:shadow-lg transition-all duration-300 animate-fade-in"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <CardContent className="p-6">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-3xl">
                  {bot.icon}
                </div>
                <h3 className="font-semibold text-lg mb-1">{bot.name}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{bot.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Privacy & Safety */}
      <section className="bg-muted/30 border-y border-border/60 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <Badge variant="secondary" className="mb-3 gap-1">
                <Shield className="h-3.5 w-3.5" /> Privacy & Safety
              </Badge>
              <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl text-balance mb-6">
                Built for students, designed for safety
              </h2>
              <div className="space-y-4">
                {[
                  { icon: Lock, text: 'Journal entries are private by default — no one sees them but you' },
                  { icon: Eye, text: 'No ads based on your sensitive data. Ever.' },
                  { icon: Shield, text: 'AI moderation detects cyberbullying, hate speech, and dangerous content' },
                  { icon: Heart, text: 'AI safety protocol activates when someone shows signs of distress' },
                  { icon: TrendingUp, text: 'No infinite scroll. No engagement-optimized feed. Just what matters.' },
                  { icon: Check, text: 'Data export and deletion — your data, your control' },
                ].map((item) => (
                  <div key={item.text} className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <item.icon className="h-4 w-4 text-primary" />
                    </div>
                    <p className="text-sm leading-relaxed pt-1">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-chart-2/10 rounded-3xl blur-2xl" />
              <Card className="relative border-border/60 overflow-hidden">
                <CardContent className="p-0">
                  <div className="aspect-[4/3] relative">
                    <img
                      src="https://images.pexels.com/photos/6684506/pexels-photo-6684506.jpeg?auto=compress&cs=tinysrgb&h=650&w=940"
                      alt="Students studying together"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/20 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-6">
                      <p className="text-white font-medium text-lg">
                        &ldquo;I finally have a place online that makes me feel better, not worse.&rdquo;
                      </p>
                      <p className="text-white/70 text-sm mt-1">— Maya, 16, student</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
        <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-primary/10 via-card to-chart-2/10 p-12 lg:p-16 text-center">
          <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-chart-2/10 blur-3xl" />
          <div className="relative">
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl text-balance mb-4">
              Ready to grow into who you want to be?
            </h2>
            <p className="mx-auto max-w-xl text-muted-foreground text-balance mb-8">
              Join thousands of students building a healthier relationship with the internet.
              Free forever. No ads. No data selling.
            </p>
            <Link href="/signup">
              <Button size="lg" className="gap-2 text-base h-12 px-8">
                Create your account <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
                L
              </div>
              <span className="font-display font-bold">Life OS</span>
            </div>
            <p className="text-sm text-muted-foreground">
              A Social OS for young learners. Built with privacy, safety, and growth at its core.
            </p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <Link href="/login" className="hover:text-foreground transition-colors">Log in</Link>
              <Link href="/signup" className="hover:text-foreground transition-colors">Sign up</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
