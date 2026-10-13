// src/server/actions/get-available-slots.ts
"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DomainError, handleActionError, type ActionResult } from "@/lib/errors";
import { isValidDateKey, isWithinBookingHorizon } from "@/lib/date-keys";
import { checkRateLimit, rateLimitedResult } from "@/lib/rate-limit";
import { MAX_SERVICES_PER_APPOINTMENT } from "@/server/schemas/appointment.schema";
import { computeAvailableSlots } from "@/server/queries/slots";
import type { SlotsResult } from "@/types/booking";

const Schema = z.object({
  staffId: z.string().cuid(),
  serviceIds: z
    .array(z.string().cuid())
    .min(1)
    .max(MAX_SERVICES_PER_APPOINTMENT)
    .refine((ids) => new Set(ids).size === ids.length),
  dateKey: z.string().refine(isValidDateKey),
});

export async function getAvailableSlots(rawInput: unknown): Promise<ActionResult<SlotsResult>> {
  const parsed = Schema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: { code: "INVALID_INPUT", message: "Geçersiz istek." } };
  }
  const { staffId, serviceIds, dateKey } = parsed.data;

  const limit = await checkRateLimit("slots");
  if (!limit.ok) return rateLimitedResult(limit.retryAfterSec);

  if (!isWithinBookingHorizon(dateKey)) {
    return { success: false, error: { code: "INVALID_TIMEFRAME", message: "Bu tarih için randevu alınamaz." } };
  }

  try {
    const staff = await prisma.staff.findFirst({
      where: { id: staffId, isActive: true },
      select: { services: { select: { serviceId: true } } },
    });
    if (!staff) throw new DomainError("STAFF_NOT_ELIGIBLE", "Seçilen berber şu anda randevu kabul etmiyor.");

    const offered = new Set(staff.services.map((s) => s.serviceId));
    if (!serviceIds.every((id) => offered.has(id))) {
      throw new DomainError("STAFF_NOT_ELIGIBLE", "Berber seçilen hizmetlerin tümünü veremiyor.");
    }

    const services = await prisma.service.findMany({
      where: { id: { in: serviceIds }, isActive: true },
      select: { durationMinutes: true, price: true },
    });
    if (services.length !== serviceIds.length) {
      throw new DomainError("INVALID_SERVICE", "Seçilen hizmetlerden biri artık sunulmuyor.");
    }

    const durationMinutes = services.reduce((sum, s) => sum + s.durationMinutes, 0);
    const totalPrice = services.reduce((sum, s) => sum.add(s.price), new Prisma.Decimal(0));
    const slots = await computeAvailableSlots({ staffId, durationMinutes, dateKey });

    return { success: true, data: { dateKey, durationMinutes, totalPrice: totalPrice.toFixed(2), slots } };
  } catch (err) {
    return handleActionError(err);
  }
}
