// src/server/actions/create-appointment.ts
"use server";

import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CreateAppointmentSchema, type CreateAppointmentInput } from "@/server/schemas/appointment.schema";
import { DomainError, handleActionError, type ActionResult, type ErrorCode } from "@/lib/errors";
import { getIstanbulDateParts, isWithinShift, isWithinSameIstanbulDay } from "@/lib/timezone";
import { acquireSlotLock, releaseSlotLock } from "@/lib/redis-lock";
import { checkRateLimit, rateLimitedResult } from "@/lib/rate-limit";
import { generateSecureReferenceCode, generateSecureManageTokenPair } from "@/lib/crypto";
import { toAppointmentDTO, type CreatedAppointmentDTO } from "@/server/dto/appointment.dto";

const SLOT_LOCK_TTL_MS = 120_000;
const MAX_CODE_ATTEMPTS = 3;

function zodPathToErrorCode(path: ReadonlyArray<string | number>): ErrorCode {
  switch (path[0]) {
    case "startTime":
      return "INVALID_TIMEFRAME";
    case "serviceIds":
      return "INVALID_SERVICE";
    case "staffId":
      return "STAFF_NOT_ELIGIBLE";
    default:
      return "INVALID_INPUT";
  }
}

/** P2002 hedefi Prisma sürümüne göre alan dizisi ya da constraint adı (string) olabilir. */
function isUniqueViolationOn(err: unknown, fields: readonly string[]): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") return false;
  const target = (err.meta as { target?: unknown } | undefined)?.target;
  const text = Array.isArray(target) ? target.join(",") : String(target ?? "");
  return fields.some((f) => text.includes(f));
}

async function bookInTransaction(
  tx: Prisma.TransactionClient,
  input: CreateAppointmentInput
): Promise<CreatedAppointmentDTO> {
  // 1. Ortak personel satır kilidi — randevu, taşıma ve mola yazımlarını personel bazında serileştirir.
  await tx.$queryRaw`SELECT id FROM "Staff" WHERE id = ${input.staffId} FOR UPDATE`;

  // 2. Personel aktiflik ve yetkinlik doğrulaması
  const staff = await tx.staff.findFirst({
    where: { id: input.staffId, isActive: true },
    include: { services: true },
  });
  if (!staff) throw new DomainError("STAFF_NOT_ELIGIBLE", "Personel aktif değil.");

  const staffServiceIds = new Set(staff.services.map((s) => s.serviceId));
  if (!input.serviceIds.every((id) => staffServiceIds.has(id))) {
    throw new DomainError("STAFF_NOT_ELIGIBLE", "Personel seçilen hizmetlerin tümünü veremiyor.");
  }

  // 3. Hizmetler ve müşteri seçim sırası (orderIndex)
  const rawServices = await tx.service.findMany({
    where: { id: { in: input.serviceIds }, isActive: true },
  });
  if (rawServices.length !== input.serviceIds.length) {
    throw new DomainError("INVALID_SERVICE", "Seçilen hizmetlerden biri pasif veya geçersiz.");
  }

  const serviceMap = new Map(rawServices.map((s) => [s.id, s]));
  const orderedServices = input.serviceIds.map((id, orderIndex) => {
    const service = serviceMap.get(id);
    if (!service) throw new DomainError("INVALID_SERVICE", "Geçersiz hizmet seçimi.");
    return { service, orderIndex };
  });

  const totalDuration = orderedServices.reduce((sum, { service }) => sum + service.durationMinutes, 0);
  const totalPrice = orderedServices.reduce((sum, { service }) => sum.add(service.price), new Prisma.Decimal(0));
  const endTime = new Date(input.startTime.getTime() + totalDuration * 60_000);

  // 4. Gece yarısı ve vardiya kontrolü
  if (!isWithinSameIstanbulDay(input.startTime, endTime)) {
    throw new DomainError("INVALID_TIMEFRAME", "Randevu gece yarısını aşamaz.");
  }
  const { dayOfWeek } = getIstanbulDateParts(input.startTime);
  const shifts = await tx.workingShift.findMany({ where: { staffId: input.staffId, dayOfWeek } });
  if (!shifts.some((shift) => isWithinShift(input.startTime, endTime, shift))) {
    throw new DomainError("INVALID_TIMEFRAME", "Randevu personelin mesai saatleri dışındadır.");
  }

  // 5. Çakışma kontrolleri (kilit altında; READ COMMITTED → güncel commit'leri görür)
  const overlapAppt = await tx.appointment.findFirst({
    where: {
      staffId: input.staffId,
      status: "CONFIRMED",
      AND: [{ startTime: { lt: endTime } }, { endTime: { gt: input.startTime } }],
    },
    select: { id: true },
  });
  if (overlapAppt) throw new DomainError("SLOT_UNAVAILABLE", "Bu saat aralığı az önce rezerve edildi.");

  const overlapBlock = await tx.timeBlock.findFirst({
    where: {
      staffId: input.staffId,
      AND: [{ startTime: { lt: endTime } }, { endTime: { gt: input.startTime } }],
    },
    select: { id: true },
  });
  if (overlapBlock) throw new DomainError("SLOT_UNAVAILABLE", "Berber bu saat aralığında müsait değil.");

  // 6. Kriptografik kodlar ve snapshot kaydı (GiST kısıtı son savunma hattıdır)
  const referenceCode = generateSecureReferenceCode();
  const { rawToken, tokenHash } = generateSecureManageTokenPair();

  const created = await tx.appointment.create({
    data: {
      referenceCode,
      manageTokenHash: tokenHash,
      staffId: input.staffId,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      startTime: input.startTime,
      endTime,
      totalDurationMinutes: totalDuration,
      totalPrice,
      notes: input.notes ?? null,
      status: "CONFIRMED",
      items: {
        create: orderedServices.map(({ service, orderIndex }) => ({
          serviceId: service.id,
          orderIndex,
          serviceName: service.name,
          durationMinutes: service.durationMinutes,
          unitPrice: service.price,
        })),
      },
    },
    include: { items: true },
  });

  return { ...toAppointmentDTO(created), rawManageToken: rawToken };
}

