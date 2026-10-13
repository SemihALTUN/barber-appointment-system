// src/app/panel/(protected)/page.tsx
import { notFound } from "next/navigation";
import { DayNavigator } from "@/components/panel/day-navigator";
import { Timeline } from "@/components/panel/timeline";
import { istanbulDateKey, isValidDateKey } from "@/lib/date-keys";
import { requirePanelActor } from "@/server/auth/panel-actor";
import { getPanelStaffOptions, getStaffDaySchedule } from "@/server/queries/panel-schedule";
import type { PanelStaffOption } from "@/types/panel";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ tarih?: string; personel?: string }>;
}

export default async function PanelPage({ searchParams }: PageProps) {
  const actor = await requirePanelActor(); // Layout'a ek olarak: sayfa kendi başına da korumalı
  const sp = await searchParams;
  const todayKey = istanbulDateKey();
  const dateKey = sp.tarih && isValidDateKey(sp.tarih) ? sp.tarih : todayKey;

  let staffOptions: PanelStaffOption[] = [];
  let staffId: string | null;

  if (actor.role === "ADMIN") {
    staffOptions = await getPanelStaffOptions();
    staffId =
      staffOptions.find((s) => s.id === sp.personel)?.id ??
      staffOptions.find((s) => s.id === actor.staffId)?.id ??
      staffOptions[0]?.id ??
      null;
  } else {
    staffId = actor.staffId; // STAFF yalnızca kendi takvimini görür; ?personel yok sayılır
  }

  if (!staffId) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 text-center text-muted-foreground">
        Henüz aktif personel bulunmuyor. <code>npm run db:seed:demo</code> ile örnek veri ekleyebilirsiniz.
      </main>
    );
  }

  const schedule = await getStaffDaySchedule(staffId, dateKey);
  if (!schedule) notFound();

  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 pt-4 pb-28">
      <DayNavigator dateKey={dateKey} todayKey={todayKey} staffId={staffId} staffOptions={staffOptions} />
      <Timeline schedule={schedule} serverNow={Date.now()} />
    </main>
  );
}
