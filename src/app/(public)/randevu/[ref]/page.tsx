// src/app/(public)/randevu/[ref]/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ManageAppointmentPanel } from "@/components/booking/manage-appointment-panel";
import { getManagedAppointment } from "@/server/queries/manage-appointment";
import { istanbulDateKey } from "@/lib/date-keys";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Randevu Yönetimi",
  referrer: "no-referrer", // URL'deki token, dış bağlantılara Referer ile sızmasın
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ ref: string }>;
  searchParams: Promise<{ token?: string | string[] }>;
}

export default async function ManageAppointmentPage({ params, searchParams }: PageProps) {
  const { ref } = await params;
  const { token } = await searchParams;
  const rawToken = typeof token === "string" ? token : undefined;

  const appointment = await getManagedAppointment(ref, rawToken);

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Randevunuz</h1>
      {appointment && rawToken ? (
        <ManageAppointmentPanel appointment={appointment} rawManageToken={rawToken} todayKey={istanbulDateKey()} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Bağlantı geçersiz</CardTitle>
            <CardDescription>
              Bu yönetim bağlantısı hatalı ya da eksik. Lütfen size gönderilen bağlantının tamamını kullanın.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/randevu-al">Yeni randevu al</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
