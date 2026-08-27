import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const job = url.searchParams.get("job") || "daily";

    let functionName: string;
    let resultLabel: string;

    if (job === "daily") {
      functionName = "generate_daily_challenge_reminders";
      resultLabel = "Daily reminders";
    } else if (job === "weekly") {
      functionName = "generate_weekly_challenge_reports";
      resultLabel = "Weekly reports";
    } else if (job === "monthly") {
      functionName = "generate_monthly_challenge_reports";
      resultLabel = "Monthly reports";
    } else {
      return new Response(
        JSON.stringify({ error: "Invalid job parameter. Use: daily, weekly, monthly" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data, error } = await supabase.rpc(functionName);

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message, job }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ job, created: data, message: `${resultLabel}: ${data} notifications created` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
