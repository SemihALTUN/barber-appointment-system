// src/components/landing/shop-hours.tsx
// Saat duruma bağlı içerik yalnızca istemcide hesaplanır: sayfa önbelleklense de "açık/kapalı" bilgisi güncel kalır.
"use client";

import { useEffect, useState } from "react";
import { SHOP } from "@/config/shop";
import { cn } from "@/lib/utils";
import { getIstanbulDateParts } from "@/lib/timezone";
import { DAY_NAMES, DISPLAY_ORDER, getOpenState, type OpenState } from "@/lib/shop-hours";

function useNow(intervalMs: number): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function describe(state: OpenState): string {
  // Saatlere ek getirilmez ("09:00'da" / "21:00'de"): ünlü uyumu saate göre değişir.
  if (state.open) return `Şu an açığız. Kapanış saati ${state.closesAt}`;
  if (!state.nextOpen) return "Şu an kapalıyız";
  return `Şu an kapalıyız. Açılış: ${state.nextOpen.dayLabel} ${state.nextOpen.time}`;
}

export function OpenStatus({ className }: { className?: string }) {
  const now = useNow(60_000);
  const state = now ? getOpenState(SHOP.hours, now) : null;

  return (
    <p className={cn("flex min-h-6 items-center gap-2 text-sm", className)} aria-live="polite">
      {state && (
        <>
          <span
            aria-hidden
            className={cn("size-2 rounded-full border border-current", state.open ? "bg-current" : "bg-transparent")}
          />
          {describe(state)}
        </>
      )}
    </p>
  );
}

export function HoursTable() {
  const now = useNow(60_000);
  const today = now ? getIstanbulDateParts(now).dayOfWeek : null;
  const byDay = new Map(SHOP.hours.map((h) => [h.day, h]));

  return (
    <table className="w-full text-base">
      <caption className="sr-only">Haftalık çalışma saatleri</caption>
      <tbody>
        {DISPLAY_ORDER.map((day) => {
          const h = byDay.get(day);
          const isToday = day === today;
          return (
            <tr
              key={day}
              aria-current={isToday ? "date" : undefined}
              className={cn("border-b border-border last:border-0", isToday && "font-semibold")}
            >
              <th scope="row" className="py-3 text-left font-[inherit]">
                {DAY_NAMES[day]}
                {isToday && (
                  <span className="ml-2 rounded-sm bg-primary px-1.5 py-0.5 text-xs font-medium text-primary-foreground">bugün</span>
                )}
              </th>
              <td className="py-3 text-right tabular-nums">
                {h?.open && h.close ? `${h.open} – ${h.close}` : <span className="text-muted-foreground">Kapalı</span>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
