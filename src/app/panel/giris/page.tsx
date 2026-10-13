// src/app/panel/giris/page.tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/components/panel/login-form";
import { getPanelActor } from "@/server/auth/panel-actor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Personel Girişi", robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  // getPanelActor (requirePanelActor değil): pasif personelde yönlendirme döngüsü oluşmaz
  if (await getPanelActor()) redirect("/panel");
  const { callbackUrl } = await searchParams;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Personel Girişi</CardTitle>
          <CardDescription>Günlük programınızı yönetmek için giriş yapın.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm callbackUrl={callbackUrl} />
        </CardContent>
      </Card>
    </main>
  );
}
