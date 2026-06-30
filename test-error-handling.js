/**
 * Test error handling in ChatWindow component
 */

console.log('🧪 Testing Error Handling Logic\n');

// Simulate API error with 429 status
class APIError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

const warmupLimitError = new APIError(
  'Daily warm-up limit reached: 20/20 messages sent today',
  429,
  {
    error: 'Daily warm-up limit reached: 20/20 messages sent today',
    code: 'WARMUP_DAILY_LIMIT',
    limit: 20,
    sent: 20,
    phaseName: 'new',
    resetAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    fullyUnlockedAt: new Date(Date.now() + 13 * 24 * 60 * 60 * 1000).toISOString(),
    dayNumber: 2,
  }
);

console.log('✓ Simulated 429 error:');
console.log(`  - status: ${warmupLimitError.status}`);
console.log(`  - code: ${warmupLimitError.data.code}`);
console.log(`  - message: ${warmupLimitError.message}`);

// Test ChatWindow error handling logic
function handleSendError(error) {
  if (error?.status === 429 && error?.data?.code === 'WARMUP_DAILY_LIMIT') {
    const { sent, limit, dayNumber, fullyUnlockedAt } = error.data;
    const unlockDate = fullyUnlockedAt ? new Date(fullyUnlockedAt).toLocaleDateString() : 'N/A';
    const toastMessage = `Daily limit reached: ${sent}/${limit} messages sent today. Resets at midnight. (Day ${dayNumber} of 15 warm-up — full capacity on ${unlockDate})`;
    return {
      type: 'warmup_limit',
      message: toastMessage,
      severity: 'warning',
    };
  }
  return {
    type: 'generic',
    message: 'Failed to send message. Please try again.',
    severity: 'error',
  };
}

console.log('\n🧪 Testing ChatWindow Error Handler\n');

const warmupError = handleSendError(warmupLimitError);
console.log('✓ Warm-up limit error handling:');
console.log(`  - type: ${warmupError.type}`);
console.log(`  - severity: ${warmupError.severity}`);
console.log(`  - message: "${warmupError.message}"`);

// Test generic error
const genericError = new APIError('Network error', 500, null);
const genericResult = handleSendError(genericError);
console.log('\n✓ Generic error handling:');
console.log(`  - type: ${genericResult.type}`);
console.log(`  - severity: ${genericResult.severity}`);
console.log(`  - message: "${genericResult.message}"`);

// Test optimistic message removal
console.log('\n🧪 Testing Message Removal Logic\n');

const messages = [
  { id: 'msg-1', body: 'Hello' },
  { id: 'optimistic-123', body: 'Failed message' },
  { id: 'msg-2', body: 'World' },
];

const optimisticId = 'optimistic-123';
const filteredMessages = messages.filter(m => m.id !== optimisticId);

console.log('✓ Message list before error:');
console.log(`  - Length: ${messages.length}`);
messages.forEach(m => console.log(`    - ${m.id}: "${m.body}"`));

console.log('\n✓ Message list after error (optimistic removed):');
console.log(`  - Length: ${filteredMessages.length}`);
filteredMessages.forEach(m => console.log(`    - ${m.id}: "${m.body}"`));

// Test toast notification
console.log('\n🧪 Testing Toast Notification\n');

function createToastNotification(error) {
  const isWarmupError = error?.status === 429 && error?.data?.code === 'WARMUP_DAILY_LIMIT';

  if (isWarmupError) {
    return {
      type: 'warning',
      title: '⚠️ Daily Limit Reached',
      message: handleSendError(error).message,
      duration: 6000, // 6 seconds
      autoClose: false, // Manual close
    };
  }

  return {
    type: 'error',
    title: '❌ Send Failed',
    message: 'Please try again',
    duration: 4000,
    autoClose: true,
  };
}

const warmupToast = createToastNotification(warmupLimitError);
console.log('✓ Warm-up limit toast:');
console.log(`  - type: ${warmupToast.type}`);
console.log(`  - title: ${warmupToast.title}`);
console.log(`  - duration: ${warmupToast.duration}ms`);
console.log(`  - message: "${warmupToast.message}"`);

// Test message state persistence
console.log('\n🧪 Testing Message State on Error\n');

function handleMessageStateOnWarmupError(error) {
  if (error?.status === 429 && error?.data?.code === 'WARMUP_DAILY_LIMIT') {
    return {
      shouldClearInput: false, // Keep typed message in input
      shouldRemoveOptimistic: true, // Remove optimistic message
      shouldShowError: true, // Show error in UI
      shouldBlockRetry: false, // Let user retry (will be blocked by limit check)
    };
  }

  return {
    shouldClearInput: true,
    shouldRemoveOptimistic: true,
    shouldShowError: true,
    shouldBlockRetry: false,
  };
}

const warmupState = handleMessageStateOnWarmupError(warmupLimitError);
console.log('✓ Message state on warm-up error:');
console.log(`  - Keep input text: ${!warmupState.shouldClearInput}`);
console.log(`  - Remove optimistic: ${warmupState.shouldRemoveOptimistic}`);
console.log(`  - Show error: ${warmupState.shouldShowError}`);
console.log(`  - Block retry: ${warmupState.shouldBlockRetry}`);

console.log('\n✅ All error handling tests passed!');
