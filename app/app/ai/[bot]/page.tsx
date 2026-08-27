'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Send, Loader2, Sparkles } from 'lucide-react';
import { AI_BOTS, generateAiResponse } from '@/lib/ai';
import type { BotType, AiMessage } from '@/lib/types';
import { formatRelativeTime } from '@/lib/helpers';
import { ChatMessageRenderer } from '@/components/chat-message-renderer';

const LEARNING_ACTIONS = ['Explain', 'Solve', 'Quiz Me', 'Summarize'];
const WRITING_ACTIONS = ['Improve Writing', 'Fix Grammar', 'Paraphrase', 'IELTS Review'];
const PROJECT_ACTIONS = ['Build Project', 'Brainstorm', 'Create Plan', 'Prepare Presentation'];
const CAREER_ACTIONS = ['Explore Career', 'Compare Majors', 'Build Roadmap', 'Practice Interview'];

const ACTION_PROMPTS: Record<string, string> = {
  Explain: 'Explain this concept in detail with examples.',
  Solve: 'Help me solve this step by step.',
  'Quiz Me': 'Quiz me on this topic.',
  Summarize: 'Summarize the key points of this topic.',
  'Improve Writing': 'Improve the writing of this text.',
  'Fix Grammar': 'Fix the grammar in this text and explain the errors.',
  Paraphrase: 'Paraphrase this text in a more natural way.',
  'IELTS Review': 'Review this as an IELTS Writing Task 2 and estimate the band.',
  'Build Project': 'Help me build this project step by step.',
  Brainstorm: 'Brainstorm project ideas based on this.',
  'Create Plan': 'Create a project plan with timeline and tasks.',
  'Prepare Presentation': 'Help me prepare a presentation for this project.',
  'Explore Career': 'Help me explore career options related to this.',
  'Compare Majors': 'Compare university majors related to this.',
  'Build Roadmap': 'Build a preparation roadmap for this goal.',
  'Practice Interview': 'Practice an interview with me, one question at a time.',
  'Start Quiz': 'Quiz me on the questions above',
  'Show Answers': 'Show answers',
  'Make Harder': 'Make this harder',
  'New Questions': 'Create 5 new practice questions',
  'Create Practice Questions': 'Create 5 practice questions',
};

function getActionsForBot(botType: BotType): string[] {
  if (botType === 'learning') return LEARNING_ACTIONS;
  if (botType === 'writing') return WRITING_ACTIONS;
  if (botType === 'project') return PROJECT_ACTIONS;
  if (botType === 'career') return CAREER_ACTIONS;
  return [];
}

const INLINE_ACTION_BUTTONS = ['Start Quiz', 'Show Answers', 'Make Harder', 'New Questions', 'Quiz Me', 'Create Practice Questions'];

function extractInlineActions(content: string): string[] {
  const actions: string[] = [];
  for (const action of INLINE_ACTION_BUTTONS) {
    if (content.includes(`[${action}]`)) actions.push(action);
  }
  return actions;
}

function stripActionMarkers(content: string): string {
  return content.replace(/\*\*\[([^\]]+)\]\*\*/g, '').replace(/\[([^\]]+)\]/g, '$1').trim();
}

