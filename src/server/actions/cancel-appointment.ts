// src/server/actions/cancel-appointment.ts
"use server";

import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { ManageTokenSchema } from "@/server/schemas/appointment.schema";
import { DomainError, handleActionError, type ActionResult } from "@/lib/errors";
import { checkRateLimit, rateLimitedResult } from "@/lib/rate-limit";

const CANCEL_WINDOW_MS = 2 * 60 * 60 * 1000;

export async function cancelAppointmentByToken(
  rawManageToken: string,
  __testHooks?: { onLocked?: () => Promise<void> } // Yalnızca NODE_ENV=test'te etkin
): Promise<ActionResult<{ status: "CANCELLED" }>> {
  // Biçimsiz/eksik token → FORBIDDEN (iç hata değil)
  const tokenParse = ManageTokenSchema.safeParse(rawManageToken);
  if (!tokenParse.success) {
    return { success: false, error: { code: "FORBIDDEN", message: "Geçersiz yönetim bağlantısı." } };
  }
  const onLocked = process.env.NODE_ENV === "test" ? __testHooks?.onLocked : undefined;

  const limit = await checkRateLimit("manage");
  if (!limit.ok) return rateLimitedResult(limit.retryAfterSec);

  try {
    const hash = createHash("sha256").update(tokenParse.data).digest("hex");

    await prisma.$transaction(async (tx) => {
      // 1. Randevu satır kilidi (taşıma ile karşılıklı serileştirme)
      const [locked] = await tx.$queryRaw<Array<{ id: string; status: string; startTime: Date }>>`
        SELECT id, status, "startTime"
        FROM "Appointment"
        WHERE "manageTokenHash" = ${hash}
        FOR UPDATE
      `;
      if (!locked) throw new DomainError("FORBIDDEN", "Geçersiz yönetim bağlantısı.");

      // TEST KANCASI (Test 9A): kilit tutulurken eşzamanlı taşımanın bloklandığını doğrulamak için
      if (onLocked) await onLocked();

      // 2. Kilit altında durum doğrulaması
      if (locked.status === "CANCELLED") {
        throw new DomainError("ALREADY_CANCELLED", "Bu randevu daha önce iptal edilmiş.");
      }
      if (locked.status !== "CONFIRMED") {
        throw new DomainError("INVALID_TIMEFRAME", "Tamamlanmış randevular iptal edilemez.");
      }

      // 3. 2 saatlik pencere — kilit beklemesi sonrasında güncel saatle (taşınmış startTime dahil)
      if (locked.startTime.getTime() - Date.now() < CANCEL_WINDOW_MS) {
        throw new DomainError("CANCEL_WINDOW_EXPIRED", "Randevuya 2 saatten az kaldığı için iptal edilemez.");
      }

      // 4. Koşullu atomik durum güncellemesi
      const result = await tx.appointment.updateMany({
        where: { id: locked.id, status: "CONFIRMED" },
        data: { status: "CANCELLED" },
      });
      if (result.count === 0) {
        throw new DomainError("ALREADY_CANCELLED", "Randevu durumu eşzamanlı bir işlem tarafından değiştirildi.");
      }
    });

    return { success: true, data: { status: "CANCELLED" } };
  } catch (err) {
    return handleActionError(err);
  }
}
