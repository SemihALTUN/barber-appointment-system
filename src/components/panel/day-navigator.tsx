// src/components/panel/day-navigator.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { addDaysToKey, formatDateKey } from "@/lib/date-keys";
import type { PanelStaffOption } from "@/types/panel";

interface DayNavigatorProps {
  dateKey: string;
  todayKey: string;
  staffId: string;
  staffOptions: PanelStaffOption[]; // Yalnızca ADMIN için dolu
}

export function DayNavigator({ dateKey, todayKey, staffId, staffOptions }: DayNavigatorProps) {
  const router = useRouter();
  const isAdminView = staffOptions.length > 0;
  const href = (key: string, staff: string = staffId) => `/panel?tarih=${key}${isAdminView ? `&personel=${staff}` : ""}`;

  return (
    <div className="space-y-3">
      {staffOptions.length > 1 && (
        <NativeSelect aria-label="Personel seçin" value={staffId} onChange={(e) => router.push(href(dateKey, e.target.value))}>
          {staffOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </NativeSelect>
      )}
      <div className="flex items-center gap-2">
        <Button asChild variant="outline" size="icon">
          <Link href={href(addDaysToKey(dateKey, -1))} aria-label="Önceki gün">
            <ChevronLeft />
          </Link>
        </Button>
        <div className="flex-1 text-center">
          <p className="font-semibold">{formatDateKey(dateKey, { weekday: "long", day: "numeric", month: "long" })}</p>
          {dateKey === todayKey ? (
            <p className="text-xs text-muted-foreground">Bugün</p>
          ) : (
            <Link href={href(todayKey)} className="text-xs text-primary underline-offset-2 hover:underline">
              Bugüne dön
            </Link>
          )}
        </div>
        <Button asChild variant="outline" size="icon">
          <Link href={href(addDaysToKey(dateKey, 1))} aria-label="Sonraki gün">
            <ChevronRight />
          </Link>
        </Button>
      </div>
    </div>
  );
}
