// src/components/booking/service-step.tsx
"use client";

import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDuration, formatPrice } from "@/lib/format";
import type { CatalogService } from "@/types/booking";
import { StepHeading } from "./step-heading";

interface ServiceStepProps {
  services: CatalogService[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}

export function ServiceStep({ services, selectedIds, onToggle }: ServiceStepProps) {
  return (
    <section className="space-y-4">
      <StepHeading
        title="Hizmet seçin"
        description="Birden fazla hizmet seçebilirsiniz; hizmetler seçim sırasına göre uygulanır."
      />
      <ul className="space-y-2">
        {services.map((service) => {
          const order = selectedIds.indexOf(service.id);
          const selected = order !== -1;
          return (
            <li key={service.id}>
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => onToggle(service.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors",
                  selected ? "border-primary bg-primary/5" : "bg-card hover:bg-accent"
                )}
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border text-sm font-semibold",
                    selected ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground"
                  )}
                  aria-hidden
                >
                  {selected ? order + 1 : <Plus className="size-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{service.name}</span>
                  {service.description && (
                    <span className="block truncate text-sm text-muted-foreground">{service.description}</span>
                  )}
                  <span className="text-sm text-muted-foreground">{formatDuration(service.durationMinutes)}</span>
                </span>
                <span className="font-semibold tabular-nums">{formatPrice(service.price)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
