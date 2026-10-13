// src/lib/phone-hash.ts — NoShowTracker için HMAC-SHA256(phone, PEPPER)
import { createHmac } from "crypto";

function getPepper(): { pepper: string; version: number } {
  const pepper = process.env.NO_SHOW_PEPPER;
  if (!pepper || pepper.length < 32) {
    throw new Error("NO_SHOW_PEPPER tanımlı değil veya 32 karakterden kısa.");
  }
  const version = Number.parseInt(process.env.NO_SHOW_PEPPER_VERSION ?? "1", 10);
  if (!Number.isInteger(version) || version < 1) {
    throw new Error("NO_SHOW_PEPPER_VERSION pozitif bir tam sayı olmalıdır.");
  }
  return { pepper, version };
}

export function hashPhone(phone: string): { hash: string; keyVersion: number } {
  const { pepper, version } = getPepper();
  return { hash: createHmac("sha256", pepper).update(phone).digest("hex"), keyVersion: version };
}

export function isPhoneHashConfigured(): boolean {
  try {
    getPepper();
    return true;
  } catch {
    return false;
  }
}
