import * as fs from 'fs';
import * as path from 'path';

// Preload .env before importing lib files that initialize Supabase
try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
        process.env.NEXT_PUBLIC_SUPABASE_URL = trimmed.replace('NEXT_PUBLIC_SUPABASE_URL=', '').trim();
      }
      if (trimmed.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) {
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = trimmed.replace('NEXT_PUBLIC_SUPABASE_ANON_KEY=', '').trim();
      }
    }
  }
} catch (e) {
  // ignore
}

import { generateScheduleFromPrompt } from '../lib/calendar';
import { generateWeaknessRecommendations } from '../lib/study-analytics';
import { calculateLevel, SYSTEM_REWARDS_CATALOG } from '../lib/gamification';

async function runUnitFlowTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING COMPREHENSIVE UNIT & BUSINESS LOGIC QA');
  console.log('====================================================\n');

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

  // TEST 1: AI Scheduling Prompt Parser
  console.log('--- TEST 1: AI Scheduling Natural Language Parser ---');
  const userPrompt = 'Tôi thi Toán ngày 20/9 và Tiếng Anh ngày 25/9.';
  const proposedSchedule = await generateScheduleFromPrompt(userPrompt);

  assert(
    Array.isArray(proposedSchedule) && proposedSchedule.length >= 2,
    'AI parser produces proposed study events from natural language',
    `Expected >= 2 events, got ${proposedSchedule.length}`
  );

  const mathPlan = proposedSchedule.find((p) => p.title.toLowerCase().includes('toán') || p.subject.toLowerCase().includes('toán'));
  const englishPlan = proposedSchedule.find((p) => p.title.toLowerCase().includes('tiếng anh') || p.subject.toLowerCase().includes('anh'));

  assert(Boolean(mathPlan), 'Identified Math exam review session in proposed plan');
  assert(Boolean(englishPlan), 'Identified English exam review session in proposed plan');
  assert(
    proposedSchedule.every((p) => p.accepted === true),
    'All proposed events default to accepted: true for user preview checklist'
  );

  // TEST 2: Weakness Map & Recommendation Generator
  console.log('\n--- TEST 2: Weakness Map Analytics & Recommendation Engine ---');
  const mockWeaknessTopics = [
    {
      id: 'wt-1',
      user_id: 'user-test-1',
      subject: 'Toán học',
      topic: 'Định lý Pythagore & Hình học không gian',
      total_questions: 10,
      correct_questions: 3,
      mastery_score: 30, // 30% < 60% -> Weak
      last_assessed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'wt-2',
      user_id: 'user-test-1',
      subject: 'Tiếng Anh',
      topic: 'Conditional Sentences',
      total_questions: 10,
      correct_questions: 9,
      mastery_score: 90, // 90% >= 80% -> Mastered
      last_assessed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const recommendations = generateWeaknessRecommendations(mockWeaknessTopics);

  assert(
    recommendations.length === 1,
    'Recommendation engine filters only weak topics (<60% mastery)',
    `Expected 1 weak topic rec, got ${recommendations.length}`
  );
  assert(
    recommendations[0]?.topic === 'Định lý Pythagore & Hình học không gian',
    'Identified exact weak topic "Định lý Pythagore & Hình học không gian"'
  );
  assert(
    Boolean(recommendations[0]?.calendarProposal),
    'Generated actionable Smart Calendar review proposal for the weak topic'
  );
  assert(
    recommendations[0]?.calendarProposal?.durationMinutes === 45,
    'Calendar proposal includes recommended 45-minute focused review duration'
  );

  // TEST 3: Gamification Level & XP Calculation
  console.log('\n--- TEST 3: Gamification Level Thresholds & Rewards Catalog ---');
  const level0 = calculateLevel(50);
  assert(level0 === 1, 'Level 1 with 50 XP correct');

  const level3 = calculateLevel(2500);
  assert(level3 === 3, 'Level 3 calculation correct at 2500 XP');

  assert(
    SYSTEM_REWARDS_CATALOG.length >= 6,
    'Rewards catalog contains all required achievements and themes',
    `Found ${SYSTEM_REWARDS_CATALOG.length} rewards`
  );

  const plantReward = SYSTEM_REWARDS_CATALOG.find((r) => r.reward_type === 'plant');
  const petReward = SYSTEM_REWARDS_CATALOG.find((r) => r.reward_type === 'pet');
  assert(Boolean(plantReward), 'Plant companion reward exists in catalog');
  assert(Boolean(petReward), 'Pet study companion reward exists in catalog');

  console.log(`\n====================================================`);
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`====================================================`);
}

runUnitFlowTests();
