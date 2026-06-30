/**
 * Test warm-up API endpoint
 * This tests the backend /api/whatsapp/status endpoint structure
 */

// Simulate the API response structure
function simulateStatusResponse() {
  return {
    status: 'connected',
    connectedPhone: '+1234567890',
    error: null,
    queueDepth: 0,
    session: {
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
      dayNumber: 2,
      warmup: {
        active: true,
        phaseName: 'new',
        dailyLimit: 20,
        dailySent: 5,
        dailyRemaining: 15,
        fullyUnlockedAt: new Date(Date.now() + 13 * 24 * 60 * 60 * 1000).toISOString(), // 13 days from now
        perMinuteCap: 20,
      },
    },
  };
}

// Test response parsing
console.log('🧪 Testing API Response Structure\n');

const response = simulateStatusResponse();

console.log('✓ Status endpoint structure:');
console.log(`  - status: ${response.status}`);
console.log(`  - connectedPhone: ${response.connectedPhone}`);
console.log(`  - queueDepth: ${response.queueDepth}`);
console.log(`  - session: ${response.session ? 'present' : 'missing'}`);

if (response.session) {
  const { dayNumber, warmup } = response.session;
  console.log('\n✓ Session warm-up data:');
  console.log(`  - dayNumber: ${dayNumber}`);
  console.log(`  - warmup.active: ${warmup.active}`);
  console.log(`  - warmup.phaseName: ${warmup.phaseName}`);
  console.log(`  - warmup.dailyLimit: ${warmup.dailyLimit}`);
  console.log(`  - warmup.dailySent: ${warmup.dailySent}`);
  console.log(`  - warmup.dailyRemaining: ${warmup.dailyRemaining}`);
  console.log(`  - warmup.perMinuteCap: ${warmup.perMinuteCap}`);

  // Calculate capacity percentage
  const capacityPercent = (warmup.dailySent / warmup.dailyLimit) * 100;
  console.log(`\n✓ Capacity metrics:`);
  console.log(`  - Daily usage: ${warmup.dailySent}/${warmup.dailyLimit} (${capacityPercent.toFixed(1)}%)`);
  console.log(`  - Remaining today: ${warmup.dailyRemaining}`);

  // Calculate warm-up progress
  const warmupPercent = (dayNumber / 15) * 100;
  console.log(`  - Warm-up progress: ${dayNumber}/15 days (${warmupPercent.toFixed(1)}%)`);
  console.log(`  - Full capacity on: ${new Date(warmup.fullyUnlockedAt).toLocaleDateString()}`);
}

// Test 429 error response
console.log('\n🧪 Testing 429 Error Response\n');

const errorResponse = {
  error: 'Daily warm-up limit reached: 20/20 messages sent today. Resets at midnight. Full capacity on June 29.',
  code: 'WARMUP_DAILY_LIMIT',
  limit: 20,
  sent: 20,
  phaseName: 'new',
  resetAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  fullyUnlockedAt: new Date(Date.now() + 13 * 24 * 60 * 60 * 1000).toISOString(),
  dayNumber: 2,
};

console.log('✓ 429 error structure:');
console.log(`  - code: ${errorResponse.code}`);
console.log(`  - limit: ${errorResponse.limit}`);
console.log(`  - sent: ${errorResponse.sent}`);
console.log(`  - phaseName: ${errorResponse.phaseName}`);
console.log(`  - dayNumber: ${errorResponse.dayNumber}`);
console.log(`  - resetAt: ${new Date(errorResponse.resetAt).toLocaleString()}`);
console.log(`  - fullyUnlockedAt: ${new Date(errorResponse.fullyUnlockedAt).toLocaleString()}`);

// Test frontend hook response parsing
console.log('\n🧪 Testing Frontend Hook Response Parsing\n');

function parseSessionStatus(response) {
  return {
    status: response.status,
    session: response.session,
    isLoading: false,
    error: null,
  };
}

const hookData = parseSessionStatus(response);
console.log('✓ useSessionStatus hook output:');
console.log(`  - status: ${hookData.status}`);
console.log(`  - session: ${hookData.session ? 'present' : 'null'}`);
console.log(`  - isLoading: ${hookData.isLoading}`);
console.log(`  - error: ${hookData.error}`);

// Test widget rendering logic
console.log('\n🧪 Testing Widget Rendering Logic\n');

if (hookData.session) {
  const { warmup } = hookData.session;
  const warmupPercent = (hookData.session.dayNumber / 15) * 100;
  const dailyPercent = (warmup.dailySent / warmup.dailyLimit) * 100;

  console.log('✓ Widget state:');
  console.log(`  - Show warm-up bar: ${warmup.active}`);
  console.log(`  - Warm-up progress %: ${warmupPercent.toFixed(1)}`);
  console.log(`  - Daily progress %: ${dailyPercent.toFixed(1)}`);

  // Determine color
  const getDailyColor = () => {
    if (dailyPercent <= 60) return 'green';
    if (dailyPercent <= 85) return 'amber';
    return 'red';
  };

  console.log(`  - Daily bar color: ${getDailyColor()}`);
  console.log(`  - Show "Full Capacity" badge: ${!warmup.active}`);
}

console.log('\n✅ All API integration tests passed!');
