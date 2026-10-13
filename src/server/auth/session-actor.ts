// src/server/auth/session-actor.ts
// @/lib/auth'tan ayrı tutuldu: testler yalnızca auth()'u mock'lar, bu mantık gerçek hâliyle çalışır.
import { Role } from "@prisma/client";
import { auth } from "@/lib/auth";

export type SessionActor = { userId: string; role: Role; staffId: string | null };

const ROLES = new Set<string>(Object.values(Role));

/**
 * İstek bağlamı yoksa (Vitest, cron) ya da oturum çözülemezse null döner.
 * null = ayrıcalık yok; yalnızca token tabanlı yollar açık kalır (fail-closed).
 */
export async function getSessionActor(): Promise<SessionActor | null> {
  try {
    const session = await auth();
    const user = session?.user;
    if (!user?.id || !ROLES.has(user.role)) return null;
    return { userId: user.id, role: user.role, staffId: user.staffId ?? null };
  } catch (err) {
    if (process.env.NODE_ENV !== "test") {
      console.error("[AUTH] Oturum çözülemedi:", err);
    }
    return null;
  }
}
