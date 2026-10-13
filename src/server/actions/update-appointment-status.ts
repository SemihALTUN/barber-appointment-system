// src/server/actions/update-appointment-status.ts
"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { DomainError, handleActionError, type ActionResult } from "@/lib/errors";
import { hashPhone } from "@/lib/phone-hash";
import { getSessionActor } from "@/server/auth/session-actor";

const Schema = z.object({
  appointmentId: z.string().cuid(),
  status: z.enum(["COMPLETED", "NO_SHOW"]),
});

export async function updateAppointmentStatus(
  rawInput: unknown
): Promise<ActionResult<{ id: string; status: "COMPLETED" | "NO_SHOW" }>> {
  const parsed = Schema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: { code: "INVALID_INPUT", message: "Geçersiz istek." } };
  }
  const { appointmentId, status } = parsed.data;

  try {
    const actor = await getSessionActor();
    if (!actor) throw new DomainError("UNAUTHORIZED", "Bu işlem için oturum açmalısınız.");

    await prisma.$transaction(async (tx) => {
      // İptal/taşıma ile aynı satır kilidi → durum geçişleri serileşir
      const [locked] = await tx.$queryRaw<
        Array<{ id: string; status: string; staffId: string; startTime: Date; customerPhone: string }>
      >`
        SELECT id, status, "staffId", "startTime", "customerPhone"
        FROM "Appointment"
        WHERE id = ${appointmentId}
        FOR UPDATE
      `;
      if (!locked) throw new DomainError("NOT_FOUND", "Randevu bulunamadı.");

      const isAdmin = actor.role === "ADMIN";
      const isOwnerStaff = actor.role === "STAFF" && actor.staffId === locked.staffId;
      if (!isAdmin && !isOwnerStaff) {
        throw new DomainError("FORBIDDEN", "Bu randevuyu güncelleme yetkiniz yok.");
      }

      if (locked.status === "CANCELLED") {
        throw new DomainError("ALREADY_CANCELLED", "İptal edilmiş randevunun durumu değiştirilemez.");
      }
      if (locked.status !== "CONFIRMED") {
        throw new DomainError("INVALID_TIMEFRAME", "Bu randevunun durumu zaten güncellenmiş.");
      }
      if (Date.now() < locked.startTime.getTime()) {
        throw new DomainError("INVALID_TIMEFRAME", "Randevu saati gelmeden durum güncellenemez.");
      }

      const result = await tx.appointment.updateMany({
        where: { id: locked.id, status: "CONFIRMED" },
        data: { status },
      });
      if (result.count === 0) {
        throw new DomainError("INVALID_TIMEFRAME", "Randevu durumu eşzamanlı bir işlemle değişti.");
      }

      // NO_SHOW: telefonun HMAC özeti üzerinden sayaç (açık telefon saklanmaz).
      // Aynı transaction içinde → sayaç yazılamazsa durum değişikliği de geri alınır.
      if (status === "NO_SHOW") {
        const { hash, keyVersion } = hashPhone(locked.customerPhone);
        const now = new Date();
        await tx.noShowTracker.upsert({
          where: { phoneHash: hash },
          create: { phoneHash: hash, keyVersion, count: 1, lastNoShow: now },
          update: { count: { increment: 1 }, lastNoShow: now },
        });
      }
    });

    return { success: true, data: { id: appointmentId, status } };
  } catch (err) {
    return handleActionError(err);
  }
}
