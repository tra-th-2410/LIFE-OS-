'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertCircle, ArrowLeft, Loader2, Mail, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

const REMEMBERED_EMAIL_KEY = 'lifeos-remembered-email';

export default function LoginPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUnconfirmedEmail, setIsUnconfirmedEmail] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    const rememberedEmail = window.localStorage.getItem(REMEMBERED_EMAIL_KEY);
    if (rememberedEmail) setEmail(rememberedEmail);
  }, []);

  useEffect(() => {
    if (!loading && user) router.replace('/app');
  }, [loading, user, router]);

  // Cooldown timer
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsUnconfirmedEmail(false);
    setSubmitting(true);

    try {
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (loginError) {
        const msg = loginError.message.toLowerCase();
        if (msg.includes('confirm') || msg.includes('verified') || msg.includes('not confirmed')) {
          setIsUnconfirmedEmail(true);
          setError('Please confirm your email before signing in.');
          return;
        }
        throw loginError;
      }

      if (rememberMe) window.localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
      else window.localStorage.removeItem(REMEMBERED_EMAIL_KEY);

      router.replace('/app');
    } catch (submissionError: any) {
      const msg = submissionError?.message?.toLowerCase() || '';
      if (msg.includes('confirm') || msg.includes('verified') || msg.includes('not confirmed')) {
        setIsUnconfirmedEmail(true);
        setError('Please confirm your email before signing in.');
      } else {
        setError(submissionError instanceof Error ? submissionError.message : 'Unable to log in.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!email.trim() || cooldown > 0 || resending) return;
    setResending(true);
    try {
      const { error: resendErr } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (resendErr) throw resendErr;
      toast.success(`Đã gửi lại link xác nhận tới ${email.trim()}! Vui lòng kiểm tra hộp thư.`);
      setCooldown(60);
    } catch (err: any) {
      toast.error(err.message || 'Không thể gửi lại email xác nhận.');
    } finally {
      setResending(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (oauthErr) throw oauthErr;
    } catch (err: any) {
      toast.error(err.message || 'Failed to log in with Google');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="absolute inset-0 bg-grid opacity-[0.03]" />
      <div className="absolute -top-40 right-0 h-[400px] w-[400px] rounded-full bg-primary/10 blur-[120px]" />
      <div className="relative w-full max-w-md">
        <Link href="/" className="mb-6 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>
        <Card className="border-border/60 shadow-lg">
          <CardHeader className="space-y-1 text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-bold text-xl">L</div>
            <CardTitle className="text-2xl font-display">Welcome back</CardTitle>
            <CardDescription>Log in to continue to Life OS.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Google OAuth Option */}
            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleLogin}
              className="w-full gap-2 border-border/60 hover:bg-muted/50"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              Continue with Google
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border/60" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or with email</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link href="/forgot-password" className="text-xs font-medium text-primary hover:underline">Forgot password?</Link>
                </div>
                <Input id="password" type="password" placeholder="Your password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" />
              </div>

              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} className="h-4 w-4 rounded border-input accent-primary" />
                Remember me
              </label>

              {error && (
                <div className="rounded-lg bg-destructive/10 p-3.5 text-sm text-destructive space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>

                  {isUnconfirmedEmail && (
                    <div className="pt-2 border-t border-destructive/20">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={handleResendConfirmation}
                        disabled={cooldown > 0 || resending}
                        className="w-full gap-1.5 text-xs font-semibold h-8"
                      >
                        {resending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="h-3.5 w-3.5" />
                        )}
                        {cooldown > 0 ? `Resend confirmation email (${cooldown}s)` : 'Resend confirmation email'}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              <Button type="submit" className="w-full font-semibold" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Log in'}
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="font-medium text-primary hover:underline">Create account</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
