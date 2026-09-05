import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSiteUrl, isAllowedHost, PRODUCTION_SITE_URL } from '@/lib/helpers';

function getRedirectBaseUrl(request: NextRequest): string {
  const isProd = process.env.NODE_ENV === 'production';

  // 1. Explicit env configuration (if valid and not an obsolete domain)
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_URL || process.env.SITE_URL;
  if (envUrl && envUrl.trim()) {
    const cleanEnv = envUrl.trim().replace(/\/+$/, '');
    if (isAllowedHost(cleanEnv, isProd)) {
      return cleanEnv;
    }
  }

  // 2. Netlify / Vercel forwarded headers
  const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
  if (forwardedHost && isAllowedHost(forwardedHost, isProd)) {
    // If running in development on localhost/127.0.0.1
    if (!isProd && (forwardedHost.includes('localhost') || forwardedHost.includes('127.0.0.1'))) {
      return `http://${forwardedHost}`;
    }
    return `${forwardedProto}://${forwardedHost}`;
  }

  // 3. Request URL origin (validated)
  try {
    const reqUrl = new URL(request.url);
    if (reqUrl.origin && reqUrl.origin !== 'null' && isAllowedHost(reqUrl.origin, isProd)) {
      return reqUrl.origin;
    }
  } catch {}

  // 4. Fallback: helper-resolved site URL (which guarantees production fallback)
  const helperUrl = getSiteUrl();
  if (helperUrl && isAllowedHost(helperUrl, isProd)) {
    return helperUrl;
  }

  // 5. Default production fallback URL
  return PRODUCTION_SITE_URL;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const tokenHash = requestUrl.searchParams.get('token_hash');
  const type = requestUrl.searchParams.get('type');
  const error = requestUrl.searchParams.get('error');
  const errorCode = requestUrl.searchParams.get('error_code');
  const errorDescription = requestUrl.searchParams.get('error_description');
  const baseUrl = getRedirectBaseUrl(request);

  // If Supabase returned an error query parameter (e.g. otp_expired, access_denied)
  if (error || errorCode || errorDescription) {
    const confirmUrl = new URL('/auth/confirm', baseUrl);
    if (error) confirmUrl.searchParams.set('error', error);
    if (errorCode) confirmUrl.searchParams.set('error_code', errorCode);
    if (errorDescription) confirmUrl.searchParams.set('error_description', errorDescription);
    return NextResponse.redirect(confirmUrl);
  }

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

  // Handle PKCE code exchange
  if (code) {
    try {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (!exchangeError) {
        return NextResponse.redirect(new URL('/auth/confirm?verified=true', baseUrl));
      } else {
        console.error('Error exchanging code for session:', exchangeError);
        const confirmUrl = new URL('/auth/confirm', baseUrl);
        confirmUrl.searchParams.set('error', exchangeError.message);
        confirmUrl.searchParams.set('error_code', (exchangeError as any).code || 'auth_error');
        return NextResponse.redirect(confirmUrl);
      }
    } catch (err: any) {
      console.error('Exception exchanging code for session:', err);
    }
  }

  // Handle token_hash verification
  if (tokenHash && type) {
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as any,
      });
      if (!verifyError) {
        return NextResponse.redirect(new URL('/auth/confirm?verified=true', baseUrl));
      } else {
        console.error('Error verifying token hash OTP:', verifyError);
        const confirmUrl = new URL('/auth/confirm', baseUrl);
        confirmUrl.searchParams.set('error', verifyError.message);
        confirmUrl.searchParams.set('error_code', (verifyError as any).code || 'otp_expired');
        return NextResponse.redirect(confirmUrl);
      }
    } catch (err: any) {
      console.error('Exception verifying token hash OTP:', err);
    }
  }

  // Fallback redirect to confirm page with client-side verification
  return NextResponse.redirect(new URL('/auth/confirm?verified=true', baseUrl));
}

