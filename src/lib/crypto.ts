// src/lib/crypto.ts
import crypto from "crypto";

export function generateSecureReferenceCode(): string {
  const timeFragment = Date.now().toString(36).slice(-4).toUpperCase();
  const randFragment = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `BRB-${timeFragment}-${randFragment}`; // Örn: BRB-M9K2-7E3B1A9F
}

export function generateSecureManageTokenPair(): { rawToken: string; tokenHash: string } {
  const rawToken = crypto.randomBytes(32).toString("hex"); // 64 karakter hex (kullanıcıya iletilir)
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex"); // DB'de saklanır
  return { rawToken, tokenHash };
}
