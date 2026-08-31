'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight } from 'lucide-react';
import { AI_BOTS } from '@/lib/ai';
import type { BotType } from '@/lib/types';

export default function AiCenterPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">AI Center & Study Coach</h1>
          <p className="text-muted-foreground mt-1">
            Hệ sinh thái trợ lý học tập và phát triển cá nhân thông minh của Life OS.
          </p>
        </div>
      </div>

      {/* Featured Primary AI Assistant: Study Coach */}
      <Link href="/app/study-coach">
        <Card className="border-primary/40 bg-gradient-to-br from-primary/10 via-card to-background hover:border-primary hover:shadow-md transition-all p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center text-3xl font-bold shadow-sm shrink-0">
                🤖
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold font-display text-foreground">Study Coach AI (Trung tâm)</h2>
                  <Badge className="bg-primary text-primary-foreground text-xs">Chính thức</Badge>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Trợ lý học tập tổng hợp: Kết nối trực tiếp Weakness Map, Smart Calendar, Thư viện tài liệu và Đề xuất kế hoạch ôn thi tự động.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-sm font-bold text-primary shrink-0">
              Trò chuyện ngay <ArrowRight className="h-4 w-4" />
            </div>
          </div>
        </Card>
      </Link>

      <div className="pt-2">
        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">
          Trợ lý AI chuyên biệt theo kỹ năng:
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(Object.keys(AI_BOTS) as BotType[]).map((key) => {
          const bot = AI_BOTS[key];
          return (
            <Link key={key} href={`/app/ai/${key}`}>
              <Card className="group cursor-pointer border-border/60 hover:border-primary/40 hover:shadow-lg transition-all duration-300 h-full">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-3xl shrink-0">
                      {bot.icon}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">{bot.name}</h3>
                      <p className="mt-0.5 text-xs font-medium text-primary/80">{bot.flow}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{bot.description}</p>
                      <div className="mt-3 flex items-center gap-1 text-sm text-primary font-medium">
                        Start chatting <ArrowRight className="h-3.5 w-3.5" />
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 space-y-1.5">
                    {bot.suggestions.map((s) => (
                      <p key={s} className="text-xs text-muted-foreground/80 pl-1 border-l-2 border-primary/20">
                        {s}
                      </p>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
        </div>
      </div>

      <Card className="border-border/60 bg-muted/30">
        <CardContent className="p-4">
          <Badge variant="outline" className="mb-2">Safety Notice</Badge>
          <p className="text-sm text-muted-foreground">
            All AI assistants are transparent about being AI. They are not therapists or medical professionals.
            If you are in crisis, please contact a trusted adult, a professional, or your local crisis line.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
