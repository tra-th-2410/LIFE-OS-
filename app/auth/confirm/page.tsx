'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth-provider';
import { supabase } from '@/lib/supabase';
import { getAuthCallbackUrl } from '@/lib/helpers';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle2, ArrowRight, Loader2, AlertCircle, RotateCcw, Mail } from 'lucide-react';
import { toast } from 'sonner';

function AuthConfirmContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const verifiedParam = searchParams.get('verified') === 'true';
  const { user, loading, refreshProfile } = useAuth();
  const [countdown, setCountdown] = useState(3);

  // Error state
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [resendEmail, setResendEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Check URL hash fragments (e.g. #error=access_denied&error_code=otp_expired...)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      const queryErr = searchParams.get('error') || searchParams.get('error_description');
      const queryErrCode = searchParams.get('error_code');

      if (hash) {
        const hashParams = new URLSearchParams(hash.substring(1));
        const err = hashParams.get('error') || hashParams.get('error_description');
        const errCode = hashParams.get('error_code');

        if (errCode === 'otp_expired' || err?.includes('expired') || err?.includes('invalid')) {
          setHasError(true);
          setErrorMessage('Liên kết xác thực email đã hết hạn hoặc đã được sử dụng trước đó.');
          return;
        }
        if (err) {
          setHasError(true);
          setErrorMessage(decodeURIComponent(err.replace(/\+/g, ' ')));
          return;
        }
      }

      if (queryErrCode === 'otp_expired' || queryErr?.includes('expired') || queryErr?.includes('invalid')) {
        setHasError(true);
        setErrorMessage('Liên kết xác thực email đã hết hạn hoặc đã được sử dụng trước đó.');
        return;
      }
      if (queryErr) {
        setHasError(true);
        setErrorMessage(queryErr);
        return;
      }
    }
  }, [searchParams]);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  useEffect(() => {
    if (!hasError) {
      refreshProfile();
    }
  }, [refreshProfile, hasError]);

  // Auto redirect on success
  useEffect(() => {
    if (!hasError && !loading && (user || verifiedParam)) {
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
  }, [loading, user, verifiedParam, router, hasError]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail.trim() || cooldown > 0 || resending) return;
    setResending(true);

    try {
      const { error: resendErr } = await supabase.auth.resend({
        type: 'signup',
        email: resendEmail.trim(),
        options: {
          emailRedirectTo: getAuthCallbackUrl(),
        },
      });

      if (resendErr) throw resendErr;
      toast.success(`Đã gửi lại link xác nhận tới ${resendEmail.trim()}!`);
      setCooldown(60);
    } catch (err: any) {
      toast.error(err?.message || 'Không thể gửi lại email xác nhận.');
    } finally {
      setResending(false);
    }
  };

  // View 1: Error Screen (e.g. OTP Expired)
  if (hasError) {
    return (
      <Card className="border-border/60 shadow-xl overflow-hidden bg-card/90">
        <div className="h-2 bg-gradient-to-r from-amber-500 via-rose-500 to-red-500" />
        <CardHeader className="space-y-3 text-center pb-2 pt-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-500 ring-8 ring-amber-500/10">
            <AlertCircle className="h-9 w-9" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-xl font-display font-bold text-foreground">
              Liên kết xác nhận đã hết hạn ⚠️
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground leading-relaxed">
              {errorMessage || 'Liên kết email này không còn hiệu lực. Vui lòng nhập email của bạn bên dưới để nhận liên kết mới.'}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-4 pb-8">
          <form onSubmit={handleResend} className="space-y-3">
            <div className="space-y-1.5">
              <Input
                type="email"
                placeholder="Nhập email tài khoản của bạn..."
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                required
                className="h-10 text-xs rounded-xl"
              />
            </div>
            <Button
              type="submit"
              disabled={!resendEmail.trim() || cooldown > 0 || resending}
              className="w-full gap-2 font-medium h-10 text-xs"
            >
              {resending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              {cooldown > 0 ? `Gửi lại sau ${cooldown}s` : 'Gửi lại email xác nhận mới'}
            </Button>
          </form>

          <div className="pt-2 border-t border-border/40 text-center">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground">
                Quay lại trang Đăng nhập
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  // View 2: Success Screen
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
