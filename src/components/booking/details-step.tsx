// src/components/booking/details-step.tsx
"use client";

import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { formatDateKey } from "@/lib/date-keys";
import { formatDuration, formatPrice } from "@/lib/format";
import type { CatalogService } from "@/types/booking";
import { StepHeading } from "./step-heading";

export interface DetailsValues {
  customerName: string;
  customerPhone: string;
  notes: string;
}
export type DetailsErrors = Partial<Record<keyof DetailsValues, string>>;

export const DETAILS_FORM_ID = "booking-details-form";

interface DetailsStepProps {
  values: DetailsValues;
  errors: DetailsErrors;
  onChange: (field: keyof DetailsValues, value: string) => void;
  onSubmit: () => void;
  summary: {
    services: CatalogService[];
    staffName: string;
    dateKey: string;
    slotLabel: string;
    totalDuration: number;
    totalPrice: string;
  };
}

export function DetailsStep({ values, errors, onChange, onSubmit, summary }: DetailsStepProps) {
  return (
    <section className="space-y-6">
      <StepHeading title="Bilgileriniz" description="Randevu onayı ve yönetim bağlantısı bu numaraya gönderilir." />

      <div className="space-y-3 rounded-xl border bg-muted/40 p-4 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Tarih</span>
          <span className="text-right font-medium">
            {formatDateKey(summary.dateKey, { weekday: "long", day: "numeric", month: "long" })} · {summary.slotLabel}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Berber</span>
          <span className="font-medium">{summary.staffName}</span>
        </div>
        <Separator />
        {summary.services.map((s) => (
          <div key={s.id} className="flex justify-between gap-4">
            <span>{s.name}</span>
            <span className="tabular-nums">{formatPrice(s.price)}</span>
          </div>
        ))}
        <Separator />
        <div className="flex justify-between gap-4 font-semibold">
          <span>Toplam · {formatDuration(summary.totalDuration)}</span>
          <span className="tabular-nums">{formatPrice(summary.totalPrice)}</span>
        </div>
      </div>

      <form
        id={DETAILS_FORM_ID}
        noValidate
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="customerName">Ad Soyad</Label>
          <Input
            id="customerName"
            autoComplete="name"
            value={values.customerName}
            onChange={(e) => onChange("customerName", e.target.value)}
            aria-invalid={!!errors.customerName}
            aria-describedby={errors.customerName ? "customerName-error" : undefined}
          />
          {errors.customerName && (
            <p id="customerName-error" className="text-sm text-destructive">
              {errors.customerName}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="customerPhone">Cep telefonu</Label>
          <Input
            id="customerPhone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="05XX XXX XX XX"
            value={values.customerPhone}
            onChange={(e) => onChange("customerPhone", e.target.value)}
            aria-invalid={!!errors.customerPhone}
            aria-describedby={errors.customerPhone ? "customerPhone-error" : undefined}
          />
          {errors.customerPhone && (
            <p id="customerPhone-error" className="text-sm text-destructive">
              {errors.customerPhone}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Not (isteğe bağlı)</Label>
          <Textarea
            id="notes"
            rows={3}
            maxLength={500}
            value={values.notes}
            onChange={(e) => onChange("notes", e.target.value)}
          />
          {errors.notes && <p className="text-sm text-destructive">{errors.notes}</p>}
        </div>

        <p className="text-xs text-muted-foreground">
          Randevu oluşturarak kişisel verilerinizin{" "}
          <Link href="/kvkk" className="underline underline-offset-2">
            KVKK Aydınlatma Metni
          </Link>{" "}
          kapsamında işlendiğini kabul etmiş olursunuz.
        </p>
      </form>
    </section>
  );
}
