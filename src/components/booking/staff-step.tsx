// src/components/booking/staff-step.tsx
"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CatalogStaff } from "@/types/booking";
import { StepHeading } from "./step-heading";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toLocaleUpperCase("tr-TR"))
    .join("");
}

interface StaffStepProps {
  staff: CatalogStaff[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function StaffStep({ staff, selectedId, onSelect }: StaffStepProps) {
  return (
    <section className="space-y-4">
      <StepHeading title="Berber seçin" description="Yalnızca seçtiğiniz hizmetlerin tümünü veren berberler listelenir." />
      {staff.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Seçtiğiniz hizmetlerin tümünü veren bir berber bulunamadı. Geri dönüp hizmet seçiminizi değiştirin.
        </p>
      ) : (
        <ul className="space-y-2">
          {staff.map((member) => {
            const selected = member.id === selectedId;
            return (
              <li key={member.id}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onSelect(member.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors",
                    selected ? "border-primary bg-primary/5" : "bg-card hover:bg-accent"
                  )}
                >
                  <span
                    className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-base font-semibold"
                    aria-hidden
                  >
                    {initials(member.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{member.name}</span>
                    <span className="block text-sm text-muted-foreground">{member.title}</span>
                    {member.bio && <span className="mt-1 line-clamp-2 text-sm text-muted-foreground">{member.bio}</span>}
                  </span>
                  {selected && <Check className="size-5 shrink-0 text-primary" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
