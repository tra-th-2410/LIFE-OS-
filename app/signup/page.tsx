'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, ArrowLeft, Loader2, Mail, CheckCircle2, RotateCcw } from 'lucide-react';
import { getAuthCallbackUrl } from '@/lib/helpers';
import { toast } from 'sonner';

export default function SignupPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Email confirmation view state
  const [emailSentTo, setEmailSentTo] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!loading && user) router.replace('/app');
  }, [loading, user, router]);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const { data, error: signupError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            username: username.trim(),
            display_name: fullName.trim(),
            full_name: fullName.trim(),
          },
          emailRedirectTo: getAuthCallbackUrl(),
        },
      });

      if (signupError) throw signupError;
      if (!data.user) throw new Error('Unable to create your account.');

      // If active session exists, refresh profile
      if (data.session) {
        await supabase.from('profiles').upsert(
          {
            id: data.user.id,
            username: username.trim(),
            display_name: fullName.trim(),
            full_name: fullName.trim(),
            verification_status: 'basic',
          },
          { onConflict: 'id' }
        );
      }

      // If email confirmation is required (session is null or email not confirmed yet)
      if (!data.session || !data.user.email_confirmed_at) {
        setEmailSentTo(email.trim());
        setCooldown(60);
        return;
      }

      // If instant login (email confirmation disabled in Supabase config)
      router.replace('/app');
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Unable to create your account.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!emailSentTo || cooldown > 0 || resending) return;
    setResending(true);
    try {
      const { error: resendErr } = await supabase.auth.resend({
        type: 'signup',
        email: emailSentTo,
        options: {
          emailRedirectTo: getAuthCallbackUrl(),
        },
      });
      if (resendErr) throw resendErr;
      toast.success(`Đã gửi lại link xác nhận tới ${emailSentTo}!`);
      setCooldown(60);
    } catch (err: any) {
      toast.error(err.message || 'Không thể gửi lại email xác nhận.');
    } finally {
      setResending(false);
    }
  };

  const handleGoogleSignup = async () => {
    try {
      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: getAuthCallbackUrl(),
        },
      });
      if (oauthErr) throw oauthErr;
    } catch (err: any) {
      toast.error(err.message || 'Failed to sign up with Google');
    }
  };

  // View B: "Check your email" confirmation screen
  if (emailSentTo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="absolute inset-0 bg-grid opacity-[0.03]" />
        <div className="absolute -top-40 right-0 h-[400px] w-[400px] rounded-full bg-primary/10 blur-[120px]" />

        <div className="relative w-full max-w-md">
          <Card className="border-border/60 shadow-xl bg-card/90 overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-primary via-blue-500 to-purple-500" />
            <CardHeader className="space-y-3 text-center pt-8 pb-3">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-8 ring-primary/5">
                <Mail className="h-8 w-8" />
              </div>
              <div className="space-y-1.5">
                <CardTitle className="text-2xl font-display font-bold text-foreground">
                  Check your email 📧
                </CardTitle>
                <CardDescription className="text-sm">
                  We&apos;ve sent a confirmation link to your email.
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="space-y-6 pt-2 pb-8 text-center">
              <div className="rounded-xl bg-muted/50 p-4 border border-border/50 text-left space-y-2">
                <p className="text-xs text-muted-foreground">Địa chỉ email nhận liên kết xác nhận:</p>
                <p className="text-sm font-semibold text-foreground break-all">{emailSentTo}</p>
                <p className="text-xs text-muted-foreground pt-1 border-t border-border/40 leading-relaxed">
                  Vui lòng mở hộp thư đến (hoặc thư mục Spam) và nhấn vào liên kết xác nhận để kích hoạt tài khoản Life OS của bạn.
                </p>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={handleResendConfirmation}
                  disabled={cooldown > 0 || resending}
                  variant="outline"
                  className="w-full gap-2 font-medium"
                >
                  {resending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4" />
                  )}
                  {cooldown > 0 ? `Resend confirmation email (${cooldown}s)` : 'Resend confirmation email'}
                </Button>

                <Link href="/login" className="block w-full">
                  <Button variant="ghost" className="w-full text-muted-foreground hover:text-foreground">
                    Back to Sign in
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // View A: Signup Form
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="absolute inset-0 bg-grid opacity-[0.03]" />
      <div className="relative w-full max-w-md">
        <Link href="/" className="mb-6 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>
        <Card className="border-border/60 shadow-lg">
          <CardHeader className="space-y-1 text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-bold text-xl">L</div>
            <CardTitle className="text-2xl font-display">Create your account</CardTitle>
            <CardDescription>Start using Life OS today.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Google OAuth Option */}
            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleSignup}
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
                <Label htmlFor="full-name">Full name</Label>
                <Input id="full-name" value={fullName} onChange={(event) => setFullName(event.target.value)} required autoComplete="name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input id="username" value={username} onChange={(event) => setUsername(event.target.value.replace(/[^a-zA-Z0-9_]/g, ''))} required minLength={3} maxLength={20} autoComplete="username" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} autoComplete="new-password" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm password</Label>
                <Input id="confirm-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={6} autoComplete="new-password" />
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button type="submit" className="w-full font-semibold" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create account'}
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link href="/login" className="font-medium text-primary hover:underline">Log in</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
