// src/app/panel/(protected)/layout.tsx
import type { Metadata } from "next";
import { LogOut, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth";
import { requirePanelActor } from "@/server/auth/panel-actor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Berber Paneli", robots: { index: false, follow: false } };

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const actor = await requirePanelActor();

  return (
    <div className="min-h-dvh bg-muted/30">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Scissors className="size-5" aria-hidden />
            <span className="font-semibold">Berber Paneli</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {actor.role === "ADMIN" ? "Yönetici" : "Personel"}
            </span>
          </div>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/panel/giris" });
            }}
          >
            <Button variant="ghost" size="sm" type="submit">
              <LogOut />
              Çıkış
            </Button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
