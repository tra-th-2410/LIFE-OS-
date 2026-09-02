import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

let envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
let envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
        envUrl = trimmed.replace('NEXT_PUBLIC_SUPABASE_URL=', '').trim();
      }
      if (trimmed.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) {
        envKey = trimmed.replace('NEXT_PUBLIC_SUPABASE_ANON_KEY=', '').trim();
      }
    }
  }
} catch (e) {
  console.error(e);
}

const supabase = createClient(envUrl, envKey);
const TARGET_USER_ID = '367dee4d-a66c-47b7-8984-e3fdc98b8d8b';

async function testRpc() {
  console.log('Testing RPC get_challenge_report...');
  const { data: repWeekly, error: repErr1 } = await supabase.rpc('get_challenge_report', {
    p_user_id: TARGET_USER_ID,
    p_period: 'weekly',
  });
  console.log('Weekly Report:', repWeekly, 'Error:', repErr1);

  const { data: repMonthly, error: repErr2 } = await supabase.rpc('get_challenge_report', {
    p_user_id: TARGET_USER_ID,
    p_period: 'monthly',
  });
  console.log('Monthly Report:', repMonthly, 'Error:', repErr2);

  const today = new Date().toISOString().split('T')[0];
  const { data: reminders, error: remErr } = await supabase.rpc('get_user_challenge_reminders', {
    p_user_id: TARGET_USER_ID,
    p_date: today,
  });
  console.log('Reminders for today:', reminders, 'Error:', remErr);
}

testRpc().catch(console.error);
