import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL!);

export function startRedisKeepAlive(intervalMs = 1000 * 60 * 60 * 24) {
  setInterval(async () => {
    try {
      const pong = await redis.ping();
      console.log(`[Redis KeepAlive] PING → ${pong}`);
    } catch (err) {
      console.error(`[Redis KeepAlive] Error:`, err);
    }
  }, intervalMs);
}
