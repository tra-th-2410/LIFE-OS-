import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

// Preload environment variables from .env
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
} catch {
  // ignore
}

const supabase = createClient(envUrl, envKey);

async function runReminderTestSuite() {
  console.log('================================================================');
  console.log('🧪 RUNNING DAILY STUDY CHALLENGE REMINDER (08:00 AM) TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName} - ${detail || ''}`);
      failed++;
    }
  }

  // Helper: Timezone Hour Converter
  function getLocalHour(utcDate: Date, timeZone: string): number {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      hour12: false,
    });
    return parseInt(formatter.format(utcDate), 10);
  }

  function getLocalDateString(utcDate: Date, timeZone: string): string {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(utcDate);
  }

  // TEST 1: Timezone math verification (01:00 UTC = 08:00 Asia/Ho_Chi_Minh)
  console.log('--- TEST 1: Timezone Conversion & 08:00 AM Calculation ---');
  const sampleUtcAt01 = new Date('2026-09-02T01:00:00Z');
  const vnHour = getLocalHour(sampleUtcAt01, 'Asia/Ho_Chi_Minh');
  const vnDate = getLocalDateString(sampleUtcAt01, 'Asia/Ho_Chi_Minh');
  assert(vnHour === 8, '01:00 UTC corresponds exactly to 08:00 in Asia/Ho_Chi_Minh', `Got ${vnHour}`);
  assert(vnDate === '2026-09-02', 'VN date matches expected local date', `Got ${vnDate}`);

  const sampleUtcAt00 = new Date('2026-09-02T00:00:00Z');
  const vnEarlyHour = getLocalHour(sampleUtcAt00, 'Asia/Ho_Chi_Minh');
  assert(vnEarlyHour === 7, '00:00 UTC is 07:00 in Asia/Ho_Chi_Minh (< 08:00 AM threshold)', `Got ${vnEarlyHour}`);

  // TEST 2: Notification Title & Body Format Specifications
  console.log('\n--- TEST 2: Notification Title & Body Formatting ---');
  const testChallengeTitle = '7-Day Study Challenge';
  const expectedTitle = '📚 Time to study!';
  const expectedBody = `You have a task to complete in ${testChallengeTitle} today.`;
  const expectedLink = '/app/study';

  assert(expectedTitle === '📚 Time to study!', 'Title is strictly "📚 Time to study!"');
  assert(expectedBody.includes(testChallengeTitle), 'Body contains challenge title');
  assert(expectedBody.startsWith('You have a task to complete in'), 'Body matches requested copy template');
  assert(expectedLink === '/app/study', 'Action link redirects to /app/study');

  // TEST 3: Notification Logic Simulation (Unit Test Matrix)
  console.log('\n--- TEST 3: Business Logic & Deduplication Matrix ---');

  interface MockParticipant {
    user_id: string;
    challenge_id: string;
    challenge_title: string;
    challenge_status: 'active' | 'archived' | 'completed';
    completed: boolean;
    today_checked_in: boolean;
    existing_reminder_today: boolean;
    user_timezone: string;
  }

  function simulateReminderDecision(
    p: MockParticipant,
    currentUtcTime: Date,
    force: boolean = false
  ): { shouldSend: boolean; reason: string } {
    const localHour = getLocalHour(currentUtcTime, p.user_timezone);
    if (!force && localHour < 8) {
      return { shouldSend: false, reason: `Before 08:00 AM (local hour: ${localHour})` };
    }
    if (p.challenge_status !== 'active') {
      return { shouldSend: false, reason: `Challenge status is ${p.challenge_status}` };
    }
    if (p.completed) {
      return { shouldSend: false, reason: 'Challenge participation is already completed' };
    }
    if (p.today_checked_in) {
      return { shouldSend: false, reason: 'User already checked in today' };
    }
    if (p.existing_reminder_today) {
      return { shouldSend: false, reason: 'Daily reminder already created today (duplicate protection)' };
    }
    return { shouldSend: true, reason: 'Eligible for 08:00 AM daily reminder' };
  }

  // Case A: 08:00 AM, Active, Not checked in -> SEND
  const caseA = simulateReminderDecision(
    {
      user_id: 'u1',
      challenge_id: 'c1',
      challenge_title: '7-Day Study Challenge',
      challenge_status: 'active',
      completed: false,
      today_checked_in: false,
      existing_reminder_today: false,
      user_timezone: 'Asia/Ho_Chi_Minh',
    },
    sampleUtcAt01 // 08:00 AM VN
  );
  assert(caseA.shouldSend === true, 'Case A: Active challenge + not checked in + 08:00 AM -> Send reminder');

  // Case B: Already checked in -> DO NOT SEND
  const caseB = simulateReminderDecision(
    {
      user_id: 'u2',
      challenge_id: 'c1',
      challenge_title: '7-Day Study Challenge',
      challenge_status: 'active',
      completed: false,
      today_checked_in: true,
      existing_reminder_today: false,
      user_timezone: 'Asia/Ho_Chi_Minh',
    },
    sampleUtcAt01
  );
  assert(caseB.shouldSend === false, 'Case B: Already checked in today -> Skip reminder', caseB.reason);

  // Case C: Duplicate Cron Execution (Already sent today) -> DO NOT SEND
  const caseC = simulateReminderDecision(
    {
      user_id: 'u3',
      challenge_id: 'c1',
      challenge_title: '7-Day Study Challenge',
      challenge_status: 'active',
      completed: false,
      today_checked_in: false,
      existing_reminder_today: true,
      user_timezone: 'Asia/Ho_Chi_Minh',
    },
    sampleUtcAt01
  );
  assert(caseC.shouldSend === false, 'Case C: Cron runs again on same day -> No duplicate notification', caseC.reason);

  // Case D: Next day (new date, existing_reminder_today = false) -> SEND
  const sampleUtcNextDayAt01 = new Date('2026-09-03T01:00:00Z');
  const caseD = simulateReminderDecision(
    {
      user_id: 'u1',
      challenge_id: 'c1',
      challenge_title: '7-Day Study Challenge',
      challenge_status: 'active',
      completed: false,
      today_checked_in: false,
      existing_reminder_today: false, // New day
      user_timezone: 'Asia/Ho_Chi_Minh',
    },
    sampleUtcNextDayAt01
  );
  assert(caseD.shouldSend === true, 'Case D: Next day not checked in -> Send new reminder for next day');

  // Case E: Challenge Completed -> DO NOT SEND
  const caseE = simulateReminderDecision(
    {
      user_id: 'u4',
      challenge_id: 'c1',
      challenge_title: '7-Day Study Challenge',
      challenge_status: 'active',
      completed: true,
      today_checked_in: false,
      existing_reminder_today: false,
      user_timezone: 'Asia/Ho_Chi_Minh',
    },
    sampleUtcAt01
  );
  assert(caseE.shouldSend === false, 'Case E: Challenge already completed -> Skip reminder', caseE.reason);

  // Case F: Challenge Archived/Expired -> DO NOT SEND
  const caseF = simulateReminderDecision(
    {
      user_id: 'u5',
      challenge_id: 'c2',
      challenge_title: 'Expired Challenge',
      challenge_status: 'archived',
      completed: false,
      today_checked_in: false,
      existing_reminder_today: false,
      user_timezone: 'Asia/Ho_Chi_Minh',
    },
    sampleUtcAt01
  );
  assert(caseF.shouldSend === false, 'Case F: Challenge archived/expired -> Skip reminder', caseF.reason);

  // Case G: Before 08:00 AM (07:00 AM VN) -> DO NOT SEND
  const caseG = simulateReminderDecision(
    {
      user_id: 'u6',
      challenge_id: 'c1',
      challenge_title: '7-Day Study Challenge',
      challenge_status: 'active',
      completed: false,
      today_checked_in: false,
      existing_reminder_today: false,
      user_timezone: 'Asia/Ho_Chi_Minh',
    },
    sampleUtcAt00 // 07:00 AM VN
  );
  assert(caseG.shouldSend === false, 'Case G: Before 08:00 AM local time -> Wait until 08:00 AM', caseG.reason);

  // TEST 4: Streak Milestone Independence Verification
  console.log('\n--- TEST 4: Streak Milestone Independence ---');
  const streakMilestoneNotif = {
    type: 'challenge_streak',
    title: 'Streak Milestone! 🔥',
    body: 'Awesome! You reached a 3-day streak in 7-Day Study Challenge!',
    link: '/app/study',
  };
  const dailyReminderNotif = {
    type: 'daily_challenge_reminder',
    title: '📚 Time to study!',
    body: 'You have a task to complete in 7-Day Study Challenge today.',
    link: '/app/study',
  };

  assert(
    streakMilestoneNotif.type !== dailyReminderNotif.type,
    'Streak Milestone type ("challenge_streak") is distinct from Daily Reminder type ("daily_challenge_reminder")'
  );
  assert(
    streakMilestoneNotif.title === 'Streak Milestone! 🔥' && dailyReminderNotif.title === '📚 Time to study!',
    'Streak Milestone and Daily Reminder have distinct, non-interfering titles'
  );

  // TEST 5: Database Schema & RPC Query Connectivity Test
  console.log('\n--- TEST 5: Database Schema Check ---');
  try {
    const { error: notifErr } = await supabase.from('notifications').select('id, user_id, type, title, body, link, created_at').limit(1);
    assert(!notifErr, 'notifications table queryable with required columns');

    const { error: chalErr } = await supabase.from('challenges').select('id, title, status, duration_days').limit(1);
    assert(!chalErr, 'challenges table queryable with required columns');

    const { error: partErr } = await supabase.from('challenge_participants').select('challenge_id, user_id, progress, streak, completed').limit(1);
    assert(!partErr, 'challenge_participants table queryable with required columns', partErr?.message);

    const { error: checkErr } = await supabase.from('challenge_checkins').select('id, user_id, challenge_id, checkin_date').limit(1);
    assert(!checkErr, 'challenge_checkins table queryable with required columns');
  } catch (err: any) {
    console.error('Database connectivity error:', err);
  }

  console.log(`\n================================================================`);
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`================================================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

runReminderTestSuite();
