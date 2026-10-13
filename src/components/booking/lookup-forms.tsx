// src/components/booking/lookup-forms.tsx
"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Link2, Loader2, Phone, Search } from "lucide-react";
import type { AppointmentStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { SHOP } from "@/config/shop";
import { formatLongDate, formatPrice, formatTime } from "@/lib/format";
import { lookupAppointment } from "@/server/actions/lookup-appointment";
import type { AppointmentLookupResult } from "@/types/booking";

const STATUS_META: Record<AppointmentStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  CONFIRMED: { label: "Onaylandı", variant: "default" },
  COMPLETED: { label: "Tamamlandı", variant: "secondary" },
  CANCELLED: { label: "İptal edildi", variant: "destructive" },
  NO_SHOW: { label: "Gelinmedi", variant: "outline" },
};

/** SMS'teki ya da onay ekranındaki bağlantıdan takip kodu ve token'ı çıkarır (alan adı fark etmez). */
function parseManageLink(value: string): { ref: string; token: string } | null {
  try {
    const url = new URL(value.trim(), window.location.origin);
    const match = url.pathname.match(/\/randevu\/([^/]+)\/?$/);
    const token = url.searchParams.get("token");
    if (!match?.[1] || !token) return null;
    return { ref: decodeURIComponent(match[1]), token };
  } catch {
    return null;
  }
}

export function LookupForms() {
  const router = useRouter();

  const [link, setLink] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState<AppointmentLookupResult | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function openLink(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = parseManageLink(link);
    if (!parsed) {
      setLinkError("Bağlantı tanınmadı. Onay ekranında veya mesajda gelen bağlantının tamamını yapıştırın.");
      return;
    }
    router.push(`/randevu/${encodeURIComponent(parsed.ref)}?token=${encodeURIComponent(parsed.token)}`);
  }

  function lookup(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLookupError(null);
    setResult(null);
    startTransition(async () => {
      const res = await lookupAppointment({ referenceCode: code, customerPhone: phone });
      if (res.success) setResult(res.data);
      else setLookupError(res.error.message);
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Link2 className="size-5" aria-hidden />
            Randevu bağlantınızla açın
          </CardTitle>
          <CardDescription>İptal etmek veya saati değiştirmek için randevu bağlantınız gerekir.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={openLink} className="space-y-3" noValidate>
            <Label htmlFor="manage-link" className="sr-only">
              Randevu bağlantısı
            </Label>
            <Input
              id="manage-link"
              inputMode="url"
              autoComplete="off"
              placeholder="https://…/randevu/BRB-…?token=…"
              value={link}
              onChange={(e) => {
                setLink(e.target.value);
                setLinkError(null);
              }}
              aria-invalid={!!linkError}
              aria-describedby={linkError ? "manage-link-error" : undefined}
            />
            {linkError && (
              <p id="manage-link-error" className="text-sm text-destructive">
                {linkError}
              </p>
            )}
            <Button type="submit" className="w-full sm:w-auto" disabled={!link.trim()}>
              Randevumu aç
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Search className="size-5" aria-hidden />
            Takip kodu ile sorgulayın
          </CardTitle>
          <CardDescription>Randevunuzun tarihini ve durumunu görmek için takip kodunuzu ve telefonunuzu girin.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <form onSubmit={lookup} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="ref-code">Takip kodu</Label>
              <Input
                id="ref-code"
                autoComplete="off"
                autoCapitalize="characters"
                placeholder="BRB-M9K2-7E3B1A9F"
                className="font-mono uppercase"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lookup-phone">Randevuda verdiğiniz telefon</Label>
              <Input
                id="lookup-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="05XX XXX XX XX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            {lookupError && (
              <p role="alert" className="text-sm text-destructive">
                {lookupError}
              </p>
            )}
            <Button type="submit" variant="outline" className="w-full sm:w-auto" disabled={isPending || !code.trim() || !phone.trim()}>
              {isPending && <Loader2 className="animate-spin" />}
              Sorgula
            </Button>
          </form>

          {result && (
            <div className="space-y-3 rounded-xl border bg-muted/40 p-4 text-sm" aria-live="polite">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-muted-foreground">{result.referenceCode}</span>
                <Badge variant={STATUS_META[result.status].variant}>{STATUS_META[result.status].label}</Badge>
              </div>
              <div>
                <p className="font-medium">{formatLongDate(result.startTime)}</p>
                <p className="text-xl font-semibold tabular-nums">
                  {formatTime(result.startTime)} – {formatTime(result.endTime)}
                </p>
                <p className="text-muted-foreground">
                  {result.staffName}, {result.services.join(" + ")}
                </p>
              </div>
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>Toplam</span>
                <span className="tabular-nums">{formatPrice(result.totalPrice)}</span>
              </div>
              {result.status === "CONFIRMED" && (
                <p className="text-muted-foreground">
                  İptal veya saat değişikliği için randevu bağlantınızı yukarıdaki alana yapıştırın. Bağlantınız yoksa bizi
                  arayın:{" "}
                  <a href={`tel:${SHOP.phone}`} className="inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-2">
                    <Phone className="size-3.5" aria-hidden />
                    {SHOP.phoneDisplay}
                  </a>
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
