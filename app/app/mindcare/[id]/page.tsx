'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth-provider';
import { useLanguage } from '@/components/language-provider';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowLeft,
  Send,
  Plus,
  Sparkles,
  HeartHandshake,
  Shield,
  Loader2,
} from 'lucide-react';
import {
  getMindCareConversation,
  getMindCareMessages,
  addMindCareMessage,
  updateMindCareConversationTitle,
  getMindCareMemories,
  addMindCareMemory,
  createMindCareConversation,
} from '@/lib/mindcare-db';
import {
  sendMindCareMessage,
  isCrisisSituation,
  detectMemoryCandidate,
} from '@/lib/mindcare';
import type {
  MindCareConversation,
  MindCareMessage,
  MindCareMemory,
} from '@/lib/mindcare-types';
import { MindCareMessageItem } from '@/components/mindcare/mindcare-message';
import { SafetyModal } from '@/components/mindcare/safety-modal';
import { MemoryDrawer } from '@/components/mindcare/memory-drawer';
import { toast } from 'sonner';

const QUICK_STARTERS = [
  '💭 Mình đang thấy hơi mệt...',
  '😔 Có một chuyện làm mình buồn.',
  '📚 Mình đang bị áp lực học tập.',
  '🫂 Mình muốn kể một chuyện.',
  '🌧️ Hôm nay thật sự không ổn.',
];

