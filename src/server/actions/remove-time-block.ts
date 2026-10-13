// src/server/actions/remove-time-block.ts
"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { DomainError, handleActionError, type ActionResult } from "@/lib/errors";
import { getSessionActor } from "@/server/auth/session-actor";

const Schema = z.object({ timeBlockId: z.string().cuid() });

export async function removeTimeBlock(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = Schema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: { code: "INVALID_INPUT", message: "Geçersiz istek." } };
  }
  const { timeBlockId } = parsed.data;

  try {
    const actor = await getSessionActor();
    if (!actor) throw new DomainError("UNAUTHORIZED", "Bu işlem için oturum açmalısınız.");

    const block = await prisma.timeBlock.findUnique({ where: { id: timeBlockId }, select: { staffId: true } });
    if (!block) throw new DomainError("NOT_FOUND", "Mola kaydı bulunamadı.");

    const isAdmin = actor.role === "ADMIN";
    const isOwnerStaff = actor.role === "STAFF" && actor.staffId === block.staffId;
    if (!isAdmin && !isOwnerStaff) {
      throw new DomainError("FORBIDDEN", "Bu personelin takvimini düzenleme yetkiniz yok.");
    }

    // Silme yalnızca zaman açar; çakışma riski yok → Staff kilidi gerekmez.
    const result = await prisma.timeBlock.deleteMany({ where: { id: timeBlockId, staffId: block.staffId } });
    if (result.count === 0) throw new DomainError("NOT_FOUND", "Mola kaydı zaten silinmiş.");

    return { success: true, data: { id: timeBlockId } };
  } catch (err) {
    return handleActionError(err);
  }
}
