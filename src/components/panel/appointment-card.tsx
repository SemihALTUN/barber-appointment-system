// src/components/panel/appointment-card.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Check, Loader2, Phone, UserX } from "lucide-react";
import type { AppointmentStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDuration, formatPrice, formatTime } from "@/lib/format";
import { updateAppointmentStatus } from "@/server/actions/update-appointment-status";
import type { PanelAppointment } from "@/types/panel";
import { ConfirmAction } from "./confirm-action";

const STATUS_STYLE: Record<
  AppointmentStatus,
  { label: string; badge: "default" | "secondary" | "destructive" | "outline"; border: string }
> = {
  CONFIRMED: { label: "Bekliyor", badge: "default", border: "border-l-primary" },
  COMPLETED: { label: "Tamamlandı", badge: "secondary", border: "border-l-emerald-500" },
  CANCELLED: { label: "İptal", badge: "outline", border: "border-l-muted-foreground/30" },
  NO_SHOW: { label: "Gelmedi", badge: "destructive", border: "border-l-destructive" },
};

/** "+905551234567" → "0555 123 45 67" */
function formatPhone(e164: string): string {
  const d = e164.replace(/^\+90/, "0");
  return d.length === 11 ? `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7, 9)} ${d.slice(9)}` : e164;
}

export function AppointmentCard({ appointment, now }: { appointment: PanelAppointment; now: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingStatus, setPendingStatus] = useState<"COMPLETED" | "NO_SHOW" | null>(null);

  const style = STATUS_STYLE[appointment.status];
  const started = now >= new Date(appointment.startTime).getTime();
  const isConfirmed = appointment.status === "CONFIRMED";

  function setStatus(status: "COMPLETED" | "NO_SHOW") {
    setPendingStatus(status);
    startTransition(async () => {
      const res = await updateAppointmentStatus({ appointmentId: appointment.id, status });
      setPendingStatus(null);
      if (res.success) {
        toast.success(status === "COMPLETED" ? "Randevu tamamlandı olarak işaretlendi." : "Gelmedi olarak işaretlendi.");
      } else {
        toast.error(res.error.message);
      }
      router.refresh();
    });
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-l-4 bg-card p-4 shadow-xs",
        style.border,
        appointment.status === "CANCELLED" && "opacity-60"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={cn("truncate font-semibold", appointment.status === "CANCELLED" && "line-through")}>
            {appointment.customerName}
          </p>
          <p className="truncate text-sm text-muted-foreground">{appointment.services.join(" + ")}</p>
        </div>
        <Badge variant={style.badge}>{style.label}</Badge>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <a href={`tel:${appointment.customerPhone}`} className="inline-flex items-center gap-1 text-primary">
          <Phone className="size-3.5" aria-hidden />
          {formatPhone(appointment.customerPhone)}
        </a>
        <span className="tabular-nums text-muted-foreground">
          {formatDuration(appointment.totalDurationMinutes)} · {formatPrice(appointment.totalPrice)}
        </span>
        {appointment.noShowCount > 0 && (
          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="size-3.5" aria-hidden />
            Daha önce {appointment.noShowCount} kez gelmedi
          </span>
        )}
      </div>

      {appointment.notes && <p className="mt-2 rounded-md bg-muted/60 p-2 text-sm">{appointment.notes}</p>}

      {isConfirmed && (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button size="sm" onClick={() => setStatus("COMPLETED")} disabled={!started || isPending}>
              {pendingStatus === "COMPLETED" ? <Loader2 className="animate-spin" /> : <Check />}
              Tamamlandı
            </Button>
            <ConfirmAction
              title="Gelmedi olarak işaretlensin mi?"
              description={`${appointment.customerName} — ${formatTime(appointment.startTime)} randevusu "Gelmedi" olarak kaydedilecek ve müşterinin gelmeme sayacı artacak. Bu işlem geri alınamaz.`}
              confirmLabel="Gelmedi"
              destructive
              onConfirm={() => setStatus("NO_SHOW")}
              trigger={
                <Button size="sm" variant="outline" disabled={!started || isPending}>
                  {pendingStatus === "NO_SHOW" ? <Loader2 className="animate-spin" /> : <UserX />}
                  Gelmedi
                </Button>
              }
            />
          </div>
          {!started && <p className="mt-2 text-xs text-muted-foreground">Durum butonları randevu saati gelince etkinleşir.</p>}
        </>
      )}
    </div>
  );
}