export default function AiChatPage() {
  const params = useParams();
  const botType = params.bot as BotType;
  const { user } = useAuth();
  const bot = AI_BOTS[botType];

  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const botActions = getActionsForBot(botType);

  const loadConversation = useCallback(async () => {
    if (!user || !bot) return;
    const { data: conv } = await supabase
      .from('ai_conversations')
      .select('*')
      .eq('user_id', user.id)
      .eq('bot_type', botType)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (conv) {
      setConversationId(conv.id);
      const { data: msgs } = await supabase
        .from('ai_messages')
        .select('*')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: true });
      setMessages((msgs as AiMessage[]) ?? []);
    } else {
      const { data: newConv } = await supabase
        .from('ai_conversations')
        .insert({ user_id: user.id, bot_type: botType, title: bot?.name })
        .select()
        .single();
      if (newConv) setConversationId(newConv.id);
    }
    setLoading(false);
  }, [user, botType, bot]);

  useEffect(() => {
    loadConversation();
  }, [loadConversation]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!user || !conversationId || !text.trim()) return;
      setSending(true);
      setError(null);

      const userMessage = text;
      setInput('');

      const { data: userMsg } = await supabase
        .from('ai_messages')
        .insert({ conversation_id: conversationId, role: 'user', content: userMessage })
        .select()
        .single();
      if (userMsg) setMessages((prev) => [...prev, userMsg as AiMessage]);

      try {
        const allMessages = [...messages, { role: 'user', content: userMessage }];
        const { data: session } = await supabase.auth.getSession();
        const response = await generateAiResponse(botType, allMessages, session?.session?.access_token);

        const { data: aiMsg } = await supabase
          .from('ai_messages')
          .insert({ conversation_id: conversationId, role: 'assistant', content: response })
          .select()
          .single();
        if (aiMsg) setMessages((prev) => [...prev, aiMsg as AiMessage]);
      } catch (err) {
        const vi = /[à-ỹđ]/i.test(userMessage);
        const rawMsg = err instanceof Error ? err.message : String(err);
        const isKeyMissing = rawMsg.includes('GEMINI_API_KEY') || rawMsg.includes('not configured');
        const errorMsg = isKeyMissing
          ? (vi ? 'Dịch vụ AI chưa được cấu hình. Vui lòng liên hệ quản trị viên để thêm Gemini API key.' : 'AI service is not configured. Please contact the administrator to add a Gemini API key.')
          : (vi ? 'Có lỗi xảy ra khi tạo câu trả lời. Vui lòng thử lại.' : 'Something went wrong while generating the response. Please try again.');
        setError(errorMsg);
        setMessages((prev) => [
          ...prev,
          { id: `error-${Date.now()}`, conversation_id: conversationId, role: 'assistant', content: errorMsg, created_at: new Date().toISOString() },
        ]);
      } finally {
        setSending(false);
      }
    },
    [user, conversationId, messages, botType]
  );

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    await sendMessage(input);
  };

  const handleAction = async (action: string) => {
    await sendMessage(ACTION_PROMPTS[action] ?? action);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e as unknown as React.FormEvent);
    }
  };

  if (!bot) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <p className="text-lg font-medium">AI bot not found</p>
        <Link href="/app/ai" className="mt-4 inline-block">
          <Button variant="outline">Back to AI Center</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto h-[calc(100vh-8rem)] lg:h-[calc(100vh-10rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-border/60">
        <Link href="/app/ai" className="p-2 -ml-2 hover:bg-muted rounded-lg transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-xl">
          {bot.icon}
        </div>
        <div>
          <h1 className="font-semibold">{bot.name}</h1>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> AI Assistant
          </p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin space-y-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-3xl mb-4">
              {bot.icon}
            </div>
            <p className="text-sm text-muted-foreground max-w-sm">{bot.greeting}</p>
            <div className="mt-6 grid grid-cols-1 gap-2 w-full max-w-sm">
              {bot.suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="text-left text-sm rounded-lg border border-border/60 p-3 hover:bg-muted hover:border-primary/30 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const inlineActions = msg.role === 'assistant' ? extractInlineActions(msg.content) : [];
            const displayContent = msg.role === 'assistant' ? stripActionMarkers(msg.content) : msg.content;
            return (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}>
                  {msg.role === 'assistant' ? (
                    <ChatMessageRenderer content={displayContent} />
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{displayContent}</p>
                  )}
                  {inlineActions.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {inlineActions.map((action) => (
                        <button
                          key={action}
                          onClick={() => handleAction(action)}
                          disabled={sending}
                          className="text-xs rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                        >
                          {action}
                        </button>
                      ))}
                    </div>
                  )}
                  <p className={`text-[10px] mt-1 ${msg.role === 'user' ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                    {formatRelativeTime(msg.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl px-4 py-2.5">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
        {error && (
          <div className="flex justify-center">
            <p className="text-xs text-destructive">{error}</p>
          </div>
        )}
      </div>

      {/* Bot action buttons */}
      {botActions.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2">
          {botActions.map((action) => (
            <button
              key={action}
              onClick={() => handleAction(action)}
              disabled={sending}
              className="text-xs rounded-full border border-border/60 bg-muted/50 px-3 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
            >
              {action}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSend} className="flex gap-2 pt-4 border-t border-border/60">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Message ${bot.name}...`}
          rows={1}
          className="min-h-[40px] max-h-32 resize-none"
          onKeyDown={handleKeyDown}
        />
        <Button type="submit" size="icon" className="shrink-0 h-10 w-10" disabled={sending || !input.trim()}>
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}
