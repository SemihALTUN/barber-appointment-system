// src/server/cron/anonymize.ts — KVKK: 90 gün sonra kişisel veri anonimleştirme, 365 gün sonra no-show özeti silme
import { prisma } from "@/lib/prisma";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function runAnonymizationJob(cutoffDays = 90) {
  const cutoffDate = new Date(Date.now() - cutoffDays * DAY_MS);

  return prisma.$transaction(async (tx) => {
    // 1. Randevu kişisel verilerini temizleme (COMPLETED, CANCELLED, NO_SHOW)
    const updatedAppts = await tx.appointment.updateMany({
      where: {
        status: { in: ["COMPLETED", "CANCELLED", "NO_SHOW"] },
        endTime: { lt: cutoffDate },
        customerPhone: { not: "+900000000000" },
      },
      data: {
        customerName: "Anonim Müşteri",
        customerPhone: "+900000000000",
        notes: null,
      },
    });

    // 2. Sahipsiz misafir User kayıtlarını temizleme (phone = null → unique kısıtı ihlal edilmez)
    const updatedUsers = await tx.user.updateMany({
      where: {
        role: "CUSTOMER",
        phone: { not: null },
        appointments: {
          none: {
            OR: [{ status: "CONFIRMED" }, { endTime: { gte: cutoffDate } }],
          },
        },
      },
      data: { name: "Anonim Kullanıcı", email: null, phone: null },
    });

    // 3. 365 günü doldurmuş no-show hash kayıtlarını silme
    const oneYearAgo = new Date(Date.now() - 365 * DAY_MS);
    await tx.noShowTracker.deleteMany({ where: { lastNoShow: { lt: oneYearAgo } } });

    // 4. Denetim günlüğü
    const auditLog = await tx.anonymizationAuditLog.create({
      data: {
        recordsCount: updatedAppts.count,
        cleanedUsersCount: updatedUsers.count,
        status: "SUCCESS",
      },
    });

    return {
      anonymizedAppointments: updatedAppts.count,
      cleanedUsers: updatedUsers.count,
      auditLogId: auditLog.id,
    };
  });
}
