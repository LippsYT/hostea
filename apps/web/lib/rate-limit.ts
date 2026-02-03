import Redis from 'ioredis';

type MemoryEntry = { count: number; expiresAt: number };
const memoryStore = new Map<string, MemoryEntry>();

const redisUrl = process.env.REDIS_URL;
export const redis = redisUrl ? new Redis(redisUrl) : null;

const memoryRateLimit = (key: string, limit: number, windowSeconds: number) => {
  const now = Date.now();
  const entry = memoryStore.get(key);
  if (!entry || entry.expiresAt < now) {
    memoryStore.set(key, { count: 1, expiresAt: now + windowSeconds * 1000 });
    return true;
  }
  entry.count += 1;
  memoryStore.set(key, entry);
  return entry.count <= limit;
};

export const rateLimit = async (key: string, limit: number, windowSeconds: number) => {
  if (!redis) {
    return memoryRateLimit(key, limit, windowSeconds);
  }
  try {
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, windowSeconds);
    }
    return current <= limit;
  } catch {
    return memoryRateLimit(key, limit, windowSeconds);
  }
};
