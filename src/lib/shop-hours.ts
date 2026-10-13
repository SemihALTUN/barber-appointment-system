// src/lib/shop-hours.ts — Dükkân çalışma saatleri (yalnızca vitrin gösterimi; randevu saatleri personel vardiyalarından gelir)
import { getIstanbulDateParts } from "@/lib/timezone";

export interface DayHours {
  day: number; // 0: Pazar ... 6: Cumartesi
  open: string | null; // "09:00" — null ise kapalı
  close: string | null;
}

export const DAY_NAMES = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"] as const;

/** Türkiye'de hafta pazartesi başlar. */
export const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

export type OpenState =
  | { open: true; closesAt: string }
  | { open: false; nextOpen: { dayLabel: string; time: string } | null };

export function getOpenState(hours: readonly DayHours[], now: Date = new Date()): OpenState {
  const p = getIstanbulDateParts(now);
  const minutes = p.hour * 60 + p.minute;
  const byDay = new Map(hours.map((h) => [h.day, h]));

  const today = byDay.get(p.dayOfWeek);
  if (today?.open && today.close && minutes >= toMinutes(today.open) && minutes < toMinutes(today.close)) {
    return { open: true, closesAt: today.close };
  }

  for (let offset = 0; offset < 7; offset++) {
    const day = (p.dayOfWeek + offset) % 7;
    const h = byDay.get(day);
    if (!h?.open) continue;
    if (offset === 0 && minutes >= toMinutes(h.open)) continue; // Bugün açılış saati geçti
    const dayLabel = offset === 0 ? "Bugün" : offset === 1 ? "Yarın" : DAY_NAMES[day];
    return { open: false, nextOpen: { dayLabel, time: h.open } };
  }
  return { open: false, nextOpen: null };
}
