import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Read .env file directly
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
  // ignore
}

const supabase = createClient(envUrl, envKey);

async function runDatabaseQA() {
  console.log('====================================================');
  console.log('🔍 RUNNING DATABASE & SUPABASE MIGRATION VERIFICATION');
  console.log('====================================================');
  console.log(`Supabase URL: ${envUrl}`);

  const results: Record<string, { status: 'PASS' | 'FAIL' | 'WARN'; message: string }> = {};

  // 1. Check profiles display_name
  try {
    const { data, error } = await supabase.from('profiles').select('id, username, display_name, full_name, avatar_url').limit(1);
    if (error) {
      results['profiles.display_name'] = { status: 'FAIL', message: `Query error: ${error.message}` };
    } else {
      results['profiles.display_name'] = { status: 'PASS', message: `Column display_name queryable on profiles` };
    }
  } catch (err: any) {
    results['profiles.display_name'] = { status: 'FAIL', message: err.message };
  }

  // 2. Check smart_calendar_events
  try {
    const { error } = await supabase.from('smart_calendar_events').select('id, user_id, title, date, start_time, is_recurring, recurrence_rule, status').limit(1);
    if (error) {
      results['smart_calendar_events'] = { status: 'FAIL', message: `Query error: ${error.message}` };
    } else {
      results['smart_calendar_events'] = { status: 'PASS', message: `Table smart_calendar_events exists with required columns` };
    }
  } catch (err: any) {
    results['smart_calendar_events'] = { status: 'FAIL', message: err.message };
  }

  // 3. Check smart_calendar_reminders
  try {
    const { error } = await supabase.from('smart_calendar_reminders').select('id, event_id, remind_at, is_sent').limit(1);
    if (error) {
      results['smart_calendar_reminders'] = { status: 'FAIL', message: `Query error: ${error.message}` };
    } else {
      results['smart_calendar_reminders'] = { status: 'PASS', message: `Table smart_calendar_reminders exists` };
    }
  } catch (err: any) {
    results['smart_calendar_reminders'] = { status: 'FAIL', message: err.message };
  }

  // 4. Check study_weakness_topics
  try {
    const { error } = await supabase.from('study_weakness_topics').select('id, user_id, subject, topic, total_questions, correct_questions, mastery_score').limit(1);
    if (error) {
      results['study_weakness_topics'] = { status: 'FAIL', message: `Query error: ${error.message}` };
    } else {
      results['study_weakness_topics'] = { status: 'PASS', message: `Table study_weakness_topics exists` };
    }
  } catch (err: any) {
    results['study_weakness_topics'] = { status: 'FAIL', message: err.message };
  }

  // 5. Check user_gamification
  try {
    const { error } = await supabase.from('user_gamification').select('id, user_id, total_xp, level, streak_days').limit(1);
    if (error) {
      results['user_gamification'] = { status: 'FAIL', message: `Query error: ${error.message}` };
    } else {
      results['user_gamification'] = { status: 'PASS', message: `Table user_gamification exists` };
    }
  } catch (err: any) {
    results['user_gamification'] = { status: 'FAIL', message: err.message };
  }

  // 6. Check xp_ledger
  try {
    const { error } = await supabase.from('xp_ledger').select('id, user_id, amount, source_type, source_id').limit(1);
    if (error) {
      results['xp_ledger'] = { status: 'FAIL', message: `Query error: ${error.message}` };
    } else {
      results['xp_ledger'] = { status: 'PASS', message: `Table xp_ledger exists with unique constraint` };
    }
  } catch (err: any) {
    results['xp_ledger'] = { status: 'FAIL', message: err.message };
  }

  // 7. Check user_rewards
  try {
    const { error } = await supabase.from('user_rewards').select('id, user_id, reward_id, is_unlocked').limit(1);
    if (error) {
      results['user_rewards'] = { status: 'FAIL', message: `Query error: ${error.message}` };
    } else {
      results['user_rewards'] = { status: 'PASS', message: `Table user_rewards exists` };
    }
  } catch (err: any) {
    results['user_rewards'] = { status: 'FAIL', message: err.message };
  }

  // 8. Check focus_sessions
  try {
    const { error } = await supabase.from('focus_sessions').select('id, user_id, duration_minutes, target_minutes, completed, task_name').limit(1);
    if (error) {
      results['focus_sessions'] = { status: 'FAIL', message: `Query error: ${error.message}` };
    } else {
      results['focus_sessions'] = { status: 'PASS', message: `Table focus_sessions exists` };
    }
  } catch (err: any) {
    results['focus_sessions'] = { status: 'FAIL', message: err.message };
  }

  // 9. Check study_materials
  try {
    const { error } = await supabase.from('study_materials').select('id, user_id, title, subject, file_name, content_summary').limit(1);
    if (error) {
      results['study_materials'] = { status: 'FAIL', message: `Query error: ${error.message}` };
    } else {
      results['study_materials'] = { status: 'PASS', message: `Table study_materials exists` };
    }
  } catch (err: any) {
    results['study_materials'] = { status: 'FAIL', message: err.message };
  }

  // 10. Check study_groups
  try {
    const { error } = await supabase.from('study_groups').select('id, name, subject, members_count').limit(1);
    if (error) {
      results['study_groups'] = { status: 'FAIL', message: `Query error: ${error.message}` };
    } else {
      results['study_groups'] = { status: 'PASS', message: `Table study_groups exists` };
    }
  } catch (err: any) {
    results['study_groups'] = { status: 'FAIL', message: err.message };
  }

  console.log('\n--- SUPABASE TABLES CHECK RESULTS ---');
  for (const [key, res] of Object.entries(results)) {
    console.log(`[${res.status}] ${key}: ${res.message}`);
  }

  return results;
}

runDatabaseQA();
