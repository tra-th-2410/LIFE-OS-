'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sparkles,
  ArrowRight,
  GraduationCap,
  PenTool,
  Rocket,
  Compass,
  CheckCircle2,
  Calendar,
  TrendingUp,
} from 'lucide-react';
import { AI_BOTS } from '@/lib/ai';

export default function AiCenterPage() {
  const specialists = [
    {
      key: 'learning' as const,
      name: 'Learning AI',
      icon: <GraduationCap className="h-6 w-6 text-primary" />,
      tagline: 'Learn • Understand • Practice',
      description: 'Giải thích khái niệm, gợi ý giải bài tập từng bước theo phương pháp Socratic, tạo câu hỏi quiz luyện tập và flashcards.',
      cta: 'Open →',
      borderHover: 'hover:border-primary/40',
      badgeColor: 'bg-accent/60 text-accent-foreground border-border/40',
      bullets: ['Learn', 'Understand', 'Practice'],
    },
    {
      key: 'writing' as const,
      name: 'Writing AI',
      icon: <PenTool className="h-6 w-6 text-primary" />,
      tagline: 'Write • Improve • Communicate',
      description: 'Luyện thi IELTS Writing & Speaking, sửa lỗi ngữ pháp kèm giải thích lý do, nâng cao từ vựng và văn phong học thuật.',
      cta: 'Open →',
      borderHover: 'hover:border-primary/40',
      badgeColor: 'bg-accent/60 text-accent-foreground border-border/40',
      bullets: ['Write', 'Improve', 'Communicate'],
    },
    {
      key: 'project' as const,
      name: 'Project AI',
      icon: <Rocket className="h-6 w-6 text-primary" />,
      tagline: 'Create • Build • Present',
      description: 'Cố vấn dự án STEM, nghiên cứu khoa học, lập timeline, phân rã nhiệm vụ và chuẩn bị câu hỏi phản biện của giám khảo.',
      cta: 'Open →',
      borderHover: 'hover:border-primary/40',
      badgeColor: 'bg-accent/60 text-accent-foreground border-border/40',
      bullets: ['Create', 'Build', 'Present'],
    },
    {
      key: 'career' as const,
      name: 'Career AI',
      icon: <Compass className="h-6 w-6 text-primary" />,
      tagline: 'Discover • Explore • Plan',
      description: 'Khám phá ngành học đại học, so sánh các ngành nghề, định hướng lộ trình học bổng và luyện phỏng vấn 1-1.',
      cta: 'Open →',
      borderHover: 'hover:border-primary/40',
      badgeColor: 'bg-accent/60 text-accent-foreground border-border/40',
      bullets: ['Discover', 'Explore', 'Plan'],
    },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      {/* Page Header */}
      <div className="flex flex-col gap-2 border-b border-border/50 pb-5">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🤖</span>
          <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-tight">
            AI Center
          </h1>
        </div>
        <p className="text-base text-muted-foreground">
          Your intelligent learning & life companion.
        </p>
      </div>

      {/* Featured Primary AI: Study Coach AI */}
      <div className="relative group">
        <Card className="border border-border bg-card hover:border-primary/40 rounded-2xl overflow-hidden shadow-xs transition-all duration-300">
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-4 max-w-2xl">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-3xl">🎯</span>
                  <h2 className="text-2xl sm:text-3xl font-display font-bold text-foreground">
                    Study Coach AI
                  </h2>
                  <Badge className="bg-accent/70 text-accent-foreground border-border font-semibold px-2.5 py-0.5 text-xs">
                    <Sparkles className="h-3 w-3 mr-1 text-primary" /> Plan • Focus • Progress
                  </Badge>
                </div>

                <p className="text-base text-foreground font-medium">
                  Your personal AI coach for learning, planning, and progress.
                </p>

                <p className="text-sm text-muted-foreground leading-relaxed">
                  AI trung tâm có khả năng sử dụng context từ Life OS (<strong>Weakness Map</strong>, <strong>Smart Calendar</strong>, <strong>Study Progress</strong>, <strong>Gamification</strong>, <strong>Study History</strong>) để phân tích năng lực, đề xuất lịch học và tối ưu tiến độ học tập của bạn.
                </p>

                <div className="flex flex-wrap gap-2 pt-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary/80 px-2.5 py-1 rounded-full border border-border/50">
                    <TrendingUp className="h-3.5 w-3.5 text-primary" /> Phân tích điểm yếu
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary/80 px-2.5 py-1 rounded-full border border-border/50">
                    <Calendar className="h-3.5 w-3.5 text-primary" /> Đề xuất lịch học
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary/80 px-2.5 py-1 rounded-full border border-border/50">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Theo dõi tiến độ
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
                <Link href="/app/study-coach">
                  <Button variant="ai" size="lg" className="w-full sm:w-auto font-semibold shadow-xs text-base px-6 h-12 gap-2 rounded-xl">
                    Chat with Study Coach <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 4 Specialized AI Assistants Section */}
      <div className="space-y-4 pt-2">
        <div>
          <h2 className="text-xl sm:text-2xl font-display font-bold text-foreground">
            Your AI Specialists
          </h2>
          <p className="text-sm text-muted-foreground">
            Các trợ lý chuyên sâu hỗ trợ từng mục tiêu và kỹ năng cụ thể.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {specialists.map((bot) => {
            const botConfig = AI_BOTS[bot.key];

            return (
              <Card
                key={bot.key}
                className={`group relative flex flex-col justify-between border-border/60 bg-card hover:shadow-lg transition-all duration-300 ${bot.borderHover}`}
              >
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3.5">
                      <div className="p-2.5 rounded-2xl bg-muted/60 border border-border/40 shadow-xs">
                        {bot.icon}
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors">
                          {bot.name}
                        </h3>
                        <Badge variant="outline" className={`mt-0.5 text-xs font-semibold ${bot.badgeColor}`}>
                          {bot.tagline}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {bot.description}
                  </p>

                  {/* Flow Pills */}
                  <div className="flex items-center gap-2 pt-1">
                    {bot.bullets.map((b, i) => (
                      <span
                        key={b}
                        className="text-xs bg-muted/50 text-muted-foreground px-2.5 py-0.5 rounded-md border border-border/40 font-medium"
                      >
                        {b}
                      </span>
                    ))}
                  </div>

                  {/* Suggestions sample */}
                  {botConfig && (
                    <div className="space-y-1 pt-1 border-t border-border/40">
                      <p className="text-[11px] font-semibold text-muted-foreground/80 uppercase tracking-wider">
                        Gợi ý:
                      </p>
                      <p className="text-xs text-muted-foreground/90 truncate">
                        &ldquo;{botConfig.suggestions[0]}&rdquo;
                      </p>
                    </div>
                  )}
                </CardContent>

                <div className="p-6 pt-0 mt-auto">
                  <Link href={`/app/ai/${bot.key}`}>
                    <Button
                      variant="outline"
                      className="w-full justify-between font-medium group-hover:border-primary/50 group-hover:text-primary transition-all"
                    >
                      <span>{bot.cta}</span>
                      <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Safety Notice */}
      <Card className="border-border/60 bg-muted/30">
        <CardContent className="p-4 sm:p-5 flex items-start gap-3">
          <div className="text-xl shrink-0">🛡️</div>
          <div className="text-xs sm:text-sm text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground">Nguyên tắc minh bạch & Tin cậy:</p>
            <p>
              Tất cả các trợ lý AI tại AI Center đều hoạt động như người bạn đồng hành học tập và cố vấn thông tin. AI không tự ý chỉnh sửa dữ liệu nếu bạn chưa xác nhận.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
