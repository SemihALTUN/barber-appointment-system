// src/lib/redis-lock.ts
// Katman 1 — Dağıtık slot mutex'i (Upstash Redis, REST).
// Doğruluğun asıl garantisi DB katmanıdır (Staff FOR UPDATE + GiST exclusion).
import { Redis } from "@upstash/redis";

export interface LockResult {
  acquired: boolean;
  /** Redis devre dışı ya da erişilemez olduğu için kilit atlandı (DB katmanı korumaya devam eder). */
  bypassed?: boolean;
}

// Yalnızca token eşleşiyorsa siler → başka bir isteğin kilidini yanlışlıkla bırakmayı önler.
const RELEASE_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
else
  return 0
end
`;

let client: Redis | null = null;
let missingConfigWarned = false;

function isRedisDisabled(): boolean {
  // Çağrı anında okunur: testler import sonrası DISABLE_REDIS=true atayabilir.
  return process.env.DISABLE_REDIS === "true";
}

function getClient(): Redis | null {
  if (isRedisDisabled()) return null;
  if (client) return client;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    if (!missingConfigWarned) {
      console.warn("[REDIS_LOCK] UPSTASH_REDIS_REST_URL/TOKEN tanımlı değil; kilit katmanı atlanıyor.");
      missingConfigWarned = true;
    }
    return null;
  }

  client = new Redis({ url, token });
  return client;
}

export async function acquireSlotLock(key: string, token: string, ttlMs: number): Promise<LockResult> {
  if (!key || !token) throw new Error("acquireSlotLock: key ve token zorunludur.");
  if (!Number.isInteger(ttlMs) || ttlMs <= 0) {
    throw new Error("acquireSlotLock: ttlMs pozitif bir tam sayı olmalıdır.");
  }

  const redis = getClient();
  if (!redis) return { acquired: true, bypassed: true };

  try {
    const res = await redis.set(key, token, { nx: true, px: ttlMs });
    return { acquired: res === "OK" };
  } catch (err) {
    // Fail-open: Redis kesintisi rezervasyonu durdurmamalı; çakışmayı DB katmanı engeller.
    console.error("[REDIS_LOCK] acquire başarısız, DB katmanına devrediliyor:", err);
    return { acquired: true, bypassed: true };
  }
}

export async function releaseSlotLock(key: string, token: string): Promise<void> {
  const redis = getClient();
  if (!redis) return;

  try {
    await redis.eval(RELEASE_SCRIPT, [key], [token]);
  } catch (err) {
    // finally bloğunda çağrılır → asla throw etmez; TTL kilidi zaten düşürür.
    console.error("[REDIS_LOCK] release başarısız (TTL ile düşecek):", err);
  }
}
