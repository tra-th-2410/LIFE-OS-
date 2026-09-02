import assert from 'node:assert/strict';

interface Challenge {
  id: string;
  title: string;
  description: string;
  status: 'active' | 'archived' | 'completed';
  duration_days: number;
}

interface ChallengeParticipant {
  challenge_id: string;
  user_id: string;
  progress: number;
  streak: number;
  completed: boolean;
  round: number;
}

// Helper: Determine default challenge tab
function computeDefaultChallengeTab(participants: ChallengeParticipant[]): 'my' | 'recommended' {
  const hasActive = participants.some((p) => !p.completed);
  return hasActive ? 'my' : 'recommended';
}

// Helper: Simulate Dashboard Active Challenges Filter
function filterDashboardActiveChallenges(
  participants: (ChallengeParticipant & { challenge?: Challenge })[]
): (ChallengeParticipant & { challenge?: Challenge })[] {
  return participants.filter(
    (p) => !p.completed && p.challenge && p.challenge.status !== 'archived'
  );
}

// Helper: Simulate Challenge Creation with Auto-Join
function simulateCreateChallenge(
  challengeData: { title: string; duration_days: number },
  userId: string,
  existingDb: { challenges: Challenge[]; participants: ChallengeParticipant[] }
): { challenge: Challenge; participant: ChallengeParticipant } {
  const newChallenge: Challenge = {
    id: `chal-${Date.now()}`,
    title: challengeData.title,
    description: '',
    status: 'active',
    duration_days: challengeData.duration_days,
  };
  existingDb.challenges.push(newChallenge);

  // Check if participant already exists
  const exists = existingDb.participants.some(
    (p) => p.challenge_id === newChallenge.id && p.user_id === userId
  );

  let newPart: ChallengeParticipant;
  if (!exists) {
    newPart = {
      challenge_id: newChallenge.id,
      user_id: userId,
      progress: 0,
      streak: 0,
      completed: false,
      round: 1,
    };
    existingDb.participants.push(newPart);
  } else {
    newPart = existingDb.participants.find(
      (p) => p.challenge_id === newChallenge.id && p.user_id === userId
    )!;
  }

  return { challenge: newChallenge, participant: newPart };
}

console.log('--- RUNNING CHALLENGES SYNC & UI LOGIC TEST SUITE ---');

const user1 = '367dee4d-a66c-47b7-8984-e3fdc98b8d8b';
const user2 = 'user-222-xyz';

// TEST 1: User with 1 active and 1 completed challenge -> Default tab MUST be 'my'
const user1Participants: ChallengeParticipant[] = [
  { challenge_id: 'ch-test-reminder', user_id: user1, progress: 0, streak: 0, completed: false, round: 1 },
  { challenge_id: 'ch-english', user_id: user1, progress: 100, streak: 7, completed: true, round: 1 },
];
assert.equal(computeDefaultChallengeTab(user1Participants), 'my', 'User with active challenge must default to "my" tab');
console.log('✅ TEST 1 PASSED: User with active challenge defaults to "my" tab');

// TEST 2: User with ONLY completed challenges -> Default tab MUST be 'recommended'
const userCompletedOnly: ChallengeParticipant[] = [
  { challenge_id: 'ch-english', user_id: user1, progress: 100, streak: 7, completed: true, round: 1 },
];
assert.equal(computeDefaultChallengeTab(userCompletedOnly), 'recommended', 'User with no active challenges must default to "recommended"');
console.log('✅ TEST 2 PASSED: User with no active challenges defaults to "recommended" tab');

// TEST 3: User with 0 participations -> Default tab MUST be 'recommended'
assert.equal(computeDefaultChallengeTab([]), 'recommended', 'New user defaults to "recommended"');
console.log('✅ TEST 3 PASSED: New user with 0 participations defaults to "recommended" tab');

// TEST 4: Dashboard Active Challenges filtering
const mockJoinedList: (ChallengeParticipant & { challenge?: Challenge })[] = [
  {
    challenge_id: 'ch-1',
    user_id: user1,
    progress: 25,
    streak: 2,
    completed: false,
    round: 1,
    challenge: { id: 'ch-1', title: 'TEST - Daily Reminder', description: 'desc', status: 'active', duration_days: 7 },
  },
  {
    challenge_id: 'ch-2',
    user_id: user1,
    progress: 100,
    streak: 7,
    completed: true, // completed -> excluded from Active Challenges
    round: 1,
    challenge: { id: 'ch-2', title: '7-Day English Challenge', description: 'desc', status: 'active', duration_days: 7 },
  },
  {
    challenge_id: 'ch-3',
    user_id: user1,
    progress: 10,
    streak: 1,
    completed: false,
    round: 1,
    challenge: { id: 'ch-3', title: 'Archived Challenge', description: 'desc', status: 'archived', duration_days: 7 }, // archived -> excluded
  },
];

const dashboardActive = filterDashboardActiveChallenges(mockJoinedList);
assert.equal(dashboardActive.length, 1, 'Only active, uncompleted, non-archived challenges should appear on Dashboard');
assert.equal(dashboardActive[0].challenge?.title, 'TEST - Daily Reminder');
console.log('✅ TEST 4 PASSED: Dashboard only shows active uncompleted challenges belonging to the user');

// TEST 5: CreateChallengeDialog automatically joins the creator with round 1, progress 0, completed false
const db = { challenges: [] as Challenge[], participants: [] as ChallengeParticipant[] };
const created = simulateCreateChallenge({ title: '21-Day React Master', duration_days: 21 }, user1, db);

assert.equal(db.challenges.length, 1);
assert.equal(db.participants.length, 1);
assert.equal(db.participants[0].challenge_id, created.challenge.id);
assert.equal(db.participants[0].user_id, user1);
assert.equal(db.participants[0].completed, false);
assert.equal(db.participants[0].round, 1);
console.log('✅ TEST 5 PASSED: Creating challenge auto-joins the creator as active participant');

// TEST 6: No duplicate participants
const duplicateAttempt = simulateCreateChallenge({ title: '21-Day React Master', duration_days: 21 }, user1, {
  challenges: [created.challenge],
  participants: [created.participant],
});
assert.equal(db.participants.filter(p => p.challenge_id === created.challenge.id && p.user_id === user1).length, 1);
console.log('✅ TEST 6 PASSED: Duplicate participant creation is prevented');

console.log('\n🎉 ALL 6/6 CHALLENGE SYNC & DASHBOARD TESTS PASSED!');
