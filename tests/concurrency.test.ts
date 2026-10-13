// tests/concurrency.test.ts — V1.2 (düzeltilmiş)
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { createHash, randomBytes, randomInt } from "crypto";

// next-auth'u test ortamında hiç yüklememek ve oturumu deterministik kılmak için auth() mock'lanır.
const { mockAuth } = vi.hoisted(() => ({ mockAuth: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));

import type { AppointmentStatus } from "@prisma/client";
import { createAppointment } from "@/server/actions/create-appointment";
import { addTimeBlock } from "@/server/actions/add-time-block";
import { rescheduleAppointment } from "@/server/actions/reschedule-appointment";
import { cancelAppointmentByToken } from "@/server/actions/cancel-appointment";
import { runAnonymizationJob } from "@/server/cron/anonymize";
import { isExclusionViolation, type ActionResult, type ErrorCode } from "@/lib/errors";
import { getIstanbulDateParts } from "@/lib/timezone";
import { prisma } from "@/lib/prisma";

// =========================================================================
// IPv6 destekli katı beyaz liste test DB kalkanı
// =========================================================================
function assertTestDatabaseSafety(customDbUrl?: string, customNodeEnv?: string): void {
  const dbUrl = customDbUrl ?? process.env.DATABASE_URL;
  const nodeEnv = customNodeEnv ?? process.env.NODE_ENV;

  if (!dbUrl) throw new Error("SECURITY_ABORT: DATABASE_URL tanımlı değil (.env.test dosyasını kontrol edin).");
  if (nodeEnv !== "test") {
    throw new Error(`SECURITY_ABORT: NODE_ENV kesinlikle 'test' olmalıdır. Alınan: '${nodeEnv}'`);
  }

  let parsed: URL;
  try {
    parsed = new URL(dbUrl);
  } catch {
    throw new Error("SECURITY_ABORT: DATABASE_URL geçerli bir URL formatında değil.");
  }

  const rawHostname = parsed.hostname.toLowerCase();
  const hostname = rawHostname.replace(/^\[|\]$/g, ""); // "[::1]" -> "::1"
  const dbName = parsed.pathname.replace(/^\//, "").toLowerCase();

  const ALLOWED_TEST_HOSTS = ["localhost", "127.0.0.1", "::1", "postgres", "db.test.local"];
  if (!ALLOWED_TEST_HOSTS.includes(hostname)) {
    throw new Error(`SECURITY_ABORT: '${rawHostname}' onaylı bir test sunucusu değildir.`);
  }

  const ALLOWED_TEST_DBS = ["barber_test_db", "test_db"];
  if (!ALLOWED_TEST_DBS.includes(dbName)) {
    throw new Error(`SECURITY_ABORT: '${dbName}' onaylı bir test veritabanı adı değildir.`);
  }

  if (/prod|production|live|real/i.test(dbUrl)) {
    throw new Error("SECURITY_ABORT: DATABASE_URL üretim anahtar sözcüğü içermektedir.");
  }
}

assertTestDatabaseSafety();
process.env.DISABLE_REDIS = "true";

// =========================================================================
// Yardımcılar
// =========================================================================
const TUESDAY = 2;
const THURSDAY = 4;
const DAY_MS = 86_400_000;

function createDeferred() {
  let resolve!: () => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const shortId = (): string => randomBytes(4).toString("hex").toUpperCase();
const testPhone = (): string => `+905${String(randomInt(0, 1_000_000_000)).padStart(9, "0")}`;
const addMinutes = (d: Date, minutes: number): Date => new Date(d.getTime() + minutes * 60_000);

/**
 * Sabit tarihler birkaç gün sonra geçmişte kalır ve "en az 15 dk ileri" kuralına takılır.
 * En az `minDaysAhead` gün sonraki ilk hedef hafta gününün İstanbul saatini üretir (Türkiye sabit UTC+3).
 */
function futureIstanbulSlot(dayOfWeek: number, hhmm: string, minDaysAhead = 7): Date {
  let probe = new Date(Date.now() + minDaysAhead * DAY_MS);
  for (let i = 0; i < 7; i++) {
    const p = getIstanbulDateParts(probe);
    if (p.dayOfWeek === dayOfWeek) {
      const mm = String(p.month).padStart(2, "0");
      const dd = String(p.day).padStart(2, "0");
      return new Date(`${p.year}-${mm}-${dd}T${hhmm}:00.000+03:00`);
    }
    probe = new Date(probe.getTime() + DAY_MS);
  }
  throw new Error("Hedef hafta günü bulunamadı.");
}

function expectSuccess<T>(res: ActionResult<T>): T {
  if (!res.success) {
    throw new Error(`Başarı bekleniyordu, alınan: ${res.error.code} — ${res.error.message}`);
  }
  return res.data;
}

function expectFailure(res: ActionResult<unknown>, code: ErrorCode): void {
  expect(res.success).toBe(false);
  if (res.success) return;
  expect(res.error.code).toBe(code);
}

function splitResults(results: ActionResult<unknown>[]) {
  return {
    successes: results.filter((r) => r.success),
    failureCodes: results.flatMap((r) => (r.success ? [] : [r.error.code])),
  };
}

// =========================================================================
// Test paketi
// =========================================================================
describe("PostgreSQL 16 Eşzamanlılık, GiST ve Güvenlik Test Paketi (V1.2)", () => {
  const createdStaffIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdServiceIds: string[] = [];
  const createdAppointmentIds: string[] = [];

  let staffId: string;
  let serviceId: string;

  async function insertAppointment(opts: {
    startTime: Date;
    durationMinutes?: number;
    status?: AppointmentStatus;
    manageTokenHash?: string;
    customerId?: string;
  }) {
    const duration = opts.durationMinutes ?? 30;
    const appt = await prisma.appointment.create({
      data: {
        referenceCode: `BRB-T-${shortId()}`,
        manageTokenHash: opts.manageTokenHash ?? `test-hash-${shortId()}${shortId()}`,
        staffId,
        customerId: opts.customerId,
        customerName: "Test Müşteri",
        customerPhone: testPhone(),
        startTime: opts.startTime,
        endTime: addMinutes(opts.startTime, duration),
        totalDurationMinutes: duration,
        totalPrice: 400,
        status: opts.status ?? "CONFIRMED",
      },
    });
    createdAppointmentIds.push(appt.id);
    return appt;
  }

  beforeEach(async () => {
    mockAuth.mockReset();
    mockAuth.mockResolvedValue(null); // Varsayılan: oturum yok

    const user = await prisma.user.create({ data: { name: "Usta", phone: testPhone(), role: "STAFF" } });
    const staff = await prisma.staff.create({ data: { userId: user.id, title: "Usta Berber" } });
    const service = await prisma.service.create({ data: { name: "Saç Kesimi", durationMinutes: 30, price: 400 } });
    await prisma.staffService.create({ data: { staffId: staff.id, serviceId: service.id } });
    await prisma.workingShift.createMany({
      data: [
        { staffId: staff.id, dayOfWeek: TUESDAY, startTime: "09:00", endTime: "19:00" },
        { staffId: staff.id, dayOfWeek: THURSDAY, startTime: "09:00", endTime: "19:00" },
      ],
    });

    createdUserIds.push(user.id);
    createdStaffIds.push(staff.id);
    createdServiceIds.push(service.id);
    staffId = staff.id;
    serviceId = service.id;
  });

  afterAll(async () => {
    try {
      if (createdAppointmentIds.length > 0 || createdStaffIds.length > 0) {
        await prisma.appointmentItem.deleteMany({
          where: {
            OR: [
              { appointmentId: { in: createdAppointmentIds } },
              { appointment: { staffId: { in: createdStaffIds } } },
            ],
          },
        });
        await prisma.appointment.deleteMany({
          where: { OR: [{ id: { in: createdAppointmentIds } }, { staffId: { in: createdStaffIds } }] },
        });
      }
      if (createdStaffIds.length > 0) {
        await prisma.timeBlock.deleteMany({ where: { staffId: { in: createdStaffIds } } });
        await prisma.workingShift.deleteMany({ where: { staffId: { in: createdStaffIds } } });
        await prisma.staffService.deleteMany({ where: { staffId: { in: createdStaffIds } } });
        await prisma.staff.deleteMany({ where: { id: { in: createdStaffIds } } });
      }
      if (createdServiceIds.length > 0) {
        await prisma.service.deleteMany({ where: { id: { in: createdServiceIds } } });
      }
      if (createdUserIds.length > 0) {
        await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      }
    } finally {
      await prisma.$disconnect();
    }
  });

  it("Test 1: Aynı başlangıç saati yarışında tam 1 başarılı, 1 SLOT_UNAVAILABLE olmalıdır", async () => {
    const slot = futureIstanbulSlot(TUESDAY, "10:00");
    const results = await Promise.all([
      createAppointment({ staffId, serviceIds: [serviceId], startTime: slot, customerName: "Ali", customerPhone: testPhone() }),
      createAppointment({ staffId, serviceIds: [serviceId], startTime: slot, customerName: "Veli", customerPhone: testPhone() }),
    ]);

    const { successes, failureCodes } = splitResults(results);
    expect(successes).toHaveLength(1);
    expect(failureCodes).toEqual(["SLOT_UNAVAILABLE"]);
  });

  it("Test 2: Farklı başlangıçlı fakat örtüşen aralıklarda tam 1 başarılı, 1 SLOT_UNAVAILABLE olmalıdır", async () => {
    const slot1 = futureIstanbulSlot(TUESDAY, "10:00"); // 10:00–10:30
    const slot2 = futureIstanbulSlot(TUESDAY, "10:15"); // 10:15–10:45 (örtüşür)
    const results = await Promise.all([
      createAppointment({ staffId, serviceIds: [serviceId], startTime: slot1, customerName: "Can", customerPhone: testPhone() }),
      createAppointment({ staffId, serviceIds: [serviceId], startTime: slot2, customerName: "Cem", customerPhone: testPhone() }),
    ]);

    const { successes, failureCodes } = splitResults(results);
    expect(successes).toHaveLength(1);
    expect(failureCodes).toEqual(["SLOT_UNAVAILABLE"]);
  });

  it("Test 3: Eşzamanlı randevu ve mola yarışında tam 1 tanesi kazanmalı, diğeri SLOT_UNAVAILABLE almalıdır", async () => {
    mockAuth.mockResolvedValue({ user: { id: "admin-test", role: "ADMIN", staffId: null } });

    const slot = futureIstanbulSlot(TUESDAY, "14:00");
    const results = await Promise.all([
      createAppointment({ staffId, serviceIds: [serviceId], startTime: slot, customerName: "Ece", customerPhone: testPhone() }),
      addTimeBlock({ staffId, startTime: slot, endTime: addMinutes(slot, 30), reason: "Öğle arası" }),
    ]);

    const { successes, failureCodes } = splitResults(results);
    expect(successes).toHaveLength(1);
    expect(failureCodes).toEqual(["SLOT_UNAVAILABLE"]);
  });

  it("Test 4: 15 dakikalık ızgarada milisaniyeli (10:00:00.500) ve geçersiz (10:07) zamanlar reddedilmelidir", async () => {
    const base = futureIstanbulSlot(TUESDAY, "10:00");
    const msSlot = new Date(base.getTime() + 500);
    const offGridSlot = addMinutes(base, 7);

    const resMs = await createAppointment({ staffId, serviceIds: [serviceId], startTime: msSlot, customerName: "Mili", customerPhone: testPhone() });
    const resGrid = await createAppointment({ staffId, serviceIds: [serviceId], startTime: offGridSlot, customerName: "Izgara", customerPhone: testPhone() });

    expectFailure(resMs, "INVALID_TIMEFRAME");
    expectFailure(resGrid, "INVALID_TIMEFRAME");
  });

  it("Test 5: Bağımsız PostgreSQL GiST Exclusion Kısıtı Testi (uygulama kontrolü baypas)", async () => {
    const start = futureIstanbulSlot(TUESDAY, "11:00");
    await insertAppointment({ startTime: start });

    let caughtError: unknown = null;
    try {
      await insertAppointment({ startTime: addMinutes(start, 15) });
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).not.toBeNull();
    expect(isExclusionViolation(caughtError)).toBe(true);
  });

  it("Test 6: Birden fazla misafir kullanıcının phone=null ile anonimleştirilmesi @unique hatası vermemelidir", async () => {
    const u1 = await prisma.user.create({ data: { name: "M1", phone: testPhone(), role: "CUSTOMER" } });
    const u2 = await prisma.user.create({ data: { name: "M2", phone: testPhone(), role: "CUSTOMER" } });
    createdUserIds.push(u1.id, u2.id);

    const past = new Date(Date.now() - 100 * DAY_MS);
    const a1 = await insertAppointment({ startTime: past, status: "COMPLETED", customerId: u1.id });
    const a2 = await insertAppointment({ startTime: addMinutes(past, 60), status: "COMPLETED", customerId: u2.id });

    const res = await runAnonymizationJob(90);
    // İş global çalışır; DB'de başka eski kayıt olabileceği için alt sınır + hedef satır doğrulaması
    expect(res.anonymizedAppointments).toBeGreaterThanOrEqual(2);
    expect(res.cleanedUsers).toBeGreaterThanOrEqual(2);

    const users = await prisma.user.findMany({ where: { id: { in: [u1.id, u2.id] } } });
    expect(users.map((u) => u.phone)).toEqual([null, null]);

    const appts = await prisma.appointment.findMany({ where: { id: { in: [a1.id, a2.id] } } });
    expect(appts.every((a) => a.customerName === "Anonim Müşteri" && a.customerPhone === "+900000000000")).toBe(true);
  });

  it("Test 7: Yetkisiz randevu taşıma isteği FORBIDDEN hatası almalıdır", async () => {
    const start = futureIstanbulSlot(TUESDAY, "11:00");
    const appt = await insertAppointment({ startTime: start, manageTokenHash: `valid-hash-${shortId()}` });

    const res = await rescheduleAppointment({
      appointmentId: appt.id,
      newStartTime: futureIstanbulSlot(TUESDAY, "12:00"),
      rawManageToken: "invalid-token",
    });

    expectFailure(res, "FORBIDDEN");
  });

  it("Test 8: Eşzamanlı iki iptal çağrısından ilki başarıyla iptal etmeli, ikincisi ALREADY_CANCELLED almalıdır", async () => {
    const rawToken = "super-secret-cancel-token-123456789";
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    expect(tokenHash).toBe("942d031f37f6b14535fa9740ae6ef5bc4e6d14c71b74718265c9562fed7116d5");

    // Sabit hash benzersiz olduğundan önceki yarım kalmış koşumdan artık kayıt varsa temizle
    await prisma.appointment.deleteMany({ where: { manageTokenHash: tokenHash } });
    await insertAppointment({ startTime: new Date(Date.now() + 2 * DAY_MS), manageTokenHash: tokenHash });

    const results = await Promise.all([cancelAppointmentByToken(rawToken), cancelAppointmentByToken(rawToken)]);

    const { successes, failureCodes } = splitResults(results);
    expect(successes).toHaveLength(1);
    expect(failureCodes).toEqual(["ALREADY_CANCELLED"]);
  });

  it("Test 9A: İptal kilidi tutarken gelen taşıma bloklanmalı, kilit açılınca INVALID_TIMEFRAME ile reddedilmelidir", async () => {
    const rawToken = `barrier-cancel-first-${shortId()}`;
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const initialSlot = futureIstanbulSlot(THURSDAY, "10:00");
    const initialEndSlot = addMinutes(initialSlot, 30);
    const targetNewSlot = futureIstanbulSlot(THURSDAY, "11:00");

    const appt = await insertAppointment({ startTime: initialSlot, manageTokenHash: tokenHash });

    const cancelLocked = createDeferred();
    const releaseCancelLock = createDeferred();
    let rescheduleStarted = false;
    let rescheduleResolved = false;

    // 1. Gerçek iptal fonksiyonu kilidi alır ve kanca içinde tutar
    const cancelPromise = cancelAppointmentByToken(rawToken, {
      onLocked: async () => {
        cancelLocked.resolve();
        await releaseCancelLock.promise;
      },
    });
    await cancelLocked.promise;

    // 2. Gerçek taşıma fonksiyonu başlatılır → aynı satırın FOR UPDATE kilidinde bekler
    rescheduleStarted = true;
    const reschedulePromise = rescheduleAppointment({
      appointmentId: appt.id,
      newStartTime: targetNewSlot,
      rawManageToken: rawToken,
    }).then((res) => {
      rescheduleResolved = true;
      return res;
    });

    try {
      await new Promise((r) => setTimeout(r, 60));
      expect(rescheduleStarted).toBe(true);
      expect(rescheduleResolved).toBe(false); // Taşıma satır kilidini bekliyor
    } finally {
      releaseCancelLock.resolve(); // Assertion düşse bile transaction asılı kalmasın
    }

    const [cancelRes, rescheduleRes] = await Promise.all([cancelPromise, reschedulePromise]);
    expect(expectSuccess(cancelRes).status).toBe("CANCELLED");
    expectFailure(rescheduleRes, "INVALID_TIMEFRAME");

    const finalAppt = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } });
    expect(finalAppt.status).toBe("CANCELLED");
    expect(finalAppt.startTime.toISOString()).toBe(initialSlot.toISOString());
    expect(finalAppt.endTime.toISOString()).toBe(initialEndSlot.toISOString());
  });

  it("Test 9B: Taşıma kilidi tutarken gelen iptal bloklanmalı, kilit açılınca randevuyu yeni saatinde iptal etmelidir", async () => {
    const rawToken = `barrier-reschedule-first-${shortId()}`;
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const initialSlot = futureIstanbulSlot(THURSDAY, "10:00");
    const targetNewSlot = futureIstanbulSlot(THURSDAY, "11:00");
    const targetNewEndSlot = addMinutes(targetNewSlot, 30);

    const appt = await insertAppointment({ startTime: initialSlot, manageTokenHash: tokenHash });

    const rescheduleLocked = createDeferred();
    const releaseRescheduleLock = createDeferred();
    let rescheduleResolved = false; // DÜZELTME: V1.2'de tanımsızdı → strict modda ReferenceError
    let cancelStarted = false;
    let cancelResolved = false;

    // 1. Gerçek taşıma fonksiyonu kilidi alır ve kanca içinde tutar
    const reschedulePromise = rescheduleAppointment({
      appointmentId: appt.id,
      newStartTime: targetNewSlot,
      rawManageToken: rawToken,
      __testHooks: {
        onLocked: async () => {
          rescheduleLocked.resolve();
          await releaseRescheduleLock.promise;
        },
      },
    }).then((res) => {
      rescheduleResolved = true;
      return res;
    });
    await rescheduleLocked.promise;

    // 2. Gerçek iptal fonksiyonu başlatılır → aynı satırın FOR UPDATE kilidinde bekler
    cancelStarted = true;
    const cancelPromise = cancelAppointmentByToken(rawToken).then((res) => {
      cancelResolved = true;
      return res;
    });

    try {
      await new Promise((r) => setTimeout(r, 60));
      expect(cancelStarted).toBe(true);
      expect(cancelResolved).toBe(false); // İptal satır kilidini bekliyor
      expect(rescheduleResolved).toBe(false); // Taşıma hâlâ kancada
    } finally {
      releaseRescheduleLock.resolve();
    }

    const [rescheduleRes, cancelRes] = await Promise.all([reschedulePromise, cancelPromise]);
    expect(expectSuccess(rescheduleRes).startTime.toISOString()).toBe(targetNewSlot.toISOString());
    expect(expectSuccess(cancelRes).status).toBe("CANCELLED");

    const finalAppt = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } });
    expect(finalAppt.status).toBe("CANCELLED");
    expect(finalAppt.startTime.toISOString()).toBe(targetNewSlot.toISOString());
    expect(finalAppt.endTime.toISOString()).toBe(targetNewEndSlot.toISOString());
  });

  it("Test 10: Gece yarısını aşan ve vardiya bitişini taşan randevular INVALID_TIMEFRAME ile reddedilmelidir", async () => {
    const resMidnight = await createAppointment({
      staffId,
      serviceIds: [serviceId],
      startTime: futureIstanbulSlot(TUESDAY, "23:45"),
      customerName: "Gece",
      customerPhone: testPhone(),
    });
    expectFailure(resMidnight, "INVALID_TIMEFRAME");

    const resOverrun = await createAppointment({
      staffId,
      serviceIds: [serviceId],
      startTime: futureIstanbulSlot(TUESDAY, "18:45"), // 19:15'e taşar
      customerName: "Vardiya Aşımı",
      customerPhone: testPhone(),
    });
    expectFailure(resOverrun, "INVALID_TIMEFRAME");
  });

  it("Test 11: Güvenlik kalkanı IPv4/IPv6 test bağlantılarını onaylamalı, yetkisiz host/DB/ortamı reddetmelidir", () => {
    expect(() => assertTestDatabaseSafety("postgresql://test_user:pass@localhost:5432/barber_test_db", "test")).not.toThrow();
    expect(() => assertTestDatabaseSafety("postgresql://test_user:pass@[::1]:5432/barber_test_db", "test")).not.toThrow();
    expect(() =>
      assertTestDatabaseSafety("postgresql://test_user:pass@prod-db.supabase.co:5432/barber_test_db", "test")
    ).toThrow(/SECURITY_ABORT/);
    expect(() =>
      assertTestDatabaseSafety("postgresql://test_user:pass@localhost:5432/customer_production_test", "test")
    ).toThrow(/SECURITY_ABORT/);
    expect(() => assertTestDatabaseSafety("postgresql://test_user:pass@localhost:5432/barber_test_db", "production")).toThrow(
      /SECURITY_ABORT/
    );
  });

  it("Test 12: Oturumsuz mola ekleme UNAUTHORIZED, başka personelin takvimine ekleme FORBIDDEN almalıdır", async () => {
    const slot = futureIstanbulSlot(TUESDAY, "15:00");
    const input = { staffId, startTime: slot, endTime: addMinutes(slot, 30) };

    expectFailure(await addTimeBlock(input), "UNAUTHORIZED");

    mockAuth.mockResolvedValue({ user: { id: "other-staff-user", role: "STAFF", staffId: "another-staff-id" } });
    expectFailure(await addTimeBlock(input), "FORBIDDEN");

    mockAuth.mockResolvedValue({ user: { id: "owner-user", role: "STAFF", staffId } });
    expectSuccess(await addTimeBlock(input));
  });
});
