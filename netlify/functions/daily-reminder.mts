import { createClient } from "@supabase/supabase-js";

/**
 * Netlify Scheduled Function: Daily Study Challenge Reminder
 * Runs at minute 0 of every hour (UTC).
 * Timezone-aware: Evaluates each user's local timezone.
 * When local time reaches 08:00 AM, creates "📚 Time to study!" notification.
 * Duplicate protection ensures max 1 notification per user per day.
 */
export default async (req: Request) => {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("[DailyReminder Cron] Missing Supabase environment variables");
      return new Response(JSON.stringify({ error: "Missing Supabase configuration" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Call database RPC to evaluate all active challenge participants
    const { data, error } = await supabase.rpc("generate_daily_challenge_reminders");

    if (error) {
      console.error("[DailyReminder Cron] RPC error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`[DailyReminder Cron] Success: ${data ?? 0} reminders generated`);
    return new Response(
      JSON.stringify({
        success: true,
        reminders_created: data ?? 0,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error("[DailyReminder Cron] Unhandled error:", err);
    return new Response(JSON.stringify({ error: err?.message || "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const config = {
  // Run every hour at minute 0 to support all user timezones at their 08:00 AM local time
  schedule: "0 * * * *",
};
