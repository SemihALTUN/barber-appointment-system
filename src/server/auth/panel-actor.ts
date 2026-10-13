// src/server/auth/panel-actor.ts
import "server-only";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionActor } from "@/server/auth/session-actor";

export type PanelActor =
  | { userId: string; role: "ADMIN"; staffId: string | null }
  | { userId: string; role: "STAFF"; staffId: string };

/**
 * Panel erişimi için oturum + DB kontrolü.
 * STAFF için personelin hâlâ aktif olduğu doğrulanır (JWT'deki 8 saatlik önbellek açığını sayfalarda kapatır).
 */
export async function getPanelActor(): Promise<PanelActor | null> {
  const actor = await getSessionActor();
  if (actor?.role === "ADMIN") {
    return { userId: actor.userId, role: "ADMIN", staffId: actor.staffId };
  }
  if (actor?.role === "STAFF" && actor.staffId) {
    const active = await prisma.staff.findFirst({
      where: { id: actor.staffId, isActive: true },
      select: { id: true },
    });
    if (active) return { userId: actor.userId, role: "STAFF", staffId: actor.staffId };
  }
  return null;
}

export async function requirePanelActor(): Promise<PanelActor> {
  const actor = await getPanelActor();
  if (!actor) redirect("/panel/giris");
  return actor;
}
