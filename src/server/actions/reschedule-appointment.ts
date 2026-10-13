// src/server/actions/reschedule-appointment.ts
"use server";

import { createHash, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { RescheduleAppointmentSchema } from "@/server/schemas/appointment.schema";
import { getIstanbulDateParts, isWithinShift, isWithinSameIstanbulDay } from "@/lib/timezone";
import { DomainError, handleActionError, type ActionResult, type ErrorCode } from "@/lib/errors";
import { checkRateLimit, rateLimitedResult } from "@/lib/rate-limit";
import { getSessionActor } from "@/server/auth/session-actor";
import { toAppointmentDTO, type AppointmentDTO } from "@/server/dto/appointment.dto";

const CUSTOMER_CHANGE_WINDOW_MS = 2 * 60 * 60 * 1000;

/** SHA-256 hex özetlerini sabit zamanlı karşılaştırır. */
function tokenMatchesHash(rawToken: string, storedHash: string): boolean {
  const candidate = createHash("sha256").update(rawToken).digest();
  const stored = Buffer.from(storedHash, "hex");
  return stored.length === candidate.length && timingSafeEqual(candidate, stored);
}

function zodPathToErrorCode(path: ReadonlyArray<string | number>): ErrorCode {
  switch (path[0]) {
    case "newStartTime":
      return "INVALID_TIMEFRAME";
    case "appointmentId":
      return "NOT_FOUND";
    case "rawManageToken":
      return "FORBIDDEN";
    default:
      return "INVALID_INPUT";
  }
}

export async function rescheduleAppointment(input: {
  appointmentId: string;
  newStartTime: Date;
  rawManageToken?: string; // Müşteri self-servis yönetim token'ı
  __testHooks?: { onLocked?: () => Promise<void> }; // Yalnızca NODE_ENV=test'te etkin
}): Promise<ActionResult<AppointmentDTO>> {
  // z.object bilinmeyen anahtarları (__testHooks dahil) ayıklar.
  const parsed = RescheduleAppointmentSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      success: false,
      error: {
        code: issue ? zodPathToErrorCode(issue.path) : "INVALID_INPUT",
        message: issue?.message ?? "Geçersiz istek.",
      },
    };
  }
  const { appointmentId, newStartTime, rawManageToken } = parsed.data;
  const onLocked = process.env.NODE_ENV === "test" ? input?.__testHooks?.onLocked : undefined;

  const limit = await checkRateLimit("manage");
  if (!limit.ok) return rateLimitedResult(limit.retryAfterSec);

  try {
    // Oturum, kilitler alınmadan önce çözülür (kilit süresini kısaltır).
    const actor = await getSessionActor();

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Randevu satır kilidi (iptal ile karşılıklı serileştirme)
      const [locked] = await tx.$queryRaw<
        Array<{
          id: string;
          status: string;
          staffId: string;
          manageTokenHash: string;
          startTime: Date;
          totalDurationMinutes: number;
        }>
      >`
        SELECT id, status, "staffId", "manageTokenHash", "startTime", "totalDurationMinutes"
        FROM "Appointment"
        WHERE id = ${appointmentId}
        FOR UPDATE
      `;
      if (!locked) throw new DomainError("NOT_FOUND", "Randevu bulunamadı.");

      // TEST KANCASI (Test 9B): kilit tutulurken eşzamanlı iptalin bloklandığını doğrulamak için
      if (onLocked) await onLocked();

      // 2. Yetkilendirme (durum bilgisi yetkisiz çağırana sızmasın diye önce)
      const isAdmin = actor?.role === "ADMIN";
      const isOwnerStaff = actor?.role === "STAFF" && actor.staffId === locked.staffId;
      const isTokenHolder =
        !isAdmin &&
        !isOwnerStaff &&
        rawManageToken !== undefined &&
        tokenMatchesHash(rawManageToken, locked.manageTokenHash);

      if (!isAdmin && !isOwnerStaff && !isTokenHolder) {
        throw new DomainError("FORBIDDEN", "Bu randevuyu taşımak için yetkiniz bulunmamaktadır.");
      }

      // 3. Kilit altında durum doğrulaması
      if (locked.status !== "CONFIRMED") {
        throw new DomainError("INVALID_TIMEFRAME", "Yalnızca onaylı randevular taşınabilir.");
      }

      // 4. Müşteri self-servis 2 saat penceresi (mevcut başlangıç saatine göre)
      if (isTokenHolder && locked.startTime.getTime() - Date.now() < CUSTOMER_CHANGE_WINDOW_MS) {
        throw new DomainError(
          "CANCEL_WINDOW_EXPIRED",
          "Randevuya 2 saatten az kaldığı için müşteri tarafından değiştirilemez."
        );
      }

      // 5. Ortak personel satır kilidi (kilit sırası: Appointment → Staff)
      await tx.$queryRaw`SELECT id FROM "Staff" WHERE id = ${locked.staffId} FOR UPDATE`;

      const newEndTime = new Date(newStartTime.getTime() + locked.totalDurationMinutes * 60_000);

      // 6. Gece yarısı ve vardiya kontrolü
      if (!isWithinSameIstanbulDay(newStartTime, newEndTime)) {
        throw new DomainError("INVALID_TIMEFRAME", "Taşınan randevu gece yarısını aşamaz.");
      }
      const { dayOfWeek } = getIstanbulDateParts(newStartTime);
      const shifts = await tx.workingShift.findMany({ where: { staffId: locked.staffId, dayOfWeek } });
      if (!shifts.some((s) => isWithinShift(newStartTime, newEndTime, s))) {
        throw new DomainError("INVALID_TIMEFRAME", "Yeni saat berberin çalışma saatleri dışındadır.");
      }

      // 7. Kendisi dışındaki aktif randevularla çakışma
      const overlap = await tx.appointment.findFirst({
        where: {
          staffId: locked.staffId,
          status: "CONFIRMED",
          id: { not: locked.id },
          AND: [{ startTime: { lt: newEndTime } }, { endTime: { gt: newStartTime } }],
        },
        select: { id: true },
      });
      if (overlap) throw new DomainError("SLOT_UNAVAILABLE", "Hedef saat aralığı başka bir randevu ile dolu.");

      // 8. Mola çakışması
      const blockOverlap = await tx.timeBlock.findFirst({
        where: {
          staffId: locked.staffId,
          AND: [{ startTime: { lt: newEndTime } }, { endTime: { gt: newStartTime } }],
        },
        select: { id: true },
      });
      if (blockOverlap) throw new DomainError("SLOT_UNAVAILABLE", "Hedef saat aralığında berber müsait değil.");

      // 9. Çift katmanlı koşullu atomik güncelleme (FOR UPDATE + status: CONFIRMED)
      const result = await tx.appointment.updateMany({
        where: { id: locked.id, status: "CONFIRMED" },
        data: { startTime: newStartTime, endTime: newEndTime },
      });
      if (result.count === 0) {
        throw new DomainError("INVALID_TIMEFRAME", "Randevu durumu taşıma sırasında değişti (iptal edilmiş olabilir).");
      }

      return tx.appointment.findUniqueOrThrow({ where: { id: locked.id }, include: { items: true } });
    });

    return { success: true, data: toAppointmentDTO(updated) };
  } catch (err) {
    return handleActionError(err);
  }
}
