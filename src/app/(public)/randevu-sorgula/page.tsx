// src/app/(public)/randevu-sorgula/page.tsx
import type { Metadata } from "next";
import { LookupForms } from "@/components/booking/lookup-forms";

export const metadata: Metadata = { title: "Randevumu Sorgula" };

export default function LookupPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Randevumu sorgula veya iptal et</h1>
      <LookupForms />
    </main>
  );
}
