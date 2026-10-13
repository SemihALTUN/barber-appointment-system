// src/app/(public)/layout.tsx — Randevu al, sorgula ve yönetim sayfalarının ortak üst çubuğu.
// Dükkân adı her sayfadan ana sayfaya döner; ana sayfanın üst çubuğuyla aynı görünümdedir.
import Link from "next/link";
import { House, Search } from "lucide-react";
import { SHOP } from "@/config/shop";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/10 bg-primary text-primary-foreground">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between gap-4 px-4">
          <Link
            href="/"
            aria-label={`${SHOP.name} ana sayfası`}
            className="flex min-w-0 items-center gap-2 rounded-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground"
          >
            <House className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{SHOP.name}</span>
          </Link>
          <nav aria-label="Randevu bağlantıları" className="flex shrink-0 items-center gap-4 text-sm">
            <Link
              href="/"
              className="text-primary-foreground/75 hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground"
            >
              Ana sayfa
            </Link>
            <Link
              href="/randevu-sorgula"
              className="hidden items-center gap-1 text-primary-foreground/75 hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground sm:inline-flex"
            >
              <Search className="size-3.5" aria-hidden />
              Randevumu sorgula
            </Link>
          </nav>
        </div>
      </header>
      {children}
    </>
  );
}
