// src/lib/errors.ts
import { Prisma } from "@prisma/client";

export type ErrorCode =
  | "STAFF_NOT_ELIGIBLE"    // Berber bu hizmetleri veremiyor veya pasif
  | "INVALID_SERVICE"       // Yinelenen veya geçersiz hizmet seçimi
  | "INVALID_TIMEFRAME"     // Izgara dışı, gece yarısını aşan, vardiya dışı saat veya geçersiz durum geçişi
  | "INVALID_INPUT"         // Ad/telefon/not gibi alan doğrulama hataları
  | "SLOT_UNAVAILABLE"      // Dolu slot veya exclusion constraint ihlali (23P01)
  | "CANCEL_WINDOW_EXPIRED" // İptal/değişiklik süresi doldu (< 2 saat)
  | "ALREADY_CANCELLED"     // Randevu zaten iptal edilmiş
  | "RATE_LIMIT_EXCEEDED"   // Hız sınırı aşıldı
  | "UNAUTHORIZED"          // Oturum açılmamış
  | "FORBIDDEN"             // Yetkisiz işlem / geçersiz yönetim token'ı
  | "NOT_FOUND"             // Kayıt bulunamadı
  | "INTERNAL_ERROR";       // Beklenmeyen iç sistem hatası

export class DomainError extends Error {
  constructor(public code: ErrorCode, message: string) {
    super(message);
    this.name = "DomainError";
  }
}

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: ErrorCode; message: string } };

// Normal (raw olmayan) Prisma sorgularında 23P01 her zaman P2010 olarak gelmeyebilir;
// mesaj tabanlı yedek kontrol hem Known hem Unknown hata sınıflarını kapsar.
export function isExclusionViolation(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const metaCode = (error.meta as { code?: unknown } | undefined)?.code;
    if (metaCode === "23P01") return true;
  }
  if (
    error instanceof Prisma.PrismaClientKnownRequestError ||
    error instanceof Prisma.PrismaClientUnknownRequestError
  ) {
    return /23P01|no_overlapping_appointments|exclusion constraint/i.test(error.message);
  }
  return false;
}

export function handleActionError(error: unknown): ActionResult<never> {
  if (error instanceof DomainError) {
    return { success: false, error: { code: error.code, message: error.message } };
  }
  if (isExclusionViolation(error)) {
    return {
      success: false,
      error: {
        code: "SLOT_UNAVAILABLE",
        message: "Seçilen saat aralığı az önce doldu. Lütfen başka bir saat seçin.",
      },
    };
  }
  console.error("[INTERNAL_ERROR_AUDIT]:", error);
  return {
    success: false,
    error: { code: "INTERNAL_ERROR", message: "İşlem tamamlanamadı. Lütfen tekrar deneyin." },
  };
}
