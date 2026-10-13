// src/server/actions/get-reschedule-slots.ts
"use server";

import { createHash } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { DomainError, handleActionError, type ActionResult } from "@/lib/errors";
import { isValidDateKey, isWithinBookingHorizon } from "@/lib/date-keys";
import { checkRateLimit, rateLimitedResult } from "@/lib/rate-limit";
import { ManageTokenSchema } from "@/server/schemas/appointment.schema";
import { computeAvailableSlots } from "@/server/queries/slots";
import type { SlotsResult } from "@/types/booking";

const CHANGE_WINDOW_MS = 2 * 60 * 60 * 1000;

const Schema = z.object({
  referenceCode: z.string().min(1).max(40),
  rawManageToken: ManageTokenSchema,
  dateKey: z.string().refine(isValidDateKey),
});

export async function getRescheduleSlots(rawInput: unknown): Promise<ActionResult<SlotsResult>> {
  const parsed = Schema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: { code: "INVALID_INPUT", message: "Geçersiz istek." } };
  }
  const { referenceCode, rawManageToken, dateKey } = parsed.data;

  const limit = await checkRateLimit("slots");
  if (!limit.ok) return rateLimitedResult(limit.retryAfterSec);

  if (!isWithinBookingHorizon(dateKey)) {
    return { success: false, error: { code: "INVALID_TIMEFRAME", message: "Bu tarih için randevu alınamaz." } };
  }

  try {
    const tokenHash = createHash("sha256").update(rawManageToken).digest("hex");
    const appt = await prisma.appointment.findFirst({
      where: { referenceCode, manageTokenHash: tokenHash },
      select: { id: true, staffId: true, status: true, startTime: true, totalDurationMinutes: true, totalPrice: true },
    });
    if (!appt) throw new DomainError("FORBIDDEN", "Geçersiz yönetim bağlantısı.");
    if (appt.status !== "CONFIRMED") {
      throw new DomainError("INVALID_TIMEFRAME", "Yalnızca onaylı randevular taşınabilir.");
    }
    if (appt.startTime.getTime() - Date.now() < CHANGE_WINDOW_MS) {
      throw new DomainError("CANCEL_WINDOW_EXPIRED", "Randevuya 2 saatten az kaldığı için değişiklik yapılamaz.");
    }

    const slots = await computeAvailableSlots({
      staffId: appt.staffId,
      durationMinutes: appt.totalDurationMinutes,
      dateKey,
      excludeAppointmentId: appt.id,
    });

    return {
      success: true,
      data: { dateKey, durationMinutes: appt.totalDurationMinutes, totalPrice: appt.totalPrice.toFixed(2), slots },
    };
  } catch (err) {
    return handleActionError(err);
  }
}
