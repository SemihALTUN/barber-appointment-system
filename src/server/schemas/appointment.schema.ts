// src/server/schemas/appointment.schema.ts
import { z } from "zod";
import { isOnSlotGrid } from "@/lib/timezone";

/** Yeni/taşınan randevu için asgari ileri zaman (rescheduleAppointment ile aynı kural). */
export const MIN_LEAD_TIME_MS = 15 * 60_000;
export const MAX_SERVICES_PER_APPOINTMENT = 5;

const cuid = z.string().cuid("Geçersiz kimlik formatı.");

/**
 * Date nesnesi veya offset'li ISO-8601 string kabul eder.
 * z.coerce.date() kullanılmıyor: null → 1970, sayı → epoch gibi sessiz dönüşümlere izin verir.
 */
const DateInput = z
  .union([z.date(), z.string().datetime({ offset: true })])
  .transform((v) => (v instanceof Date ? v : new Date(v)))
  .refine((d) => !Number.isNaN(d.getTime()), "Geçersiz tarih.");

/** Randevu ızgarasına (ms dahil) uyan ve en az 15 dk ileride olan randevu saati. */
export const AppointmentStartTimeSchema = DateInput.superRefine((d, ctx) => {
  if (!isOnSlotGrid(d)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Randevular yarım saat aralıklarla verilir (örneğin 10:00 veya 10:30).",
    });
    return;
  }
  if (d.getTime() < Date.now() + MIN_LEAD_TIME_MS) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Randevu en az 15 dakika sonrası için alınabilir.",
    });
  }
});

/** "0555 123 45 67", "905551234567", "5551234567" → "+905551234567" */
function normalizeTurkishMobile(raw: string): string {
  const digits = raw.replace(/[\s\-().]/g, "");
  if (/^\+90/.test(digits)) return digits;
  if (/^90\d{10}$/.test(digits)) return `+${digits}`;
  if (/^0\d{10}$/.test(digits)) return `+9${digits}`;
  if (/^5\d{9}$/.test(digits)) return `+90${digits}`;
  return digits;
}

export const TurkishMobilePhoneSchema = z
  .string()
  .trim()
  .transform(normalizeTurkishMobile)
  .pipe(z.string().regex(/^\+905\d{9}$/, "Geçerli bir Türkiye cep telefonu numarası giriniz."));

export const CustomerNameSchema = z
  .string()
  .trim()
  .min(2, "Ad en az 2 karakter olmalıdır.")
  .max(80, "Ad en fazla 80 karakter olabilir.");

const NotesSchema = z
  .string()
  .trim()
  .max(500, "Not en fazla 500 karakter olabilir.")
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined));

/**
 * Yönetim token'ı: üretimde 64 karakter hex'tir, ancak burada format zorlanmaz.
 * Biçimsiz token'lar da FORBIDDEN almalıdır (Test 7), doğrulama hatası değil.
 */
export const ManageTokenSchema = z.string().min(1).max(256);

export const CreateAppointmentSchema = z.object({
  staffId: cuid,
  serviceIds: z
    .array(cuid)
    .min(1, "En az bir hizmet seçilmelidir.")
    .max(MAX_SERVICES_PER_APPOINTMENT, `En fazla ${MAX_SERVICES_PER_APPOINTMENT} hizmet seçilebilir.`)
    .refine((ids) => new Set(ids).size === ids.length, "Aynı hizmet birden fazla seçilemez."),
  startTime: AppointmentStartTimeSchema,
  customerName: CustomerNameSchema,
  customerPhone: TurkishMobilePhoneSchema,
  notes: NotesSchema,
});

/** __testHooks bilinçli olarak şemada yok: z.object bilinmeyen anahtarları ayıklar. */
export const RescheduleAppointmentSchema = z.object({
  appointmentId: cuid,
  newStartTime: AppointmentStartTimeSchema,
  rawManageToken: ManageTokenSchema.optional(),
});

export const CancelAppointmentSchema = z.object({
  rawManageToken: ManageTokenSchema,
});

export type CreateAppointmentInput = z.output<typeof CreateAppointmentSchema>;
export type RescheduleAppointmentInput = z.output<typeof RescheduleAppointmentSchema>;
export type CancelAppointmentInput = z.output<typeof CancelAppointmentSchema>;
