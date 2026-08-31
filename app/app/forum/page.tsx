'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ForumRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/app/community?tab=forum');
  }, [router]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}
