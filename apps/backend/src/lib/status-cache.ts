/**
 * In-memory cache for WhatsApp session status
 * Prevents repeated database queries and speeds up dashboard loads
 */

interface CachedStatus {
  data: any;
  timestamp: number;
}

const cache = new Map<string, CachedStatus>();
const CACHE_TTL = 30 * 1000; // 30 seconds

export function getFromCache(key: string) {
  const cached = cache.get(key);
  if (!cached) return null;

  const age = Date.now() - cached.timestamp;
  if (age > CACHE_TTL) {
    cache.delete(key);
    return null;
  }

  return cached.data;
}

export function setInCache(key: string, data: any) {
  cache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

export function invalidateCache(key?: string) {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}

export function getCacheStats() {
  return {
    size: cache.size,
    entries: Array.from(cache.entries()).map(([key, value]) => ({
      key,
      age: Date.now() - value.timestamp,
    })),
  };
}
