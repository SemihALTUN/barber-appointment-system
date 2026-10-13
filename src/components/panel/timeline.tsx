// src/components/panel/timeline.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarX } from "lucide-react";
import { formatPrice, formatTime, sumPrices } from "@/lib/format";
import type { PanelAppointment, PanelDaySchedule, PanelTimeBlock } from "@/types/panel";
import { AddBreakDialog } from "./add-break-dialog";
import { AppointmentCard } from "./appointment-card";
import { TimeBlockCard } from "./time-block-card";

type Entry =
  | { kind: "appointment"; id: string; startTime: string; endTime: string; data: PanelAppointment }
  | { kind: "block"; id: string; startTime: string; endTime: string; data: PanelTimeBlock };

const REFRESH_INTERVAL_MS = 60_000;
const CLOCK_INTERVAL_MS = 30_000;

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border bg-card p-3 text-center">
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export function Timeline({ schedule, serverNow }: { schedule: PanelDaySchedule; serverNow: number }) {
  const router = useRouter();
  const [now, setNow] = useState(serverNow); // Sunucu saatiyle başlar → hydration farkı yok

  useEffect(() => {
    const clock = setInterval(() => setNow(Date.now()), CLOCK_INTERVAL_MS);
    // Yeni müşteri randevuları için sekme görünürken periyodik yenileme
    const refresh = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, REFRESH_INTERVAL_MS);
    return () => {
      clearInterval(clock);
      clearInterval(refresh);
    };
  }, [router]);

  const entries = useMemo<Entry[]>(
    () =>
      [
        ...schedule.appointments.map(
          (a): Entry => ({ kind: "appointment", id: a.id, startTime: a.startTime, endTime: a.endTime, data: a })
        ),
        ...schedule.timeBlocks.map(
          (b): Entry => ({ kind: "block", id: b.id, startTime: b.startTime, endTime: b.endTime, data: b })
        ),
      ].sort((x, y) => x.startTime.localeCompare(y.startTime)),
    [schedule]
  );

  const pending = schedule.appointments.filter((a) => a.status === "CONFIRMED").length;
  const completed = schedule.appointments.filter((a) => a.status === "COMPLETED");
  const noShows = schedule.appointments.filter((a) => a.status === "NO_SHOW").length;
  const revenue = sumPrices(completed.map((a) => a.totalPrice));

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {schedule.staffName} ·{" "}
        {schedule.shifts.length > 0
          ? `Mesai ${schedule.shifts.map((s) => `${s.startTime}–${s.endTime}`).join(", ")}`
          : "Bu gün mesai tanımlı değil"}
      </p>

      <div className="grid grid-cols-3 gap-2">
        <StatTile label="Bekleyen" value={pending} />
        <StatTile label="Tamamlanan" value={completed.length} />
        <StatTile label="Gelmeyen" value={noShows} />
      </div>
      {completed.length > 0 && (
        <p className="text-right text-sm text-muted-foreground">
          Tamamlanan ciro: <span className="font-semibold tabular-nums text-foreground">{formatPrice(revenue)}</span>
        </p>
      )}

      {entries.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card p-10 text-center text-muted-foreground">
          <CalendarX className="size-8" aria-hidden />
          <p>Bu gün için randevu veya mola yok.</p>
        </div>
      ) : (
        <ol className="space-y-3">
          {entries.map((entry) => (
            <li key={entry.id} className="flex gap-3">
              <div className="w-12 shrink-0 pt-3 text-right">
                <p className="text-sm font-semibold tabular-nums">{formatTime(entry.startTime)}</p>
                <p className="text-xs tabular-nums text-muted-foreground">{formatTime(entry.endTime)}</p>
              </div>
              <div className="min-w-0 flex-1">
                {entry.kind === "appointment" ? (
                  <AppointmentCard appointment={entry.data} now={now} />
                ) : (
                  <TimeBlockCard block={entry.data} />
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      <AddBreakDialog staffId={schedule.staffId} dateKey={schedule.dateKey} shifts={schedule.shifts} />
    </div>
  );
}
