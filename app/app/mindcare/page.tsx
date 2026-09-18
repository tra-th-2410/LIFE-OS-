'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { useLanguage } from '@/components/language-provider';
import { Button } from '@/components/ui/button';
import {
  MessageCircle,
  PenLine,
  Sparkles,
  HeartHandshake,
  Trash2,
  ChevronRight,
  Shield,
  Loader2,
  Clock,
} from 'lucide-react';
import {
  getMindCareConversations,
  createMindCareConversation,
  deleteMindCareConversation,
  getMindCareMemories,
} from '@/lib/mindcare-db';
import type { MindCareConversation, MindCareMemory } from '@/lib/mindcare-types';
import { formatRelativeTime } from '@/lib/helpers';
import { SafetyModal } from '@/components/mindcare/safety-modal';
import { MemoryDrawer } from '@/components/mindcare/memory-drawer';
import { toast } from 'sonner';

const CONVERSATION_STARTERS = [
  { text: '💭 Mình đang thấy hơi mệt...', textEn: '💭 I am feeling a bit tired...' },
  { text: '😔 Có một chuyện làm mình buồn.', textEn: '😔 Something made me sad today.' },
  { text: '📚 Mình đang bị áp lực học tập.', textEn: '📚 I am overwhelmed with study pressure.' },
  { text: '🫂 Mình muốn kể một chuyện.', textEn: '🫂 I just want to talk about something.' },
  { text: '🌧️ Hôm nay thật sự không ổn.', textEn: '🌧️ Today was really tough.' },
];

