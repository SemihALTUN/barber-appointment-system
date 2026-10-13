// src/components/booking/slot-step.tsx
"use client";

import { BOOKING_HORIZON_DAYS, dayOfWeekFromKey } from "@/lib/date-keys";
import type { SlotOption } from "@/types/booking";
import { DateStrip } from "./date-strip";
import { SlotGrid } from "./slot-grid";
import { StepHeading } from "./step-heading";
import type { SlotsState } from "./use-slots";

interface SlotStepProps {
  todayKey: string;
  staffName: string;
  workingDays: number[];
  dateKey: string | null;
  onDateChange: (key: string) => void;
  slotsState: SlotsState;
  selectedSlot: SlotOption | null;
  onSelectSlot: (slot: SlotOption) => void;
  onRetry: () => void;
}

export function SlotStep(props: SlotStepProps) {
  const { todayKey, staffName, workingDays, dateKey, onDateChange, slotsState, selectedSlot, onSelectSlot, onRetry } =
    props;

  return (
    <section className="space-y-4">
      <StepHeading title="Tarih ve saat seçin" description={`${staffName} için uygun saatler`} />
      <DateStrip
        startKey={todayKey}
        days={BOOKING_HORIZON_DAYS}
        selectedKey={dateKey}
        onSelect={onDateChange}
        isDisabled={(key) => !workingDays.includes(dayOfWeekFromKey(key))}
      />
      {dateKey ? (
        <SlotGrid state={slotsState} selected={selectedSlot?.startTime ?? null} onSelect={onSelectSlot} onRetry={onRetry} />
      ) : (
        <p className="text-sm text-muted-foreground">Önümüzdeki {BOOKING_HORIZON_DAYS} günde çalışma günü bulunamadı.</p>
      )}
    </section>
  );
}
