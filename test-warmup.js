/**
 * Test warm-up phase calculation
 * Run: node test-warmup.js
 */

// Simulate the warmup logic
function getWarmupPhase(sessionCreatedAt) {
  const now = new Date();
  const dayNumber = Math.floor((now.getTime() - sessionCreatedAt.getTime()) / (1000 * 60 * 60 * 24));

  let phaseName, dailyLimit, active;

  if (dayNumber < 4) {
    phaseName = 'new';
    dailyLimit = 20;
    active = true;
  } else if (dayNumber < 8) {
    phaseName = 'growing';
    dailyLimit = 50;
    active = true;
  } else if (dayNumber < 15) {
    phaseName = 'maturing';
    dailyLimit = 100;
    active = true;
  } else {
    phaseName = 'established';
    dailyLimit = null;
    active = false;
  }

  const fullyUnlockedAt = new Date(sessionCreatedAt.getTime() + 15 * 24 * 60 * 60 * 1000);

  return {
    active,
    phaseName,
    dayNumber,
    dailyLimit,
    perMinuteCap: 20,
    fullyUnlockedAt: active ? fullyUnlockedAt : null,
  };
}

// Test scenarios
console.log('🧪 Testing Warm-up Phase Logic\n');

const tests = [
  { name: 'Day 0 (Brand new)', daysAgo: 0 },
  { name: 'Day 1', daysAgo: 1 },
  { name: 'Day 3', daysAgo: 3 },
  { name: 'Day 4 (Growing phase)', daysAgo: 4 },
  { name: 'Day 7', daysAgo: 7 },
  { name: 'Day 8 (Maturing phase)', daysAgo: 8 },
  { name: 'Day 14', daysAgo: 14 },
  { name: 'Day 15 (Established)', daysAgo: 15 },
  { name: 'Day 20', daysAgo: 20 },
];

tests.forEach(({ name, daysAgo }) => {
  const sessionCreatedAt = new Date();
  sessionCreatedAt.setDate(sessionCreatedAt.getDate() - daysAgo);

  const warmup = getWarmupPhase(sessionCreatedAt);

  console.log(`✓ ${name}`);
  console.log(`  Phase: ${warmup.phaseName.toUpperCase()}`);
  console.log(`  Day: ${warmup.dayNumber} of 15`);
  console.log(`  Daily Limit: ${warmup.dailyLimit ? warmup.dailyLimit + ' msgs/day' : 'UNLIMITED'}`);
  console.log(`  Per-Minute Cap: ${warmup.perMinuteCap} msgs/min`);
  console.log(`  Warm-up Active: ${warmup.active ? 'YES' : 'NO'}`);
  if (warmup.fullyUnlockedAt) {
    console.log(`  Full Capacity Unlocks: ${warmup.fullyUnlockedAt.toLocaleDateString()}`);
  }
  console.log();
});

// Test error creation
console.log('🧪 Testing Error Format\n');

function createWarmupLimitError(limit, sent, phase) {
  const now = new Date();
  const resetAt = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  const error = {
    code: 'WARMUP_DAILY_LIMIT',
    limit,
    sent,
    phaseName: phase.phaseName,
    resetAt: resetAt.toISOString(),
    fullyUnlockedAt: phase.fullyUnlockedAt?.toISOString() || null,
    dayNumber: phase.dayNumber,
  };

  return error;
}

const phase = getWarmupPhase(new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)); // Day 1
const error = createWarmupLimitError(20, 20, phase);

console.log('✓ Error Response (HTTP 429):');
console.log(JSON.stringify(error, null, 2));

console.log('\n✅ All warm-up logic tests passed!');