export default function MindCareHomePage() {
  const router = useRouter();
  const { user } = useAuth();
  const { language } = useLanguage();
  const isVi = language === 'vi';

  const [conversations, setConversations] = useState<MindCareConversation[]>([]);
  const [memories, setMemories] = useState<MindCareMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const [convs, mems] = await Promise.all([
        getMindCareConversations(user.id),
        getMindCareMemories(user.id),
      ]);
      setConversations(convs);
      setMemories(mems);
    } catch {
      // Handled gracefully
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleStartChat = async (initialText?: string) => {
    if (!user || creating) return;
    setCreating(true);
    try {
      const title = initialText
        ? initialText.replace(/^[^\w\s\u00C0-\u1EF9]+/, '').trim().slice(0, 35)
        : isVi
        ? 'Cuộc trò chuyện mới'
        : 'New conversation';

      const conv = await createMindCareConversation(user.id, title);

      // Save initial draft if provided so the chat page can load it
      if (initialText && typeof window !== 'undefined') {
        sessionStorage.setItem(`mindcare_draft_${conv.id}`, initialText);
      }

      router.push(`/app/mindcare/${conv.id}`);
    } catch {
      toast.error(isVi ? 'Chưa thể tạo cuộc trò chuyện' : 'Could not create conversation');
      setCreating(false);
    }
  };

  const handleDeleteConv = async (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    if (!user) return;
    try {
      await deleteMindCareConversation(convId, user.id);
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      toast.success(isVi ? 'Đã xóa cuộc trò chuyện' : 'Conversation deleted');
    } catch {
      toast.error(isVi ? 'Không thể xóa cuộc trò chuyện' : 'Could not delete conversation');
    }
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] flex flex-col justify-between max-w-2xl mx-auto px-4 py-8 md:py-12 animate-fade-in">
      {/* Top utility row: Memories & Emergency help */}
      <div className="flex items-center justify-between gap-2 pb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMemoryOpen(true)}
          className="text-xs text-muted-foreground hover:text-foreground gap-1.5 h-8 px-2.5 rounded-xl transition-colors"
        >
          <Sparkles className="h-3.5 w-3.5 text-purple-500" />
          <span>
            {isVi ? 'Ký ức đã lưu' : 'Memories'}
            {memories.length > 0 && ` (${memories.length})`}
          </span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSafetyOpen(true)}
          className="text-xs text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400 gap-1.5 h-8 px-2.5 rounded-xl transition-colors"
        >
          <HeartHandshake className="h-3.5 w-3.5 text-amber-500" />
          <span>{isVi ? 'Hỗ trợ khẩn cấp' : 'Crisis Support'}</span>
        </Button>
      </div>

      {/* Hero Section */}
      <div className="text-center my-auto space-y-6 py-6">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-3xl bg-primary/10 text-primary shadow-sm ring-8 ring-primary/5">
          <span className="text-3xl select-none">🧠</span>
        </div>

        <div className="space-y-2.5">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary/80">
            MindCare AI
          </p>
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-foreground tracking-tight">
            {isVi ? 'Mình đang lắng nghe.' : "I'm listening."}
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground max-w-md mx-auto leading-relaxed">
            {isVi
              ? 'Bạn có thể kể cho mình bất cứ điều gì. Không cần phải sắp xếp suy nghĩ trước.'
              : 'You can tell me anything. No need to organize your thoughts first.'}
          </p>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Button
            size="lg"
            onClick={() => handleStartChat()}
            disabled={creating}
            className="w-full sm:w-auto h-12 px-6 rounded-2xl text-sm font-medium gap-2 shadow-sm transition-all hover:scale-[1.01] active:scale-[0.99]"
          >
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MessageCircle className="h-4 w-4" />
            )}
            <span>{isVi ? '💬 Nói chuyện với MindCare' : '💬 Talk with MindCare'}</span>
          </Button>

          <Button
            variant="outline"
            size="lg"
            onClick={() => handleStartChat(isVi ? 'Mình muốn viết ra những gì đang nghĩ...' : 'I want to write down what I am thinking...')}
            disabled={creating}
            className="w-full sm:w-auto h-12 px-6 rounded-2xl text-sm font-medium gap-2 border-border/80 hover:bg-muted/50 transition-all hover:scale-[1.01] active:scale-[0.99]"
          >
            <PenLine className="h-4 w-4 text-muted-foreground" />
            <span>{isVi ? '📖 Viết điều bạn đang nghĩ' : '📖 Write what you feel'}</span>
          </Button>
        </div>

        {/* Gentle Quote */}
        <p className="text-xs text-muted-foreground/75 italic font-serif pt-1">
          {isVi
            ? '“Bạn không cần phải ổn mọi lúc.”'
            : '"You don’t have to be okay all the time."'}
        </p>
      </div>

      {/* Gentle Conversation Starters */}
      <div className="space-y-3 pt-4">
        <p className="text-xs text-center text-muted-foreground/70 font-medium">
          {isVi ? 'Hoặc bắt đầu nhẹ nhàng với một gợi ý:' : 'Or gently start with a prompt:'}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {CONVERSATION_STARTERS.map((starter, i) => {
            const label = isVi ? starter.text : starter.textEn;
            return (
              <button
                key={i}
                onClick={() => handleStartChat(label)}
                disabled={creating}
                className="px-3.5 py-2 rounded-xl text-xs font-normal border border-border/60 bg-card/60 text-foreground hover:bg-muted/80 hover:border-primary/40 transition-all shadow-2xs hover:shadow-xs active:scale-98 text-left"
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Recent Conversations (Clean & Discreet) */}
      {conversations.length > 0 && (
        <div className="mt-10 pt-6 border-t border-border/40 space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              {isVi ? 'Cuộc trò chuyện gần đây' : 'Recent conversations'}
            </span>
          </div>

          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {conversations.slice(0, 4).map((conv) => (
              <div
                key={conv.id}
                onClick={() => router.push(`/app/mindcare/${conv.id}`)}
                className="group flex items-center justify-between p-3 rounded-xl border border-border/50 bg-card hover:bg-muted/40 cursor-pointer transition-all hover:border-border"
              >
                <div className="min-w-0 pr-3">
                  <p className="text-xs font-medium text-foreground truncate">
                    {conv.title}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {formatRelativeTime(conv.updated_at)}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={(e) => handleDeleteConv(e, conv.id)}
                    className="h-7 w-7 text-muted-foreground/60 hover:text-red-500 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    title={isVi ? 'Xóa' : 'Delete'}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-foreground transition-colors" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer reassurance */}
      <div className="text-center pt-8">
        <p className="text-[11px] text-muted-foreground/60 flex items-center justify-center gap-1">
          <Shield className="h-3 w-3 inline" />
          {isVi
            ? 'Không gian trò chuyện an toàn, thấu cảm và hoàn toàn riêng tư.'
            : 'A safe, empathetic, and entirely private space for you.'}
        </p>
      </div>

      {/* Modals */}
      <SafetyModal open={safetyOpen} onOpenChange={setSafetyOpen} />
      {user && (
        <MemoryDrawer
          open={memoryOpen}
          onOpenChange={setMemoryOpen}
          memories={memories}
          userId={user.id}
          onMemoryDeleted={(id) =>
            setMemories((prev) => prev.filter((m) => m.id !== id))
          }
        />
      )}
    </div>
  );
}