export default function MindCareChatPage() {
  const params = useParams();
  const convId = params.id as string;
  const router = useRouter();
  const { user } = useAuth();
  const { language } = useLanguage();
  const isVi = language === 'vi';

  const [conversation, setConversation] = useState<MindCareConversation | null>(null);
  const [messages, setMessages] = useState<MindCareMessage[]>([]);
  const [memories, setMemories] = useState<MindCareMemory[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback((smooth = true) => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto',
      });
    }
  }, []);

  const loadData = useCallback(async () => {
    if (!user || !convId) return;
    try {
      const [conv, msgs, mems] = await Promise.all([
        getMindCareConversation(convId, user.id),
        getMindCareMessages(convId, user.id),
        getMindCareMemories(user.id),
      ]);

      if (!conv) {
        // If conversation not found, navigate back to MindCare home
        router.push('/app/mindcare');
        return;
      }

      setConversation(conv);
      setMessages(msgs);
      setMemories(mems);

      // Check if there was a draft text saved from home
      if (typeof window !== 'undefined') {
        const draft = sessionStorage.getItem(`mindcare_draft_${convId}`);
        if (draft) {
          sessionStorage.removeItem(`mindcare_draft_${convId}`);
          setInput(draft);
        }
      }
    } catch {
      toast.error(isVi ? 'Không thể tải cuộc trò chuyện' : 'Failed to load conversation');
    } finally {
      setLoading(false);
    }
  }, [user, convId, router, isVi]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    scrollToBottom(false);
  }, [messages, scrollToBottom]);

  // Adjust textarea height automatically
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        140
      )}px`;
    }
  }, [input]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || !user || !convId || sending) return;

    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    const isCrisis = isCrisisSituation(text);

    // If crisis situation is triggered, open safety card/modal
    if (isCrisis) {
      setSafetyOpen(true);
    }

    // 1. Optimistic user message
    const userMsg: MindCareMessage = {
      id: `tmp_${Date.now()}`,
      conversation_id: convId,
      user_id: user.id,
      role: 'user',
      content: text,
      is_safety_triggered: isCrisis,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setSending(true);
    setTimeout(() => scrollToBottom(true), 50);

    try {
      // 2. Persist user message
      await addMindCareMessage({
        conversation_id: convId,
        user_id: user.id,
        role: 'user',
        content: text,
        is_safety_triggered: isCrisis,
      });

      // If this is the first message, update conversation title
      if (messages.length === 0) {
        const cleanTitle = text.slice(0, 32);
        updateMindCareConversationTitle(convId, user.id, cleanTitle).then(() => {
          setConversation((c) => (c ? { ...c, title: cleanTitle } : null));
        });
      }

      // 3. Memory detection
      const memCandidate = detectMemoryCandidate(text);
      if (memCandidate) {
        addMindCareMemory(user.id, memCandidate.keyPoint, memCandidate.category).then(
          (newMem) => {
            setMemories((prev) => [newMem, ...prev]);
          }
        );
      }

      // 4. Send to MindCare AI Companion
      const historyForAi = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const { content: aiText, isCrisis: aiCrisis } = await sendMindCareMessage({
        messages: historyForAi,
        memories,
      });

      // 5. Persist assistant response
      const savedAiMsg = await addMindCareMessage({
        conversation_id: convId,
        user_id: user.id,
        role: 'assistant',
        content: aiText,
        is_safety_triggered: isCrisis || aiCrisis,
      });

      setMessages((prev) => [...prev, savedAiMsg]);
    } catch (err) {
      console.error('[MindCare Chat] Error sending message:', err);
      toast.error(
        isVi
          ? 'Đã xảy ra sự cố khi gửi tin nhắn. Bạn vui lòng thử lại nhé.'
          : 'An error occurred sending your message. Please try again.'
      );
    } finally {
      setSending(false);
      setTimeout(() => scrollToBottom(true), 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCreateNewConv = async () => {
    if (!user || sending) return;
    try {
      const newConv = await createMindCareConversation(
        user.id,
        isVi ? 'Cuộc trò chuyện mới' : 'New conversation'
      );
      router.push(`/app/mindcare/${newConv.id}`);
    } catch {
      toast.error(isVi ? 'Không thể tạo phiên mới' : 'Could not create new session');
    }
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground text-xs">
          <div className="h-10 w-10 rounded-2xl bg-primary/15 flex items-center justify-center animate-pulse text-lg">
            🧠
          </div>
          <span>{isVi ? 'Đang mở không gian tâm sự...' : 'Opening your space...'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-6.5rem)] -mx-4 -my-4 sm:-mx-6 sm:-my-6 lg:-mx-8 lg:-my-8 bg-background">
      {/* Header (Minimal, Warm, Private) */}
      <div className="sticky top-0 z-20 flex h-14 items-center justify-between px-4 sm:px-6 bg-background/90 backdrop-blur-md border-b border-border/70">
        <div className="flex items-center gap-3">
          <Link href="/app/mindcare">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted"
              title={isVi ? 'Về trang MindCare' : 'Back to MindCare'}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>

          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary text-sm shadow-2xs select-none">
              🧠
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground leading-none">
                MindCare
              </h2>
              <div className="flex items-center gap-1 mt-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] text-muted-foreground/80 leading-none">
                  {isVi ? 'Đang lắng nghe bạn' : 'Listening with care'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-1 sm:gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMemoryOpen(true)}
            className="h-8 px-2 sm:px-2.5 rounded-xl text-xs text-muted-foreground hover:text-purple-600 dark:hover:text-purple-400 gap-1.5"
            title={isVi ? 'Xem ký ức cá nhân' : 'View memories'}
          >
            <Sparkles className="h-3.5 w-3.5 text-purple-500" />
            <span className="hidden sm:inline">
              {isVi ? 'Ký ức' : 'Memories'}
              {memories.length > 0 && ` (${memories.length})`}
            </span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSafetyOpen(true)}
            className="h-8 px-2 sm:px-2.5 rounded-xl text-xs text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400 gap-1.5"
            title={isVi ? 'Đường dây khẩn cấp' : 'Emergency Hotlines'}
          >
            <HeartHandshake className="h-3.5 w-3.5 text-amber-500" />
            <span className="hidden sm:inline">{isVi ? 'Cứu trợ' : 'Crisis'}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleCreateNewConv}
            className="h-8 px-2.5 rounded-xl text-xs gap-1.5 border-border/80"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{isVi ? 'Phiên mới' : 'New chat'}</span>
          </Button>
        </div>
      </div>

      {/* Message Stream */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 space-y-5 scrollbar-thin"
      >
        {messages.length === 0 ? (
          /* Empty state */
          <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto py-12 space-y-5 animate-fade-in">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary text-2xl shadow-xs">
              🧠
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-semibold text-foreground">
                {isVi
                  ? 'Chúng ta có thể bắt đầu từ bất cứ điều gì.'
                  : 'We can start from anything.'}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {isVi
                  ? '💬 Hôm nay có chuyện gì khiến bạn muốn tìm đến đây?'
                  : '💬 What happened today that brought you here?'}
              </p>
            </div>

            {/* Quick Starters */}
            <div className="w-full space-y-2 pt-2">
              {QUICK_STARTERS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(s)}
                  className="w-full text-left px-4 py-2.5 rounded-xl border border-border/60 bg-card/60 hover:bg-muted/60 hover:border-primary/40 text-xs text-foreground transition-all shadow-2xs"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <MindCareMessageItem
              key={m.id}
              role={m.role}
              content={m.content}
              isSafetyTriggered={m.is_safety_triggered}
              onOpenSafetyModal={() => setSafetyOpen(true)}
            />
          ))
        )}

        {/* Soft Listening Indicator */}
        {sending && (
          <div className="flex items-center gap-2 pl-1 max-w-2xl mx-auto animate-fade-in">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs shadow-2xs">
              🧠
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-card border border-border/60 shadow-2xs">
              <div className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" />
              </div>
              <span className="text-xs text-muted-foreground italic font-normal">
                {isVi ? 'MindCare đang lắng nghe...' : 'MindCare is listening...'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Input Area (Sticky Bottom & Mobile Friendly) */}
      <div className="sticky bottom-0 z-20 bg-background/95 backdrop-blur-md border-t border-border/70 p-3 sm:p-4">
        <div className="max-w-2xl mx-auto space-y-2">
          <div className="relative flex items-end gap-2 rounded-2xl border border-border bg-card p-1.5 shadow-sm focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isVi
                  ? 'Chia sẻ bất cứ điều gì bạn đang nghĩ... (Shift+Enter để xuống dòng)'
                  : 'Share whatever is on your mind... (Shift+Enter for newline)'
              }
              rows={1}
              className="min-h-[42px] max-h-[140px] resize-none border-0 bg-transparent px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none leading-relaxed"
            />
            <Button
              size="icon"
              onClick={() => handleSend()}
              disabled={!input.trim() || sending}
              className="h-9 w-9 rounded-xl shrink-0 transition-all mb-0.5"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Calming, Non-Clinical Disclaimer */}
          <div className="flex items-center justify-between text-[11px] text-muted-foreground/60 px-1">
            <span className="truncate">
              {isVi
                ? 'MindCare là người bạn đồng hành lắng nghe, không thay thế trị liệu chuyên môn.'
                : 'MindCare is a compassionate companion, not a substitute for therapy.'}
            </span>
            <button
              onClick={() => setSafetyOpen(true)}
              className="hover:text-amber-600 dark:hover:text-amber-400 underline underline-offset-2 shrink-0 ml-2"
            >
              {isVi ? 'Cần giúp đỡ khẩn cấp?' : 'Need urgent help?'}
            </button>
          </div>
        </div>
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
