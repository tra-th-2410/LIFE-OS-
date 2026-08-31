'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, ArrowRight, Loader2 } from 'lucide-react';

function AuthConfirmContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const verifiedParam = searchParams.get('verified') === 'true';
  const { user, loading, refreshProfile } = useAuth();
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  useEffect(() => {
    if (!loading && (user || verifiedParam)) {
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            router.replace('/app');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [loading, user, verifiedParam, router]);

  return (
    <Card className="border-border/60 shadow-xl overflow-hidden bg-card/90">
      <div className="h-2 bg-gradient-to-r from-emerald-500 via-primary to-blue-500" />
      <CardHeader className="space-y-3 text-center pb-2 pt-8">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-500 ring-8 ring-emerald-500/10">
          <CheckCircle2 className="h-9 w-9" />
        </div>
        <div className="space-y-1">
          <CardTitle className="text-2xl font-display font-bold text-foreground">
            Email verified successfully! ✅
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Tài khoản của bạn đã được xác thực email thành công. Chào mừng bạn đến với Life OS!
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-4 pb-8 text-center">
        <div className="rounded-xl bg-muted/40 p-4 border border-border/50 space-y-1">
          <p className="text-xs text-muted-foreground">
            Tự động chuyển hướng vào Life OS sau <span className="font-bold text-primary">{countdown}s</span>...
          </p>
        </div>

        <div className="space-y-2">
          <Link href="/app" className="block w-full">
            <Button className="w-full gap-2 font-semibold shadow-md h-11 text-base">
              Tiếp tục vào Life OS <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AuthConfirmPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="absolute inset-0 bg-grid opacity-[0.03]" />
      <div className="absolute -top-40 right-0 h-[400px] w-[400px] rounded-full bg-primary/10 blur-[120px]" />

      <div className="relative w-full max-w-md">
        <Suspense
          fallback={
            <Card className="border-border/60 shadow-xl p-8 flex flex-col items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </Card>
          }
        >
          <AuthConfirmContent />
        </Suspense>
      </div>
    </div>
  );
}
