'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Bot,
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
} from 'lucide-react';
import { getWeaknessMapForUser, type WeaknessRecommendation } from '@/lib/study-analytics';
import { createCalendarEvent } from '@/lib/calendar';
import type { StudyWeaknessTopic, UserGamification, SmartCalendarEvent } from '@/lib/types';
import { formatRelativeTime, getDisplayName, initials } from '@/lib/helpers';
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
    details: string;
  };
}

export default function StudyCoachPage() {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);

  // User Learning Context
  const [weaknessTopics, setWeaknessTopics] = useState<StudyWeaknessTopic[]>([]);
  const [gamification, setGamification] = useState<UserGamification | null>(null);
  const [upcomingEvents, setUpcomingEvents] = useState<SmartCalendarEvent[]>([]);
  const [loadingContext, setLoadingContext] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load complete student context
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

      // Initial AI greeting personalized with context
      const weak = weakList.filter((w) => w.mastery_score < 70);
      let initialGreeting = `Xin chào ${getDisplayName(profile)}! Tôi là **Study Coach AI** — trợ lý học tập cá nhân của bạn.`;

      if (weak.length > 0) {
        initialGreeting += `\n\nTôi nhận thấy bạn có ${weak.length} chủ đề cần củng cố (ví dụ: **${weak[0].subject} - ${weak[0].topic}** chỉ đạt ${weak[0].mastery_score}%). Bạn muốn tôi lên lịch ôn tập hoặc giải thích lại kiến thức nào hôm nay?`;
      } else {
        initialGreeting += `\n\nBạn đang duy trì phong độ rất tốt! Bạn muốn giải đề mới, tóm tắt tài liệu hay lập kế hoạch ôn thi tuần này?`;
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
      console.error(err);
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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isAiTyping) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: inputText.trim(),
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsAiTyping(true);

    // Simulate AI Study Coach Contextual Reasoning
    setTimeout(() => {
      const lower = userMsg.content.toLowerCase();
      let replyContent = '';
      let proposal: ChatMessage['actionProposal'] | undefined = undefined;

      if (lower.includes('lịch') || lower.includes('ôn') || lower.includes('toán') || lower.includes('thi')) {
        replyContent = `Dựa trên phân tích lộ trình học tập, tôi đề xuất bạn dành **45 phút** vào tối mai để ôn tập chuyên sâu dạng bài này và làm 10 câu trắc nghiệm vận dụng.`;
        proposal = {
          topic: 'Ôn tập trọng điểm & Giải bài tập',
          subject: 'Toán học',
          actionType: 'calendar_schedule',
          details: 'Thêm buổi học 45 phút vào tối mai lúc 19:30',
        };
      } else if (lower.includes('yếu') || lower.includes('kém') || lower.includes('weakness')) {
        const weakest = weaknessTopics[0];
        if (weakest) {
          replyContent = `Theo bản đồ Weakness Map, phần bạn cần lưu ý nhất là **${weakest.subject}: ${weakest.topic}** (độ chính xác: ${weakest.mastery_score}%). Tôi khuyên bạn nên làm 5 Flashcard công thức trước, sau đó thử sức với 10 câu trắc nghiệm cơ bản.`;
        } else {
          replyContent = `Hiện tại hệ thống chưa ghi nhận chủ đề nào bị yếu. Hãy tiếp tục làm bài thi thử để tôi liên tục cập nhật bản đồ năng lực của bạn nhé!`;
        }
      } else {
        replyContent = `Tôi đã ghi nhận câu hỏi của bạn. Về vấn đề này, nguyên lý cốt lõi là nắm vững định nghĩa cơ bản và liên hệ với các dạng bài tập thực hành. Bạn muốn tôi tạo bộ câu hỏi trắc nghiệm nhanh để kiểm tra ngay không?`;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `msg-ai-${Date.now()}`,
          role: 'assistant',
          content: replyContent,
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          actionProposal: proposal,
        },
      ]);
      setIsAiTyping(false);
    }, 1000);
  };

  // Add Proposed Session directly to Calendar
  const handleApplyCalendarProposal = async (proposal: NonNullable<ChatMessage['actionProposal']>) => {
    if (!user) return;
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      await createCalendarEvent(user.id, {
        title: `${proposal.subject}: ${proposal.topic}`,
        subject: proposal.subject,
        topic: proposal.topic,
        date: dateStr,
        start_time: '19:30',
        end_time: '20:15',
        duration_minutes: 45,
        color: 'emerald',
        has_reminder: true,
        reminder_minutes_before: 30,
        source: 'study_coach',
      });

      toast.success(`Đã thêm buổi học theo chỉ dẫn của Study Coach vào Lịch ngày mai!`);
    } catch {
      toast.error('Không thể thêm vào Lịch');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-display font-bold">Study Coach AI</h1>
            <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
              <Sparkles className="h-3 w-3 mr-1" /> Trợ lý học tập trung tâm
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Hệ thống AI trung tâm kết nối dữ liệu Weakness Map, Calendar, Quiz và Study Library để cá nhân hóa lộ trình.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Side: Student Context Sidebar */}
        <div className="space-y-4 lg:col-span-1">
          {/* Quick Metrics Card */}
          <Card className="border-border/60 bg-card/80 p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5 text-primary" /> Ngữ cảnh học tập hiện tại
            </h3>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-muted/40 border border-border/40">
                <p className="text-[10px] text-muted-foreground">Chuỗi Streak</p>
                <p className="font-bold text-orange-500 flex items-center gap-1 mt-0.5">
                  <Flame className="h-3.5 w-3.5" /> {gamification?.streak_days || 0} ngày
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-muted/40 border border-border/40">
                <p className="text-[10px] text-muted-foreground">Cấp độ học</p>
                <p className="font-bold text-primary mt-0.5">Cấp {gamification?.level || 1}</p>
              </div>
            </div>
          </Card>

          {/* Weakness Map Highlights */}
          <Card className="border-border/60 bg-card/80 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-rose-500" /> Weakness Map Top
              </h3>
            </div>

            {weaknessTopics.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Chưa có đủ dữ liệu quiz để nhận diện chủ đề yếu.</p>
            ) : (
              <div className="space-y-2">
                {weaknessTopics.slice(0, 3).map((w) => (
                  <div
                    key={w.id}
                    className="p-2.5 rounded-xl border border-border/40 bg-muted/20 text-xs flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">{w.topic}</p>
                      <p className="text-[10px] text-muted-foreground">{w.subject}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] shrink-0 ${
                        w.mastery_score < 60
                          ? 'border-rose-500/30 text-rose-500 bg-rose-500/10'
                          : 'border-emerald-500/30 text-emerald-600 bg-emerald-500/10'
                      }`}
                    >
                      {w.mastery_score}%
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Upcoming Schedule */}
          <Card className="border-border/60 bg-card/80 p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-blue-500" /> Lịch học sắp tới
            </h3>

            {upcomingEvents.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Không có lịch học trong 7 ngày tới.</p>
            ) : (
              <div className="space-y-2">
                {upcomingEvents.map((ev) => (
                  <div key={ev.id} className="p-2 rounded-xl bg-muted/30 border border-border/40 text-xs">
                    <p className="font-medium text-foreground truncate">{ev.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {ev.date} • {ev.start_time.slice(0, 5)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right Side: Central AI Coach Conversation Hub */}
        <div className="lg:col-span-2">
          <Card className="border-border/60 bg-card/90 shadow-sm flex flex-col h-[640px] overflow-hidden">
            {/* Chat Messages Log */}
            <CardContent className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-4">
              {messages.map((m) => {
                const isUser = m.role === 'user';
                return (
                  <div key={m.id} className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                    <Avatar className="h-8 w-8 shrink-0">
                      {isUser ? (
                        <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                          {initials(getDisplayName(profile))}
                        </AvatarFallback>
                      ) : (
                        <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                          🤖
                        </AvatarFallback>
                      )}
                    </Avatar>

                    <div className={`space-y-2 max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
                      <div
                        className={`p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ${
                          isUser
                            ? 'bg-primary text-primary-foreground rounded-tr-none'
                            : 'bg-muted/60 border border-border/60 text-foreground rounded-tl-none'
                        }`}
                      >
                        {m.content}
                      </div>

                      {/* Action Proposal Card */}
                      {m.actionProposal && (
                        <div className="p-3 rounded-2xl border border-primary/30 bg-primary/5 space-y-2 text-xs">
                          <div className="flex items-center gap-1.5 font-bold text-primary">
                            <Lightbulb className="h-4 w-4" /> Đề xuất hành động từ AI
                          </div>
                          <p className="text-muted-foreground">{m.actionProposal.details}</p>
                          <Button
                            size="sm"
                            onClick={() => handleApplyCalendarProposal(m.actionProposal!)}
                            className="rounded-xl h-7 text-xs gap-1 font-medium"
                          >
                            <Calendar className="h-3 w-3" /> Thêm vào Calendar ngay
                          </Button>
                        </div>
                      )}

                      <span className="text-[10px] text-muted-foreground px-1 block">{m.timestamp}</span>
                    </div>
                  </div>
                );
              })}

              {isAiTyping && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground italic animate-pulse p-2">
                  <Bot className="h-4 w-4" /> Study Coach đang suy nghĩ và tính toán ngữ cảnh...
                </div>
              )}
              <div ref={messagesEndRef} />
            </CardContent>

            {/* Chat Input Bar */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-border/60 bg-muted/20 flex gap-2">
              <Input
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Nhắn tin với Study Coach (VD: 'Lên lịch ôn thi Toán', 'Giải thích định lý Pytago')..."
                className="h-10 rounded-xl bg-background text-xs sm:text-sm"
              />
              <Button type="submit" disabled={!inputText.trim() || isAiTyping} className="h-10 px-4 rounded-xl shrink-0">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
