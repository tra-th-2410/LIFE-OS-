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
} catch (e) {
  console.error(e);
}

const supabase = createClient(envUrl, envKey);
const TARGET_USER_ID = '367dee4d-a66c-47b7-8984-e3fdc98b8d8b';

async function debug() {
  console.log('=== DEBUG CHALLENGES IN SUPABASE ===');
  console.log('Target User ID:', TARGET_USER_ID);

  // 1. Fetch all challenges
  const { data: allChallenges, error: chErr } = await supabase
    .from('challenges')
    .select('*')
    .order('created_at', { ascending: false });

  console.log('\n--- 1. ALL CHALLENGES IN DATABASE ---');
  console.log(`Total challenges in DB: ${allChallenges?.length ?? 0}`);
  if (chErr) console.error('Error fetching challenges:', chErr);
  allChallenges?.forEach((c, idx) => {
    console.log(`[${idx + 1}] ID: ${c.id} | Title: "${c.title}" | Status: ${c.status} | Duration: ${c.duration_days}d | Participants Count: ${c.participants_count} | Creator: ${c.creator_id}`);
  });

  // 2. Fetch challenge_participants for target user
  const { data: userParts, error: partErr } = await supabase
    .from('challenge_participants')
    .select('*')
    .eq('user_id', TARGET_USER_ID);

  console.log('\n--- 2. CHALLENGE_PARTICIPANTS FOR TARGET USER ---');
  console.log(`Total participations for ${TARGET_USER_ID}: ${userParts?.length ?? 0}`);
  if (partErr) console.error('Error fetching participations:', partErr);
  userParts?.forEach((p, idx) => {
    const ch = allChallenges?.find(c => c.id === p.challenge_id);
    console.log(`[${idx + 1}] Challenge: "${ch?.title || p.challenge_id}" | Progress: ${p.progress}% | Streak: ${p.streak} | Completed: ${p.completed} | Round: ${p.round} | Joined At: ${p.joined_at}`);
  });

  // 3. Fetch all challenge_participants in the DB (for any user)
  const { data: allParts, error: allPartErr } = await supabase
    .from('challenge_participants')
    .select('*');

  console.log('\n--- 3. ALL CHALLENGE_PARTICIPANTS ACROSS ALL USERS ---');
  console.log(`Total participations across all users in DB: ${allParts?.length ?? 0}`);
  if (allPartErr) console.error('Error fetching all participations:', allPartErr);
  allParts?.forEach((p, idx) => {
    const ch = allChallenges?.find(c => c.id === p.challenge_id);
    console.log(`[${idx + 1}] User: ${p.user_id} | Challenge: "${ch?.title || p.challenge_id}" | Completed: ${p.completed}`);
  });

  // 4. Simulate frontend filtering logic from app/app/study/page.tsx
  console.log('\n--- 4. SIMULATING FRONTEND LOGIC (app/app/study/page.tsx) ---');
  const partMap = new Map<string, any>();
  userParts?.forEach((p) => {
    partMap.set(p.challenge_id, p);
  });

  const chList = allChallenges ?? [];
  const myChallenges = chList.filter((c) => partMap.has(c.id) && !partMap.get(c.id)?.completed);
  const completedChallenges = chList.filter((c) => partMap.get(c.id)?.completed);
  const recommendedChallenges = chList.filter((c) => !partMap.has(c.id) && c.status !== 'archived' && c.status !== 'completed');

  console.log(`myChallenges.length (Active / "Của tôi"): ${myChallenges.length}`);
  myChallenges.forEach(c => console.log(`  -> "${c.title}"`));

  console.log(`completedChallenges.length ("Đã xong"): ${completedChallenges.length}`);
  completedChallenges.forEach(c => console.log(`  -> "${c.title}"`));

  console.log(`recommendedChallenges.length ("Gợi ý"): ${recommendedChallenges.length}`);
  recommendedChallenges.forEach(c => console.log(`  -> "${c.title}"`));
}

debug().catch(console.error);
