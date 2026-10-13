// src/lib/timezone.ts
export const APP_TIMEZONE = "Europe/Istanbul";

export interface IstanbulDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  dayOfWeek: number; // 0: Pazar ... 6: Cumartesi
}

// hourCycle "h23": bazı motorlarda hour12:false gece yarısını "24" olarak döndürür.
const formatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const WEEKDAY_MAP: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function getIstanbulDateParts(date: Date): IstanbulDateParts {
  const parts = formatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";

  return {
    year: parseInt(get("year"), 10),
    month: parseInt(get("month"), 10),
    day: parseInt(get("day"), 10),
    hour: parseInt(get("hour"), 10) % 24,
    minute: parseInt(get("minute"), 10),
    second: parseInt(get("second"), 10),
    dayOfWeek: WEEKDAY_MAP[get("weekday")] ?? 0,
  };
}

/**
 * Randevu ve mola saatlerinin aralığı (dakika). Tüm sistem bu tek değeri kullanır:
 * uygun saat listesi, sunucu doğrulaması ve personel panelindeki mola seçimi.
 * 60'ı tam bölen bir değer olmalıdır (15, 20, 30, 60).
 */
export const SLOT_INTERVAL_MINUTES = 30;

// 1. Milisaniye duyarlı randevu ızgarası doğrulaması (30 dk için: :00 ve :30, 00 sn, 000 ms)
export function isOnSlotGrid(date: Date): boolean {
  const parts = getIstanbulDateParts(date);
  return parts.minute % SLOT_INTERVAL_MINUTES === 0 && parts.second === 0 && date.getMilliseconds() === 0;
}

// 2. Gece yarısı aşımı koruması (aynı yerel takvim günü doğrulaması)
export function isWithinSameIstanbulDay(startTimeUtc: Date, endTimeUtc: Date): boolean {
  const s = getIstanbulDateParts(startTimeUtc);
  const e = getIstanbulDateParts(endTimeUtc);
  return s.year === e.year && s.month === e.month && s.day === e.day;
}

// 3. Vardiya saati string'ini ("09:00") hedef tarihin UTC Date nesnesine dönüştürme
export function parseIstanbulTimeToUtc(baseDate: Date, timeStr: string): Date {
  const parts = getIstanbulDateParts(baseDate);
  const m = String(parts.month).padStart(2, "0");
  const d = String(parts.day).padStart(2, "0");
  return new Date(`${parts.year}-${m}-${d}T${timeStr}:00.000+03:00`);
}

// 4. Vardiya sınırları ve bitiş taşması kontrolü
export function isWithinShift(
  startTimeUtc: Date,
  endTimeUtc: Date,
  shift: { startTime: string; endTime: string }
): boolean {
  const HHMM = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
  if (!HHMM.test(shift.startTime) || !HHMM.test(shift.endTime)) return false;

  // Randevu aynı gün içinde tamamlanmalıdır
  if (!isWithinSameIstanbulDay(startTimeUtc, endTimeUtc)) return false;

  const shiftStartUtc = parseIstanbulTimeToUtc(startTimeUtc, shift.startTime);
  const shiftEndUtc = parseIstanbulTimeToUtc(startTimeUtc, shift.endTime);

  // Randevu vardiya başlangıcından önce başlayamaz, vardiya bitişinden sonraya sarkamaz
  return startTimeUtc >= shiftStartUtc && endTimeUtc <= shiftEndUtc;
}
