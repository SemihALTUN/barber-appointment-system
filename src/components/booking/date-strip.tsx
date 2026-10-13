// src/components/booking/date-strip.tsx
"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { addDaysToKey, formatDateKey } from "@/lib/date-keys";

interface DateStripProps {
  startKey: string;
  days: number;
  selectedKey: string | null;
  onSelect: (key: string) => void;
  isDisabled?: (key: string) => boolean;
}

export function DateStrip({ startKey, days, selectedKey, onSelect, isDisabled }: DateStripProps) {
  const keys = useMemo(() => Array.from({ length: days }, (_, i) => addDaysToKey(startKey, i)), [startKey, days]);

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
      <div role="listbox" aria-label="Tarih seçin" className="flex gap-2">
        {keys.map((key, i) => {
          const disabled = isDisabled?.(key) ?? false;
          const selected = key === selectedKey;
          return (
            <button
              key={key}
              type="button"
              role="option"
              aria-selected={selected}
              disabled={disabled}
              onClick={() => onSelect(key)}
              className={cn(
                "flex w-16 shrink-0 flex-col items-center rounded-xl border px-2 py-3 text-sm transition-colors",
                selected ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent",
                disabled && "cursor-not-allowed opacity-40 hover:bg-card"
              )}
            >
              <span className="text-[11px] uppercase">
                {i === 0 ? "Bugün" : i === 1 ? "Yarın" : formatDateKey(key, { weekday: "short" })}
              </span>
              <span className="text-lg font-semibold tabular-nums">{formatDateKey(key, { day: "numeric" })}</span>
              <span className="text-[11px]">{formatDateKey(key, { month: "short" })}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
