'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, ArrowLeft, Check, Loader2 } from 'lucide-react';
import { getResetPasswordUrl } from '@/lib/helpers';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getResetPasswordUrl(),
      });
      if (resetError) throw resetError;
      setSent(true);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Unable to send the reset email.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="absolute inset-0 bg-grid opacity-[0.03]" />
      <div className="relative w-full max-w-md">
        <Link href="/login" className="mb-6 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to login
        </Link>
        <Card className="border-border/60 shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-display">Forgot password?</CardTitle>
            <CardDescription>Enter your email and we&apos;ll send you a secure reset link.</CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="space-y-4 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success"><Check className="h-6 w-6" /></div>
                <p className="text-sm text-muted-foreground">Check your inbox for the password reset email. The link will take you back here to choose a new password.</p>
                <Link href="/login"><Button variant="outline" className="w-full">Back to login</Button></Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
                </div>
                {error && <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"><AlertCircle className="h-4 w-4 shrink-0" /><span>{error}</span></div>}
                <Button type="submit" className="w-full" disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send reset email'}</Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
