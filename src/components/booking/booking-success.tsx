// src/components/booking/booking-success.tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Check, CheckCircle2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { formatLongDate, formatPrice, formatTime } from "@/lib/format";
import type { CreatedAppointmentDTO } from "@/server/dto/appointment.dto";

export function BookingSuccess({ appointment, staffName }: { appointment: CreatedAppointmentDTO; staffName: string }) {
  const [copied, setCopied] = useState(false);
  const managePath = `/randevu/${encodeURIComponent(appointment.referenceCode)}?token=${appointment.rawManageToken}`;
  // Bu bileşen yalnızca istemcide, randevu oluşturulduktan sonra render edilir → window güvenli
  const manageUrl = `${window.location.origin}${managePath}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(manageUrl);
      setCopied(true);
      toast.success("Bağlantı kopyalandı.");
    } catch {
      toast.error("Kopyalanamadı; bağlantıyı elle seçip kopyalayın.");
    }
  }

  return (
    <Card>
      <CardHeader className="items-center text-center">
        <CheckCircle2 className="size-12 text-primary" aria-hidden />
        <CardTitle className="text-xl">Randevunuz oluşturuldu</CardTitle>
        <CardDescription>
          Takip kodu: <span className="font-mono font-semibold text-foreground">{appointment.referenceCode}</span>
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 text-sm">
        <div className="rounded-xl bg-muted/50 p-4 text-center">
          <p className="font-medium">{formatLongDate(appointment.startTime)}</p>
          <p className="text-2xl font-semibold tabular-nums">
            {formatTime(appointment.startTime)} – {formatTime(appointment.endTime)}
          </p>
          <p className="text-muted-foreground">{staffName}</p>
        </div>

        <ul className="space-y-1">
          {appointment.items?.map((item) => (
            <li key={item.serviceId} className="flex justify-between">
              <span>{item.serviceName}</span>
              <span className="tabular-nums">{formatPrice(item.unitPrice)}</span>
            </li>
          ))}
        </ul>
        <Separator />
        <div className="flex justify-between font-semibold">
          <span>Toplam</span>
          <span className="tabular-nums">{formatPrice(appointment.totalPrice)}</span>
        </div>

        <div className="space-y-2 rounded-xl border border-amber-300/60 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-950/30">
          <p className="font-medium">Bu bağlantıyı saklayın</p>
          <p className="text-muted-foreground">Randevunuzu iptal etmek veya saatini değiştirmek için bu bağlantı gereklidir.</p>
          <div className="flex gap-2">
            <Input readOnly value={manageUrl} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
            <Button type="button" variant="outline" size="icon" onClick={copyLink} aria-label="Bağlantıyı kopyala">
              {copied ? <Check /> : <Copy />}
            </Button>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex flex-col gap-2 sm:flex-row">
        <Button asChild className="w-full sm:flex-1">
          <Link href={managePath}>Randevuyu görüntüle</Link>
        </Button>
        <Button asChild variant="outline" className="w-full sm:flex-1">
          <Link href="/">Ana sayfaya dön</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
