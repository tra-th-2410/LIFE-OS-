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
  const specializedBots = [
    {
      key: 'learning' as const,
      icon: <GraduationCap className="h-7 w-7 text-blue-500" />,
      cta: 'Start Learning',
      badgeColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      gradient: 'hover:border-blue-500/40 hover:shadow-blue-500/5',
    },
    {
      key: 'writing' as const,
      icon: <PenTool className="h-7 w-7 text-emerald-500" />,
      cta: 'Start Writing',
      badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      gradient: 'hover:border-emerald-500/40 hover:shadow-emerald-500/5',
    },
    {
      key: 'project' as const,
      icon: <Rocket className="h-7 w-7 text-amber-500" />,
      cta: 'Start Project',
      badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      gradient: 'hover:border-amber-500/40 hover:shadow-amber-500/5',
    },
    {
      key: 'career' as const,
      icon: <Compass className="h-7 w-7 text-teal-500" />,
      cta: 'Explore Careers',
      badgeColor: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
      gradient: 'hover:border-teal-500/40 hover:shadow-teal-500/5',
    },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      {/* Page Header */}
      <div className="flex flex-col gap-2 border-b border-border/50 pb-5">
        <div className="flex items-center gap-2">
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
        <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/60 via-purple-500/50 to-blue-500/60 rounded-3xl blur-md opacity-30 group-hover:opacity-60 transition duration-500" />
        
        <Card className="relative border-primary/30 bg-gradient-to-br from-primary/10 via-card to-background rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-4 max-w-2xl">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-3xl">🎯</span>
                  <h2 className="text-2xl sm:text-3xl font-display font-bold text-foreground">
                    Study Coach AI
                  </h2>
                  <Badge className="bg-primary text-primary-foreground font-semibold px-2.5 py-0.5 shadow-sm text-xs">
                    <Sparkles className="h-3 w-3 mr-1" /> AI Trung tâm
                  </Badge>
                </div>

                <p className="text-base text-foreground/90 font-medium">
                  Your personal AI coach for learning, planning, and progress.
                </p>

                <p className="text-sm text-muted-foreground leading-relaxed">
                  Được thiết kế để trở thành bộ não điều phối học tập của Life OS: tự động phân tích dữ liệu 
                  <strong> Weakness Map</strong>, kết nối <strong>Smart Calendar</strong>, đề xuất thời lượng ôn tập tối ưu và điều chỉnh kế hoạch dựa trên tiến độ học tập thực tế của bạn.
                </p>

                <div className="flex flex-wrap gap-2 pt-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-background/80 px-2.5 py-1 rounded-full border border-border/50">
                    <TrendingUp className="h-3.5 w-3.5 text-primary" /> Phân tích điểm yếu
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-background/80 px-2.5 py-1 rounded-full border border-border/50">
                    <Calendar className="h-3.5 w-3.5 text-primary" /> Đề xuất lịch học
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-background/80 px-2.5 py-1 rounded-full border border-border/50">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Theo dõi tiến độ
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
                <Link href="/app/study-coach">
                  <Button size="lg" className="w-full sm:w-auto font-semibold shadow-md text-base px-6 h-12 gap-2">
                    Chat with Study Coach <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 4 Specialized AI Assistants Grid */}
      <div className="space-y-4 pt-2">
        <div>
          <h2 className="text-lg sm:text-xl font-display font-bold">
            Trợ lý AI chuyên biệt
          </h2>
          <p className="text-sm text-muted-foreground">
            Các trợ lý chuyên sâu hỗ trợ từng mục tiêu và kỹ năng cụ thể.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {specializedBots.map(({ key, icon, cta, badgeColor, gradient }) => {
            const bot = AI_BOTS[key];
            if (!bot) return null;

            return (
              <Card
                key={key}
                className={`group relative flex flex-col justify-between border-border/60 bg-card hover:shadow-lg transition-all duration-300 ${gradient}`}
              >
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3.5">
                      <div className="p-3 rounded-2xl bg-muted/60 border border-border/40 shadow-xs">
                        {icon}
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors">
                          {bot.name}
                        </h3>
                        <Badge variant="outline" className={`mt-0.5 text-xs font-semibold ${badgeColor}`}>
                          {bot.flow}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {bot.description}
                  </p>

                  <div className="space-y-1.5 pt-1">
                    <p className="text-xs font-semibold text-muted-foreground/80 uppercase tracking-wider">
                      Gợi ý câu hỏi:
                    </p>
                    {bot.suggestions.slice(0, 3).map((s) => (
                      <div
                        key={s}
                        className="text-xs text-muted-foreground/90 pl-2.5 py-0.5 border-l-2 border-primary/30 line-clamp-1"
                      >
                        {s}
                      </div>
                    ))}
                  </div>
                </CardContent>

                <div className="p-6 pt-0 mt-auto">
                  <Link href={`/app/ai/${key}`}>
                    <Button variant="outline" className="w-full justify-between font-medium group-hover:border-primary/50 group-hover:text-primary transition-all">
                      <span>{cta}</span>
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
