// src/lib/format.ts — Görüntüleme biçimleyicileri (tr-TR, Europe/Istanbul)
const TZ = "Europe/Istanbul";

const priceFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
const timeFormatter = new Intl.DateTimeFormat("tr-TR", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const longDateFormatter = new Intl.DateTimeFormat("tr-TR", {
  timeZone: TZ,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function formatPrice(amount: string | number): string {
  return priceFormatter.format(typeof amount === "string" ? Number(amount) : amount);
}

/** Kuruş bazında toplar; kayan nokta hatası üretmez. */
export function sumPrices(prices: readonly string[]): string {
  const cents = prices.reduce((sum, p) => sum + Math.round(Number(p) * 100), 0);
  return (cents / 100).toFixed(2);
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} dk`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} sa ${m} dk` : `${h} sa`;
}

export const formatTime = (value: string | Date): string => timeFormatter.format(new Date(value));
export const formatLongDate = (value: string | Date): string => longDateFormatter.format(new Date(value));
