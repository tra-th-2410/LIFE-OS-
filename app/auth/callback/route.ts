import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getRedirectBaseUrl(request: NextRequest): string {
  // 1. Netlify / Vercel forwarded headers
  const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
  if (forwardedHost) {
    if (forwardedHost.includes('localhost') || forwardedHost.includes('127.0.0.1')) {
      return `http://${forwardedHost}`;
    }
    return `${forwardedProto}://${forwardedHost}`;
  }

  // 2. Request URL origin
  try {
    const reqUrl = new URL(request.url);
    if (reqUrl.origin && reqUrl.origin !== 'null') {
      return reqUrl.origin;
    }
  } catch {}

  // 3. Explicit env configuration
  if (process.env.NEXT_PUBLIC_SITE_URL && process.env.NEXT_PUBLIC_SITE_URL.trim()) {
    return process.env.NEXT_PUBLIC_SITE_URL.trim().replace(/\/+$/, '');
  }

  // 4. Fallback production URL
  return 'https://life-os-study.netlify.app';
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const tokenHash = requestUrl.searchParams.get('token_hash');
  const type = requestUrl.searchParams.get('type');
  const baseUrl = getRedirectBaseUrl(request);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(new URL('/login?error=missing_config', baseUrl));
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
        return NextResponse.redirect(new URL('/auth/confirm?verified=true', baseUrl));
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
        return NextResponse.redirect(new URL('/auth/confirm?verified=true', baseUrl));
      }
    } catch (err) {
      console.error('Error verifying token hash OTP:', err);
    }
  }

  // Fallback redirect to confirm page with client-side verification
  return NextResponse.redirect(new URL('/auth/confirm?verified=true', baseUrl));
}
