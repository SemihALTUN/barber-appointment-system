// src/server/queries/panel-schedule.ts
import "server-only";
import { prisma } from "@/lib/prisma";
import { getIstanbulDateParts } from "@/lib/timezone";
import { istanbulDayStartUtc } from "@/lib/date-keys";
import { hashPhone, isPhoneHashConfigured } from "@/lib/phone-hash";
import type { PanelDaySchedule, PanelStaffOption } from "@/types/panel";

const DAY_MS = 86_400_000;

export async function getPanelStaffOptions(): Promise<PanelStaffOption[]> {
  const staff = await prisma.staff.findMany({
    where: { isActive: true },
    orderBy: { user: { name: "asc" } },
    select: { id: true, user: { select: { name: true } } },
  });
  return staff.map((s) => ({ id: s.id, name: s.user.name }));
}

async function getNoShowCounts(phones: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (phones.length === 0 || !isPhoneHashConfigured()) return counts;

  const pairs = [...new Set(phones)].map((phone) => ({ phone, hash: hashPhone(phone).hash }));
  const rows = await prisma.noShowTracker.findMany({
    where: { phoneHash: { in: pairs.map((p) => p.hash) } },
    select: { phoneHash: true, count: true },
  });
  const byHash = new Map(rows.map((r) => [r.phoneHash, r.count]));
  for (const { phone, hash } of pairs) {
    const count = byHash.get(hash);
    if (count) counts.set(phone, count);
  }
  return counts;
}

export async function getStaffDaySchedule(staffId: string, dateKey: string): Promise<PanelDaySchedule | null> {
  const dayStart = istanbulDayStartUtc(dateKey);
  const dayEnd = new Date(dayStart.getTime() + DAY_MS);
  const { dayOfWeek } = getIstanbulDateParts(dayStart);

  const staff = await prisma.staff.findUnique({
    where: { id: staffId },
    select: {
      id: true,
      user: { select: { name: true } },
      shifts: { where: { dayOfWeek }, orderBy: { startTime: "asc" }, select: { startTime: true, endTime: true } },
    },
  });
  if (!staff) return null;

  const [appointments, blocks] = await Promise.all([
    prisma.appointment.findMany({
      where: { staffId, startTime: { lt: dayEnd }, endTime: { gt: dayStart } },
      orderBy: { startTime: "asc" },
      include: { items: { orderBy: { orderIndex: "asc" }, select: { serviceName: true } } },
    }),
    prisma.timeBlock.findMany({
      where: { staffId, startTime: { lt: dayEnd }, endTime: { gt: dayStart } },
      orderBy: { startTime: "asc" },
    }),
  ]);

  const noShowCounts = await getNoShowCounts(appointments.map((a) => a.customerPhone));

  return {
    staffId: staff.id,
    staffName: staff.user.name,
    dateKey,
    shifts: staff.shifts,
    appointments: appointments.map((a) => ({
      id: a.id,
      referenceCode: a.referenceCode,
      status: a.status,
      customerName: a.customerName,
      customerPhone: a.customerPhone,
      startTime: a.startTime.toISOString(),
      endTime: a.endTime.toISOString(),
      totalDurationMinutes: a.totalDurationMinutes,
      totalPrice: a.totalPrice.toFixed(2),
      notes: a.notes,
      services: a.items.map((i) => i.serviceName),
      noShowCount: noShowCounts.get(a.customerPhone) ?? 0,
    })),
    timeBlocks: blocks.map((b) => ({
      id: b.id,
      startTime: b.startTime.toISOString(),
      endTime: b.endTime.toISOString(),
      type: b.type,
      reason: b.reason,
    })),
  };
}
