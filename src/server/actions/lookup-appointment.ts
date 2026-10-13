// src/server/actions/lookup-appointment.ts
// Takip kodu + telefon ile SALT OKUNUR sorgu. İptal/taşıma yetkisi vermez: o yetki yalnızca
// 256-bit yönetim token'ında kalır (takip kodu + telefon tahmin edilebilir/ifşa olabilir).
"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { DomainError, handleActionError, type ActionResult } from "@/lib/errors";
import { checkRateLimit, rateLimitedResult } from "@/lib/rate-limit";
import { TurkishMobilePhoneSchema } from "@/server/schemas/appointment.schema";
import type { AppointmentLookupResult } from "@/types/booking";

const Schema = z.object({
  referenceCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^BRB-[A-Z0-9-]{4,32}$/, "Takip kodu BRB- ile başlar (örnek: BRB-M9K2-7E3B1A9F)."),
  customerPhone: TurkishMobilePhoneSchema,
});

export async function lookupAppointment(rawInput: unknown): Promise<ActionResult<AppointmentLookupResult>> {
  const parsed = Schema.safeParse(rawInput);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      success: false,
      error: { code: "INVALID_INPUT", message: issue?.message ?? "Geçersiz istek." },
    };
  }
  const { referenceCode, customerPhone } = parsed.data;

  // Kod/telefon denemelerine karşı iptal/taşıma ile aynı IP kotası
  const limit = await checkRateLimit("manage");
  if (!limit.ok) return rateLimitedResult(limit.retryAfterSec);

  try {
    const appt = await prisma.appointment.findFirst({
      where: { referenceCode, customerPhone },
      include: {
        items: { orderBy: { orderIndex: "asc" }, select: { serviceName: true } },
        staff: { select: { user: { select: { name: true } } } },
      },
    });
    // Kod mu telefon mu yanlış, ayrım yapılmaz (bilgi sızdırmamak için)
    if (!appt) {
      throw new DomainError("NOT_FOUND", "Bu takip kodu ve telefon numarasıyla eşleşen bir randevu bulunamadı.");
    }

    return {
      success: true,
      data: {
        referenceCode: appt.referenceCode,
        status: appt.status,
        startTime: appt.startTime.toISOString(),
        endTime: appt.endTime.toISOString(),
        staffName: appt.staff.user.name,
        services: appt.items.map((i) => i.serviceName),
        totalPrice: appt.totalPrice.toFixed(2),
      },
    };
  } catch (err) {
    return handleActionError(err);
  }
}
