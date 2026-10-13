// src/components/booking/slot-grid.tsx
"use client";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { SlotOption } from "@/types/booking";
import type { SlotsState } from "./use-slots";

interface SlotGridProps {
  state: SlotsState;
  selected: string | null;
  onSelect: (slot: SlotOption) => void;
  onRetry: () => void;
  /** Taşımada mevcut saati listeden çıkarmak için */
  excludeStartTime?: string;
}

function groupSlots(slots: SlotOption[]) {
  const hour = (s: SlotOption) => Number(s.label.slice(0, 2));
  return [
    { label: "Sabah", slots: slots.filter((s) => hour(s) < 12) },
    { label: "Öğleden sonra", slots: slots.filter((s) => hour(s) >= 12 && hour(s) < 17) },
    { label: "Akşam", slots: slots.filter((s) => hour(s) >= 17) },
  ].filter((g) => g.slots.length > 0);
}

export function SlotGrid({ state, selected, onSelect, onRetry, excludeStartTime }: SlotGridProps) {
  if (state.status === "idle") return null;

  if (state.status === "loading") {
    return (
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6" aria-busy="true">
        {Array.from({ length: 12 }, (_, i) => (
          <Skeleton key={i} className="h-11 rounded-lg" />
        ))}
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="space-y-3 rounded-xl border border-dashed p-6 text-center">
        <p className="text-sm text-destructive">{state.message}</p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Tekrar dene
        </Button>
      </div>
    );
  }

  const slots = state.data.slots.filter((s) => s.startTime !== excludeStartTime);
  if (slots.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        Bu gün için uygun saat kalmadı. Başka bir gün deneyin.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {groupSlots(slots).map((group) => (
        <div key={group.label} className="space-y-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{group.label}</h3>
          <div role="radiogroup" aria-label={group.label} className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {group.slots.map((slot) => {
              const isSelected = slot.startTime === selected;
              return (
                <button
                  key={slot.startTime}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => onSelect(slot)}
                  className={cn(
                    "h-11 rounded-lg border text-sm font-medium tabular-nums transition-colors",
                    isSelected ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent"
                  )}
                >
                  {slot.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
