// src/server/queries/slots.ts
// Uygun saat hesaplaması bilgilendiricidir; kesin karar createAppointment/rescheduleAppointment kilitlerindedir.
import "server-only";
import { prisma } from "@/lib/prisma";
import {
  SLOT_INTERVAL_MINUTES,
  getIstanbulDateParts,
  isWithinSameIstanbulDay,
  parseIstanbulTimeToUtc,
} from "@/lib/timezone";
import { istanbulDayStartUtc } from "@/lib/date-keys";
import { formatTime } from "@/lib/format";
import { MIN_LEAD_TIME_MS } from "@/server/schemas/appointment.schema";
import type { SlotOption } from "@/types/booking";

const STEP_MS = SLOT_INTERVAL_MINUTES * 60_000;
const DAY_MS = 86_400_000;

export async function computeAvailableSlots(params: {
  staffId: string;
  durationMinutes: number;
  dateKey: string;
  excludeAppointmentId?: string;
  now?: Date;
}): Promise<SlotOption[]> {
  const { staffId, durationMinutes, dateKey, excludeAppointmentId } = params;
  const now = params.now ?? new Date();
  const durationMs = durationMinutes * 60_000;
  const dayStart = istanbulDayStartUtc(dateKey);
  const dayEnd = new Date(dayStart.getTime() + DAY_MS);
  const { dayOfWeek } = getIstanbulDateParts(dayStart);

  const [shifts, appointments, blocks] = await Promise.all([
    prisma.workingShift.findMany({
      where: { staffId, dayOfWeek },
      select: { startTime: true, endTime: true },
    }),
    prisma.appointment.findMany({
      where: {
        staffId,
        status: "CONFIRMED",
        ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
        startTime: { lt: dayEnd },
        endTime: { gt: dayStart },
      },
      select: { startTime: true, endTime: true },
    }),
    prisma.timeBlock.findMany({
      where: { staffId, startTime: { lt: dayEnd }, endTime: { gt: dayStart } },
      select: { startTime: true, endTime: true },
    }),
  ]);

  const busy = [...appointments, ...blocks].map((r) => ({
    start: r.startTime.getTime(),
    end: r.endTime.getTime(),
  }));
  const earliest = now.getTime() + MIN_LEAD_TIME_MS;
  const starts = new Set<number>();

  for (const shift of shifts) {
    const shiftStart = parseIstanbulTimeToUtc(dayStart, shift.startTime).getTime();
    const shiftEnd = parseIstanbulTimeToUtc(dayStart, shift.endTime).getTime();

    // UTC ızgara hizası = İstanbul ızgara hizası (Türkiye tam saat offset: UTC+3)
    for (let t = Math.ceil(shiftStart / STEP_MS) * STEP_MS; t + durationMs <= shiftEnd; t += STEP_MS) {
      if (t < earliest) continue;
      const end = t + durationMs;
      if (busy.some((b) => b.start < end && b.end > t)) continue;
      if (!isWithinSameIstanbulDay(new Date(t), new Date(end))) continue;
      starts.add(t);
    }
  }

  return [...starts]
    .sort((a, b) => a - b)
    .map((t) => {
      const d = new Date(t);
      return { startTime: d.toISOString(), label: formatTime(d) };
    });
}
