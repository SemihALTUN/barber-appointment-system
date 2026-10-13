// src/lib/date-keys.ts — "YYYY-MM-DD" İstanbul takvim günü anahtarları (client + server güvenli)
import { getIstanbulDateParts } from "@/lib/timezone";

export const BOOKING_HORIZON_DAYS = 30;

const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

/** Tarih anahtarını UTC öğlen anına çevirir; saat dilimi kaymalarından etkilenmez. */
function toUtcNoon(key: string): Date {
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d, 12));
}

export function isValidDateKey(key: string): boolean {
  if (!DATE_KEY_REGEX.test(key)) return false;
  const d = toUtcNoon(key);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === key;
}

export function addDaysToKey(key: string, days: number): string {
  const d = toUtcNoon(key);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function diffInDays(fromKey: string, toKey: string): number {
  return Math.round((toUtcNoon(toKey).getTime() - toUtcNoon(fromKey).getTime()) / DAY_MS);
}

export function dayOfWeekFromKey(key: string): number {
  return toUtcNoon(key).getUTCDay();
}

export function istanbulDateKey(date: Date = new Date()): string {
  const p = getIstanbulDateParts(date);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** İstanbul gece yarısının UTC karşılığı (Türkiye sabit UTC+3). */
export function istanbulDayStartUtc(key: string): Date {
  return new Date(`${key}T00:00:00.000+03:00`);
}

export function isWithinBookingHorizon(key: string, todayKey: string = istanbulDateKey()): boolean {
  const diff = diffInDays(todayKey, key);
  return diff >= 0 && diff < BOOKING_HORIZON_DAYS;
}

export function firstWorkingDayKey(
  startKey: string,
  workingDays: readonly number[],
  days: number = BOOKING_HORIZON_DAYS
): string | null {
  for (let i = 0; i < days; i++) {
    const key = addDaysToKey(startKey, i);
    if (workingDays.includes(dayOfWeekFromKey(key))) return key;
  }
  return null;
}

export function formatDateKey(key: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("tr-TR", { ...options, timeZone: "UTC" }).format(toUtcNoon(key));
}
