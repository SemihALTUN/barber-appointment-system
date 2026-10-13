// src/server/actions/add-time-block.ts
"use server";

import { z } from "zod";
import { BlockType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isOnSlotGrid } from "@/lib/timezone";
import { DomainError, handleActionError, type ActionResult, type ErrorCode } from "@/lib/errors";
import { getSessionActor } from "@/server/auth/session-actor";

const MAX_BLOCK_DURATION_MS = 31 * 24 * 60 * 60 * 1000; // Çok günlük izinler için üst sınır

const GridDate = z
  .union([z.date(), z.string().datetime({ offset: true })])
  .transform((v) => (v instanceof Date ? v : new Date(v)))
  .refine((d) => !Number.isNaN(d.getTime()), "Geçersiz tarih.")
  .refine(isOnSlotGrid, "Mola saatleri yarım saat aralıklarla seçilir (örneğin 12:00 veya 12:30).");

const AddTimeBlockSchema = z
  .object({
    staffId: z.string().cuid("Geçersiz personel kimliği."),
    startTime: GridDate,
    endTime: GridDate,
    type: z.nativeEnum(BlockType).default(BlockType.BREAK),
    reason: z
      .string()
      .trim()
      .max(200, "Açıklama en fazla 200 karakter olabilir.")
      .optional()
      .transform((v) => (v ? v : undefined)),
  })
  .superRefine((v, ctx) => {
    const duration = v.endTime.getTime() - v.startTime.getTime();
    if (duration <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endTime"], message: "Bitiş başlangıçtan sonra olmalıdır." });
    } else if (duration > MAX_BLOCK_DURATION_MS) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endTime"], message: "Tek blok en fazla 31 gün olabilir." });
    }
    if (v.endTime.getTime() <= Date.now()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endTime"], message: "Geçmiş bir aralığa blok eklenemez." });
    }
  });

type TimeBlockResult = {
  id: string;
  staffId: string;
  startTime: Date;
  endTime: Date;
  type: BlockType;
  reason: string | null;
};

function zodPathToErrorCode(path: ReadonlyArray<string | number>): ErrorCode {
  switch (path[0]) {
    case "startTime":
    case "endTime":
      return "INVALID_TIMEFRAME";
    case "staffId":
      return "NOT_FOUND";
    default:
      return "INVALID_INPUT";
  }
}

export async function addTimeBlock(rawInput: unknown): Promise<ActionResult<TimeBlockResult>> {
  const parsed = AddTimeBlockSchema.safeParse(rawInput);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      success: false,
      error: {
        code: issue ? zodPathToErrorCode(issue.path) : "INVALID_INPUT",
        message: issue?.message ?? "Geçersiz istek.",
      },
    };
  }
  const input = parsed.data;

  try {
    // Yetki: ADMIN her personel için, STAFF yalnızca kendi takvimi için blok ekleyebilir.
    const actor = await getSessionActor();
    if (!actor) throw new DomainError("UNAUTHORIZED", "Bu işlem için oturum açmalısınız.");
    const isAdmin = actor.role === "ADMIN";
    const isOwnerStaff = actor.role === "STAFF" && actor.staffId === input.staffId;
    if (!isAdmin && !isOwnerStaff) {
      throw new DomainError("FORBIDDEN", "Bu personelin takvimini düzenleme yetkiniz yok.");
    }

    const block = await prisma.$transaction(async (tx) => {
      // Ortak personel satır kilidi — createAppointment/rescheduleAppointment ile aynı serileştirme noktası
      const [staff] = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "Staff" WHERE id = ${input.staffId} FOR UPDATE
      `;
      if (!staff) throw new DomainError("NOT_FOUND", "Personel bulunamadı.");

      const overlapAppt = await tx.appointment.findFirst({
        where: {
          staffId: input.staffId,
          status: "CONFIRMED",
          AND: [{ startTime: { lt: input.endTime } }, { endTime: { gt: input.startTime } }],
        },
        select: { id: true },
      });
      if (overlapAppt) {
        throw new DomainError(
          "SLOT_UNAVAILABLE",
          "Bu aralıkta onaylı bir randevu var. Önce randevuyu taşıyın veya iptal edin."
        );
      }

      const overlapBlock = await tx.timeBlock.findFirst({
        where: {
          staffId: input.staffId,
          AND: [{ startTime: { lt: input.endTime } }, { endTime: { gt: input.startTime } }],
        },
        select: { id: true },
      });
      if (overlapBlock) {
        throw new DomainError("SLOT_UNAVAILABLE", "Bu aralıkta zaten bir mola/izin bloğu var.");
      }

      return tx.timeBlock.create({
        data: {
          staffId: input.staffId,
          startTime: input.startTime,
          endTime: input.endTime,
          type: input.type,
          reason: input.reason ?? null,
        },
      });
    });

    return {
      success: true,
      data: {
        id: block.id,
        staffId: block.staffId,
        startTime: block.startTime,
        endTime: block.endTime,
        type: block.type,
        reason: block.reason,
      },
    };
  } catch (err) {
    return handleActionError(err);
  }
}
