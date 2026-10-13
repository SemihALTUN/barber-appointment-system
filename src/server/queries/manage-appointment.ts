// src/server/queries/manage-appointment.ts
import "server-only";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import type { ManagedAppointmentView } from "@/types/booking";

const CHANGE_WINDOW_MS = 2 * 60 * 60 * 1000;

/** Referans kodu + token birlikte eşleşmezse null döner (varlık bilgisi sızdırılmaz). */
export async function getManagedAppointment(
  referenceCode: string,
  rawToken: string | undefined
): Promise<ManagedAppointmentView | null> {
  if (!rawToken || rawToken.length > 256 || referenceCode.length > 40) return null;

  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const appt = await prisma.appointment.findFirst({
    where: { referenceCode, manageTokenHash: tokenHash },
    include: {
      items: { orderBy: { orderIndex: "asc" } },
      staff: {
        select: { title: true, user: { select: { name: true } }, shifts: { select: { dayOfWeek: true } } },
      },
    },
  });
  if (!appt) return null;

  const deadline = new Date(appt.startTime.getTime() - CHANGE_WINDOW_MS);

  return {
    id: appt.id,
    referenceCode: appt.referenceCode,
    status: appt.status,
    customerName: appt.customerName,
    staffName: appt.staff.user.name,
    staffTitle: appt.staff.title,
    staffWorkingDays: [...new Set(appt.staff.shifts.map((s) => s.dayOfWeek))],
    startTime: appt.startTime.toISOString(),
    endTime: appt.endTime.toISOString(),
    totalDurationMinutes: appt.totalDurationMinutes,
    totalPrice: appt.totalPrice.toFixed(2),
    items: appt.items.map((i) => ({
      serviceName: i.serviceName,
      durationMinutes: i.durationMinutes,
      unitPrice: i.unitPrice.toFixed(2),
    })),
    canModify: appt.status === "CONFIRMED" && Date.now() < deadline.getTime(),
    modifyDeadline: deadline.toISOString(),
  };
}
