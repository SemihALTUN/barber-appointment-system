// src/app/(public)/randevu-al/page.tsx
import type { Metadata } from "next";
import { BookingWizard } from "@/components/booking/booking-wizard";
import { getBookingCatalog } from "@/server/queries/booking-catalog";
import { istanbulDateKey } from "@/lib/date-keys";
import { MAX_SERVICES_PER_APPOINTMENT } from "@/server/schemas/appointment.schema";

export const dynamic = "force-dynamic"; // "Bugün" her istekte İstanbul saatine göre hesaplanmalı
export const metadata: Metadata = { title: "Randevu Al" };

interface PageProps {
  searchParams: Promise<{ hizmet?: string | string[] }>;
}

export default async function BookingPage({ searchParams }: PageProps) {
  const [catalog, { hizmet }] = await Promise.all([getBookingCatalog(), searchParams]);

  // ?hizmet=<id> (ana sayfadaki fiyat listesinden) → yalnızca aktif ve tekil hizmetler ön seçilir
  const requested = Array.isArray(hizmet) ? hizmet : hizmet ? [hizmet] : [];
  const activeIds = new Set(catalog.services.map((s) => s.id));
  const initialServiceIds = [...new Set(requested)]
    .filter((id) => activeIds.has(id))
    .slice(0, MAX_SERVICES_PER_APPOINTMENT);

  return (
    <main className="mx-auto max-w-2xl px-4 pt-6 pb-32">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Randevu Al</h1>
      {catalog.services.length === 0 || catalog.staff.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
          Şu anda çevrimiçi randevu alınamıyor. Lütfen daha sonra tekrar deneyin.
        </p>
      ) : (
        <BookingWizard catalog={catalog} todayKey={istanbulDateKey()} initialServiceIds={initialServiceIds} />
      )}
    </main>
  );
}