export async function createAppointment(rawInput: unknown): Promise<ActionResult<CreatedAppointmentDTO>> {
  // 1. Zod doğrulaması (ms duyarlı 15 dk ızgara + asgari ileri zaman)
  const parsed = CreateAppointmentSchema.safeParse(rawInput);
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

  // 2. IP başına rate limit
  const limit = await checkRateLimit("booking");
  if (!limit.ok) return rateLimitedResult(limit.retryAfterSec);

  // 3. Katman 1 — Redis slot mutex'i (120 sn TTL)
  const lockKey = `lock:slot:${input.staffId}:${input.startTime.toISOString()}`;
  const lockToken = randomUUID();
  const lock = await acquireSlotLock(lockKey, lockToken, SLOT_LOCK_TTL_MS);
  if (!lock.acquired) {
    return {
      success: false,
      error: {
        code: "SLOT_UNAVAILABLE",
        message: "Seçilen saat şu anda başka bir müşteri tarafından işleniyor. Lütfen tekrar deneyin.",
      },
    };
  }

  try {
    // 4. Yalnızca referenceCode/manageTokenHash P2002 çakışmasında yeniden dene
    for (let attempt = 1; ; attempt++) {
      try {
        const data = await prisma.$transaction((tx) => bookInTransaction(tx, input));
        return { success: true, data };
      } catch (err) {
        if (attempt < MAX_CODE_ATTEMPTS && isUniqueViolationOn(err, ["referenceCode", "manageTokenHash"])) {
          continue;
        }
        throw err;
      }
    }
  } catch (err) {
    return handleActionError(err);
  } finally {
    await releaseSlotLock(lockKey, lockToken);
  }
}
