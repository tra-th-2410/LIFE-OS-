'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles,
  Send,
  Loader2,
  Calendar,
  BookOpen,
  Target,
  Flame,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  ArrowRight,
  TrendingUp,
  RotateCcw,
  PlusCircle,
  HelpCircle,
} from 'lucide-react';
import { getWeaknessMapForUser } from '@/lib/study-analytics';
import { createCalendarEvent } from '@/lib/calendar';
import { generateAiResponse } from '@/lib/ai';
import type { StudyWeaknessTopic, UserGamification, SmartCalendarEvent } from '@/lib/types';
import { getDisplayName } from '@/lib/helpers';
import { toast } from 'sonner';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  actionProposal?: {
    topic: string;
    subject: string;
    actionType: 'calendar_schedule' | 'practice_quiz';
    durationMinutes?: number;
    time?: string;
    details: string;
  };
}

export default function StudyCoachPage() {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);

  // Real Student Learning Context
  const [weaknessTopics, setWeaknessTopics] = useState<StudyWeaknessTopic[]>([]);
  const [gamification, setGamification] = useState<UserGamification | null>(null);
  const [upcomingEvents, setUpcomingEvents] = useState<SmartCalendarEvent[]>([]);
  const [loadingContext, setLoadingContext] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load complete student learning context from database
  const loadContext = useCallback(async () => {
    if (!user) return;
    setLoadingContext(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const futureDateStr = futureDate.toISOString().split('T')[0];

      const [weakList, gameRes, evsRes] = await Promise.all([
        getWeaknessMapForUser(user.id),
        supabase.from('user_gamification').select('*').eq('user_id', user.id).maybeSingle(),
        supabase
          .from('smart_calendar_events')
          .select('*')
          .eq('user_id', user.id)
          .gte('date', todayStr)
          .lte('date', futureDateStr)
          .order('date', { ascending: true })
          .limit(5),
      ]);

      setWeaknessTopics(weakList);
      setGamification((gameRes.data as UserGamification) ?? null);
      setUpcomingEvents((evsRes.data as SmartCalendarEvent[]) ?? []);

      // Initial AI greeting personalized with real student context
      const weak = weakList.filter((w) => w.mastery_score < 70);
      let initialGreeting = `Xin chào **${getDisplayName(profile)}**! Tôi là **Study Coach AI** — trợ lý học tập trung tâm của bạn tại Life OS.`;

      if (weak.length > 0) {
        initialGreeting += `\n\n📊 **Phân tích hiện tại:** Bạn đang có ${weak.length} chủ đề cần củng cố:\n` +
          weak.slice(0, 3).map((w) => `• **${w.subject} - ${w.topic}** (Độ thành thạo: ${w.mastery_score}%)`).join('\n') +
          `\n\nTôi có thể giúp bạn lập kế hoạch ôn tập, phân bổ thời lượng học tối ưu và xếp lịch vào **Smart Calendar**. Bạn muốn bắt đầu từ chủ đề nào?`;
      } else {
        initialGreeting += `\n\n🌟 Hiện tại bạn chưa có chủ đề yếu nào được ghi nhận hoặc các bài thi gần nhất đều đạt phong độ tốt! Bạn muốn ôn tập đề mới, chuẩn bị bài vở sắp tới hay xem thời khóa biểu tuần này?`;
      }

      setMessages([
        {
          id: 'msg-init',
          role: 'assistant',
          content: initialGreeting,
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err) {
      console.error('Error loading study coach context:', err);
    } finally {
      setLoadingContext(false);
    }
  }, [user, profile]);

  useEffect(() => {
    loadContext();
  }, [loadContext]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAiTyping]);

  // Parse structured action proposal from AI text if present
  const parseActionProposal = (text: string): { cleanText: string; proposal?: ChatMessage['actionProposal'] } => {
    const proposalMatch = text.match(/\[SCHEDULE_PROPOSAL:\s*(\{[\s\S]*?\})\]/);
    if (!proposalMatch) {
      return { cleanText: text };
    }

    try {
      const parsed = JSON.parse(proposalMatch[1]);
      const cleanText = text.replace(proposalMatch[0], '').trim();
      return {
        cleanText,
        proposal: {
          topic: parsed.topic || 'Ôn tập kiến thức trọng tâm',
          subject: parsed.subject || 'general',
          actionType: 'calendar_schedule',
          durationMinutes: Number(parsed.durationMinutes) || 45,
          time: parsed.time || '19:30',
          details: `Xếp lịch ôn tập môn ${parsed.subject || 'Học tập'} (${Number(parsed.durationMinutes) || 45} phút lúc ${parsed.time || '19:30'})`,
        },
      };
    } catch {
      return { cleanText: text };
    }
  };

  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = (customPrompt || inputText).trim();
    if (!textToSend || isAiTyping) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customPrompt) setInputText('');
    setIsAiTyping(true);

    try {
      // Build student context payload
      const studentContext = {
        weaknessTopics: weaknessTopics.map((w) => ({
          subject: w.subject,
          topic: w.topic,
          mastery_score: w.mastery_score,
        })),
        upcomingEvents: upcomingEvents.map((e) => ({
          title: e.title,
          date: e.date,
          start_time: e.start_time,
        })),
        gamification: gamification
          ? {
              level: gamification.level,
              xp: gamification.xp,
              streak_days: gamification.streak_days,
              total_study_minutes: gamification.total_study_minutes,
            }
          : undefined,
      };

      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;

      // Call Unified AI Pipeline
      const historyPayload = messages.concat(userMsg).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const rawAiResponse = await generateAiResponse(
        'study_coach',
        historyPayload,
        accessToken,
        studentContext
      );

      const { cleanText, proposal } = parseActionProposal(rawAiResponse);

      // If AI didn't format structured JSON but suggested a study session, generate proposal card
      let effectiveProposal = proposal;
      const lower = rawAiResponse.toLowerCase();
      if (!effectiveProposal && (lower.includes('đề xuất') || lower.includes('lịch') || lower.includes('45 phút') || lower.includes('30 phút'))) {
        const weakest = weaknessTopics[0];
        if (weakest) {
          effectiveProposal = {
            topic: weakest.topic,
            subject: weakest.subject,
            actionType: 'calendar_schedule',
            durationMinutes: 45,
            time: '19:30',
            details: `Xếp lịch ôn ${weakest.subject}: ${weakest.topic} (45 phút lúc 19:30 tối mai)`,
          };
        }
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `msg-ai-${Date.now()}`,
          role: 'assistant',
          content: cleanText,
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          actionProposal: effectiveProposal,
        },
      ]);
    } catch (err: any) {
      console.error('Error generating AI response:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-ai-${Date.now()}`,
          role: 'assistant',
          content: 'Xin lỗi, hiện tại kết nối đến AI đang gặp sự cố. Bạn vui lòng thử lại sau ít phút hoặc chọn một trong các gợi ý bên dưới.',
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsAiTyping(false);
    }
  };

  // Add Proposed Session directly to Calendar after user confirmation
  const handleApplyCalendarProposal = async (proposal: NonNullable<ChatMessage['actionProposal']>) => {
    if (!user) return;
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      await createCalendarEvent(user.id, {
        title: `Ôn tập: ${proposal.subject} - ${proposal.topic}`,
        subject: proposal.subject,
        topic: proposal.topic,
        date: dateStr,
        start_time: proposal.time || '19:30',
        end_time: '20:15',
        duration_minutes: proposal.durationMinutes || 45,
        color: 'emerald',
        has_reminder: true,
        reminder_minutes_before: 30,
        source: 'study_coach',
      });

      toast.success(`Đã thêm buổi học "${proposal.topic}" vào Smart Calendar ngày mai!`);
      loadContext();
    } catch {
      toast.error('Không thể thêm vào Lịch');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-3xl">🎯</span>
            <h1 className="text-2xl sm:text-3xl font-display font-bold">Study Coach AI</h1>
            <Badge className="bg-primary/10 text-primary border-primary/20 text-xs font-semibold">
              <Sparkles className="h-3 w-3 mr-1" /> AI Trung tâm
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Bộ não điều phối học tập của Life OS: Kết nối Weakness Map, Smart Calendar, Thư viện tài liệu và Đề xuất kế hoạch ôn thi tự động.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/app/ai">
            <Button variant="outline" size="sm">
              Xem tất cả AI (AI Center)
            </Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={loadContext} disabled={loadingContext}>
            <RotateCcw className={`h-4 w-4 mr-1.5 ${loadingContext ? 'animate-spin' : ''}`} />
            Làm mới dữ liệu
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Side: Real Student Learning Context Sidebar */}
        <div className="space-y-5 order-2 lg:order-1">
          {/* Card 1: Weakness Map Snapshot */}
          <Card className="border-border/60 bg-card shadow-xs">
            <CardHeader className="p-4 pb-2 border-b border-border/40 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Target className="h-4 w-4 text-red-500" />
                Bản đồ Điểm yếu (Weakness Map)
              </CardTitle>
              <Link href="/app/study?tab=progress" className="text-xs text-primary hover:underline">
                Chi tiết
              </Link>
            </CardHeader>
            <CardContent className="p-4 space-y-2.5">
              {weaknessTopics.length === 0 ? (
                <div className="p-3 rounded-lg bg-muted/40 text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">Chưa có dữ liệu điểm yếu</p>
                  <p>Hãy làm một vài bài Quiz hoặc luyện tập trong mục Học tập để AI lập bản đồ năng lực.</p>
                </div>
              ) : (
                weaknessTopics.slice(0, 4).map((w) => (
                  <div
                    key={w.id}
                    className="p-2.5 rounded-lg border border-border/50 bg-background/50 hover:bg-muted/30 transition-colors space-y-1"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium truncate max-w-[170px]">{w.topic}</span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          w.mastery_score < 50
                            ? 'bg-red-500/10 text-red-600 border-red-500/20'
                            : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                        }`}
                      >
                        {w.mastery_score}%
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{w.subject}</span>
                      <button
                        onClick={() =>
                          handleSendMessage(
                            `Hãy lên lịch ôn tập và phân tích kiến thức phần "${w.subject}: ${w.topic}" (đang đạt ${w.mastery_score}%).`
                          )
                        }
                        className="text-primary hover:underline font-medium"
                      >
                        Ôn ngay →
                      </button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Card 2: Upcoming Calendar Events */}
          <Card className="border-border/60 bg-card shadow-xs">
            <CardHeader className="p-4 pb-2 border-b border-border/40 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Lịch học sắp tới (7 ngày)
              </CardTitle>
              <Link href="/app/calendar" className="text-xs text-primary hover:underline">
                Xem Lịch
              </Link>
            </CardHeader>
            <CardContent className="p-4 space-y-2">
              {upcomingEvents.length === 0 ? (
                <div className="p-3 rounded-lg bg-muted/40 text-xs text-muted-foreground">
                  Chưa có sự kiện học nào trong 7 ngày tới. Hãy để Study Coach lên lịch cho bạn!
                </div>
              ) : (
                upcomingEvents.map((ev) => (
                  <div key={ev.id} className="flex items-center justify-between p-2 rounded-md bg-muted/30 text-xs">
                    <div className="space-y-0.5 truncate">
                      <p className="font-medium truncate">{ev.title}</p>
                      <p className="text-muted-foreground text-[11px]">
                        {ev.date} lúc {ev.start_time}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {ev.subject || 'study'}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Card 3: Gamification & Streak Status */}
          {gamification && (
            <Card className="border-border/60 bg-card shadow-xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                    <Flame className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Chuỗi học tập</p>
                    <p className="text-sm font-bold">{gamification.streak_days} ngày liên tục</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Cấp độ</p>
                  <p className="text-sm font-bold text-primary">Level {gamification.level} ({gamification.xp} XP)</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Side: Interactive AI Study Coach Chat Area */}
        <div className="lg:col-span-2 order-1 lg:order-2 flex flex-col h-[650px] border border-border/60 rounded-2xl bg-card shadow-sm overflow-hidden">
          {/* Chat Messages Log */}
          <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-4">
            {messages.map((m) => {
              const isUser = m.role === 'user';
              return (
                <div key={m.id} className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
                  {!isUser && (
                    <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm shrink-0 mt-0.5 border border-primary/20">
                      🎯
                    </div>
                  )}

                  <div className={`space-y-2 max-w-[85%] sm:max-w-[75%]`}>
                    <div
                      className={`p-3.5 sm:p-4 rounded-2xl text-sm leading-relaxed ${
                        isUser
                          ? 'bg-primary text-primary-foreground rounded-tr-xs'
                          : 'bg-muted/60 text-foreground border border-border/40 rounded-tl-xs'
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{m.content}</div>
                    </div>

                    {/* Interactive Action Proposal Card */}
                    {m.actionProposal && !isUser && (
                      <Card className="border-emerald-500/30 bg-emerald-500/5 shadow-xs">
                        <CardContent className="p-3 sm:p-4 space-y-2.5">
                          <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            <PlusCircle className="h-4 w-4" /> Đề xuất Kế hoạch học tập
                          </div>
                          <p className="text-xs text-muted-foreground">{m.actionProposal.details}</p>
                          <div className="flex items-center gap-2 pt-1">
                            <Button
                              size="sm"
                              className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                              onClick={() => handleApplyCalendarProposal(m.actionProposal!)}
                            >
                              <Calendar className="h-3.5 w-3.5 mr-1.5" /> Thêm vào Smart Calendar
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    <div className={`text-[10px] text-muted-foreground px-1 ${isUser ? 'text-right' : 'text-left'}`}>
                      {m.timestamp}
                    </div>
                  </div>
                </div>
              );
            })}

            {isAiTyping && (
              <div className="flex gap-3 justify-start">
                <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm shrink-0 border border-primary/20">
                  🎯
                </div>
                <div className="p-3.5 rounded-2xl bg-muted/60 border border-border/40 rounded-tl-xs flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  Study Coach đang phân tích dữ liệu và soạn câu trả lời...
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestion Chips */}
          <div className="p-2.5 px-4 bg-muted/20 border-t border-border/40 flex items-center gap-2 overflow-x-auto">
            <span className="text-[11px] font-semibold text-muted-foreground shrink-0">Gợi ý nhanh:</span>
            {[
              'Phân tích điểm yếu của tôi',
              'Lên lịch ôn tập 45 phút tối mai',
              'Đề xuất kế hoạch ôn thi tuần này',
              'Tạo câu hỏi luyện tập',
            ].map((chip) => (
              <button
                key={chip}
                onClick={() => handleSendMessage(chip)}
                disabled={isAiTyping}
                className="text-xs bg-background/80 hover:bg-primary/10 hover:text-primary px-2.5 py-1 rounded-full border border-border/60 text-muted-foreground whitespace-nowrap transition-colors"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Message Input Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 sm:p-4 bg-background border-t border-border/60 flex items-center gap-2"
          >
            <Input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Nhập câu hỏi, yêu cầu lập lịch hoặc chủ đề cần Study Coach hỗ trợ..."
              disabled={isAiTyping}
              className="flex-1 text-sm bg-muted/30 focus-visible:ring-1"
            />
            <Button type="submit" disabled={!inputText.trim() || isAiTyping} size="icon" className="shrink-0 h-10 w-10">
              {isAiTyping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
