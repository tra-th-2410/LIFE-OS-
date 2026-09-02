import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

/**
 * Next.js API Route: /api/cron/daily-reminder
 * Supports GET & POST requests for cron services and manual test triggers.
 * Optional query parameter: ?force=true (bypasses the 08:00 AM hour check for QA testing)
 */
async function handleCron(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Missing Supabase configuration' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(req.url);
    const force = searchParams.get('force') === 'true';

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase.rpc('generate_daily_challenge_reminders', {
      p_force: force,
    });

    if (error) {
      return NextResponse.json(
        { error: error.message, success: false },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      reminders_created: data ?? 0,
      forced: force,
      timestamp: new Date().toISOString(),
      message: `Daily reminders generated: ${data ?? 0} notifications created`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Internal server error', success: false },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return handleCron(req);
}

export async function POST(req: NextRequest) {
  return handleCron(req);
}
