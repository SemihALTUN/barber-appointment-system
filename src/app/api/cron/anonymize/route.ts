// src/app/api/cron/anonymize/route.ts
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { runAnonymizationJob } from "@/server/cron/anonymize";

export const dynamic = "force-dynamic";

function isAuthorized(header: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export async function GET(request: Request) {
  if (!isAuthorized(request.headers.get("authorization"))) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const result = await runAnonymizationJob(90);
    return Response.json(result);
  } catch (err) {
    // İş transaction'ı geri alındığı için başarısızlık kaydı ayrıca yazılır
    console.error("[CRON_ANONYMIZE]", err);
    await prisma.anonymizationAuditLog
      .create({
        data: {
          recordsCount: 0,
          cleanedUsersCount: 0,
          status: "FAILED",
          errorMessage: err instanceof Error ? err.message.slice(0, 500) : "unknown",
        },
      })
      .catch(() => undefined);
    return Response.json({ error: "Anonimleştirme başarısız." }, { status: 500 });
  }
}
