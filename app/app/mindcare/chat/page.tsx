'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { createMindCareConversation, getMindCareConversations } from '@/lib/mindcare-db';

export default function MindCareChatRedirect() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/login');
      return;
    }

    async function init() {
      if (!user) return;
      try {
        const convs = await getMindCareConversations(user.id);
        if (convs.length > 0) {
          router.replace(`/app/mindcare/${convs[0].id}`);
        } else {
          const newConv = await createMindCareConversation(user.id);
          router.replace(`/app/mindcare/${newConv.id}`);
        }
      } catch {
        router.replace('/app/mindcare');
      }
    }

    init();
  }, [user, loading, router]);

  return (
    <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-muted-foreground text-xs">
        <div className="h-10 w-10 rounded-2xl bg-primary/15 flex items-center justify-center animate-pulse text-lg">
          🧠
        </div>
        <span>Đang kết nối cùng MindCare...</span>
      </div>
    </div>
  );
}
