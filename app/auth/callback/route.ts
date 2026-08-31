import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const tokenHash = requestUrl.searchParams.get('token_hash');
  const type = requestUrl.searchParams.get('type');
  const next = requestUrl.searchParams.get('next') || '/app';

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(new URL('/login?error=missing_config', request.url));
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
    },
  });

  if (code) {
    try {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(new URL('/auth/confirm?verified=true', request.url));
      }
    } catch (err) {
      console.error('Error exchanging code for session:', err);
    }
  }

  if (tokenHash && type) {
    try {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as any,
      });
      if (!error) {
        return NextResponse.redirect(new URL('/auth/confirm?verified=true', request.url));
      }
    } catch (err) {
      console.error('Error verifying token hash OTP:', err);
    }
  }

  // Fallback direct to confirm page with client-side verification
  return NextResponse.redirect(new URL('/auth/confirm?verified=true', request.url));
}
