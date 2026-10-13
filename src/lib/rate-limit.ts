// src/lib/rate-limit.ts — Upstash sliding-window rate limit (fail-open, DISABLE_REDIS ile devre dışı)
// Not: "server-only" import edilmedi; bu modül Vitest'te çalışan action'lar tarafından import ediliyor.
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type { ActionResult } from "@/lib/errors";

type Window = `${number} ${"s" | "m" | "h"}`;
export type RateLimitName = "booking" | "slots" | "manage" | "login";

const RULES: Record<RateLimitName, { tokens: number; window: Window }> = {
  booking: { tokens: 5, window: "10 m" }, // IP başına yeni randevu
  slots: { tokens: 60, window: "1 m" },   // IP başına uygun saat sorgusu
  manage: { tokens: 20, window: "10 m" }, // IP başına iptal/taşıma (token denemelerine karşı)
  login: { tokens: 5, window: "15 m" },   // IP + e-posta başına giriş denemesi
};

let redis: Redis | null = null;
const limiters = new Map<RateLimitName, Ratelimit>();

function getLimiter(name: RateLimitName): Ratelimit | null {
  if (process.env.DISABLE_REDIS === "true") return null;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const client = (redis ??= new Redis({ url, token }));
  let limiter = limiters.get(name);
  if (!limiter) {
    const rule = RULES[name];
    limiter = new Ratelimit({
      redis: client,
      limiter: Ratelimit.slidingWindow(rule.tokens, rule.window),
      prefix: `rl:${name}`,
      ephemeralCache: new Map(), // Engellenmiş kimlikler için Redis'e gitmeden ret
    });
    limiters.set(name, limiter);
  }
  return limiter;
}

/** Vercel/proxy arkasında x-forwarded-for'un ilk girdisi istemci IP'sidir. */
async function getClientIp(): Promise<string> {
  try {
    // Dinamik import: limit kapalıyken (testler) next/headers hiç yüklenmez.
    const { headers } = await import("next/headers");
    const h = await headers();
    return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  } catch {
    return "unknown";
  }
}

export type RateLimitCheck = { ok: true } | { ok: false; retryAfterSec: number };

export async function checkRateLimit(name: RateLimitName, extraKey?: string): Promise<RateLimitCheck> {
  const limiter = getLimiter(name);
  if (!limiter) return { ok: true };

  const ip = await getClientIp();
  const identifier = extraKey ? `${ip}:${extraKey}` : ip;

  try {
    const res = await limiter.limit(identifier);
    if (res.success) return { ok: true };
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((res.reset - Date.now()) / 1000)) };
  } catch (err) {
    // Fail-open: Redis kesintisi hizmeti durdurmasın (kilit katmanıyla aynı tercih)
    console.error(`[RATE_LIMIT] ${name} kontrolü başarısız, istek geçiriliyor:`, err);
    return { ok: true };
  }
}

export function rateLimitedResult(retryAfterSec: number): ActionResult<never> {
  const minutes = Math.max(1, Math.ceil(retryAfterSec / 60));
  return {
    success: false,
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: `Çok fazla deneme yapıldı. Lütfen ${minutes} dakika sonra tekrar deneyin.`,
    },
  };
}
