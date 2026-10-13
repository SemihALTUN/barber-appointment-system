// src/components/landing/mobile-menu.tsx — Ana sayfa üst çubuğunun mobil (md altı) hamburger menüsü
"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { CalendarCheck, Menu, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MobileMenuLink {
  href: string;
  label: string;
}

interface MobileMenuProps {
  links: readonly MobileMenuLink[];
  bookHref: string;
  lookupHref: string;
}

export function MobileMenu({ links, bookHref, lookupHref }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    // Escape ile kapat, odağı menü butonuna geri ver
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    // Ekran masaüstü genişliğine çıkarsa (md = 768px) menüyü kapat
    const desktop = window.matchMedia("(min-width: 768px)");
    function onBreakpoint(e: MediaQueryListEvent) {
      if (e.matches) setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    desktop.addEventListener("change", onBreakpoint);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      desktop.removeEventListener("change", onBreakpoint);
    };
  }, [open]);

  const close = () => setOpen(false);
  const itemClass =
    "flex items-center gap-3 rounded-md px-3 py-3 text-base text-primary-foreground/85 hover:bg-white/10 hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground";

  return (
    <div className="md:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Menüyü kapat" : "Menüyü aç"}
        onClick={() => setOpen((v) => !v)}
        className="-mr-2 flex size-11 items-center justify-center rounded-md hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground"
      >
        {open ? <X className="size-6" aria-hidden /> : <Menu className="size-6" aria-hidden />}
      </button>

      {/* Menü dışına dokunulunca kapanır */}
      {open && <div aria-hidden className="fixed inset-x-0 top-14 bottom-0 z-30 bg-black/40" onClick={close} />}

      <nav
        id={panelId}
        aria-label="Menü"
        hidden={!open}
        className={cn(
          "absolute inset-x-0 top-full z-40 border-b border-white/10 bg-primary px-4 pt-2 pb-4 shadow-lg",
          "max-h-[calc(100dvh-3.5rem)] overflow-y-auto"
        )}
      >
        <ul className="space-y-1">
          {links.map((link) => (
            <li key={link.href}>
              <a href={link.href} onClick={close} className={itemClass}>
                {link.label}
              </a>
            </li>
          ))}
          <li className="mt-2 border-t border-white/10 pt-2">
            <Link href={lookupHref} onClick={close} className={itemClass}>
              <Search className="size-4" aria-hidden />
              Randevumu Sorgula / İptal Et
            </Link>
          </li>
        </ul>
        <Link
          href={bookHref}
          onClick={close}
          className="mt-3 flex h-12 items-center justify-center gap-2 rounded-md bg-primary-foreground font-semibold text-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-foreground/50"
        >
          <CalendarCheck className="size-5" aria-hidden />
          Hemen Randevu Al
        </Link>
      </nav>
    </div>
  );
}
