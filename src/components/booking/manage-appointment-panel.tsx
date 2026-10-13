// src/components/booking/manage-appointment-panel.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, Loader2, User } from "lucide-react";
import type { AppointmentStatus } from "@prisma/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { BOOKING_HORIZON_DAYS, dayOfWeekFromKey, firstWorkingDayKey } from "@/lib/date-keys";
import { formatDuration, formatLongDate, formatPrice, formatTime } from "@/lib/format";
import { cancelAppointmentByToken } from "@/server/actions/cancel-appointment";
import { getRescheduleSlots } from "@/server/actions/get-reschedule-slots";
import { rescheduleAppointment } from "@/server/actions/reschedule-appointment";
import type { ManagedAppointmentView, SlotOption } from "@/types/booking";
import { DateStrip } from "./date-strip";
import { SlotGrid } from "./slot-grid";
import { useSlots } from "./use-slots";

const STATUS_META: Record<AppointmentStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  CONFIRMED: { label: "Onaylandı", variant: "default" },
  COMPLETED: { label: "Tamamlandı", variant: "secondary" },
  CANCELLED: { label: "İptal edildi", variant: "destructive" },
  NO_SHOW: { label: "Gelinmedi", variant: "outline" },
};

interface ManageAppointmentPanelProps {
  appointment: ManagedAppointmentView;
  rawManageToken: string;
  todayKey: string;
}

export function ManageAppointmentPanel({ appointment, rawManageToken, todayKey }: ManageAppointmentPanelProps) {
  const router = useRouter();
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [dateKey, setDateKey] = useState<string | null>(null);
  const [slot, setSlot] = useState<SlotOption | null>(null);
  const [pendingAction, setPendingAction] = useState<"cancel" | "reschedule" | null>(null);
  const [isPending, startTransition] = useTransition();

  const slotsLoader =
    isRescheduling && dateKey
      ? () => getRescheduleSlots({ referenceCode: appointment.referenceCode, rawManageToken, dateKey })
      : null;
  const { state: slotsState, reload } = useSlots(slotsLoader, slotsLoader ? `${appointment.startTime}|${dateKey}` : null);

  const meta = STATUS_META[appointment.status];

  function openReschedule() {
    setIsRescheduling(true);
    setSlot(null);
    setDateKey(firstWorkingDayKey(todayKey, appointment.staffWorkingDays));
  }

  function closeReschedule() {
    setIsRescheduling(false);
    setDateKey(null);
    setSlot(null);
  }

  function confirmReschedule() {
    if (!slot) return;
    const target = slot;
    setPendingAction("reschedule");
    startTransition(async () => {
      const res = await rescheduleAppointment({
        appointmentId: appointment.id,
        newStartTime: new Date(target.startTime),
        rawManageToken,
      });
      setPendingAction(null);

      if (res.success) {
        toast.success(`Randevunuz ${formatLongDate(res.data.startTime)} ${formatTime(res.data.startTime)} saatine taşındı.`);
        closeReschedule();
        router.refresh();
        return;
      }
      toast.error(res.error.message);
      if (res.error.code === "SLOT_UNAVAILABLE") {
        setSlot(null);
        reload();
      } else {
        closeReschedule();
        router.refresh();
      }
    });
  }

  function confirmCancel() {
    setPendingAction("cancel");
    startTransition(async () => {
      const res = await cancelAppointmentByToken(rawManageToken);
      setPendingAction(null);
      if (res.success) toast.success("Randevunuz iptal edildi.");
      else toast.error(res.error.message);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="gap-2">
          <div className="flex items-center justify-between gap-2">
            <CardDescription className="font-mono">{appointment.referenceCode}</CardDescription>
            <Badge variant={meta.variant}>{meta.label}</Badge>
          </div>
          <CardTitle className="text-xl">{formatLongDate(appointment.startTime)}</CardTitle>
          <p className="text-2xl font-semibold tabular-nums">
            {formatTime(appointment.startTime)} – {formatTime(appointment.endTime)}
          </p>
        </CardHeader>

        <CardContent className="space-y-4 text-sm">
          <div className="flex items-center gap-2">
            <User className="size-4 text-muted-foreground" aria-hidden />
            <span>
              {appointment.staffName} <span className="text-muted-foreground">· {appointment.staffTitle}</span>
            </span>
          </div>
          <Separator />
          <ul className="space-y-1">
            {appointment.items.map((item, i) => (
              <li key={i} className="flex justify-between gap-4">
                <span>
                  {item.serviceName} <span className="text-muted-foreground">· {formatDuration(item.durationMinutes)}</span>
                </span>
                <span className="tabular-nums">{formatPrice(item.unitPrice)}</span>
              </li>
            ))}
          </ul>
          <Separator />
          <div className="flex justify-between font-semibold">
            <span>Toplam · {formatDuration(appointment.totalDurationMinutes)}</span>
            <span className="tabular-nums">{formatPrice(appointment.totalPrice)}</span>
          </div>
        </CardContent>

        {appointment.canModify && !isRescheduling && (
          <CardFooter className="flex flex-col gap-2 sm:flex-row">
            <Button className="w-full sm:flex-1" onClick={openReschedule} disabled={isPending}>
              <CalendarClock />
              Saati değiştir
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="w-full text-destructive sm:flex-1" disabled={isPending}>
                  {pendingAction === "cancel" && <Loader2 className="animate-spin" />}
                  Randevuyu iptal et
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Randevu iptal edilsin mi?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {formatLongDate(appointment.startTime)} {formatTime(appointment.startTime)} randevunuz iptal edilecek.
                    Bu işlem geri alınamaz.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Vazgeç</AlertDialogCancel>
                  <AlertDialogAction onClick={confirmCancel} className={buttonVariants({ variant: "destructive" })}>
                    İptal et
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardFooter>
        )}
      </Card>

      {appointment.canModify
        ? !isRescheduling && (
            <p className="text-center text-xs text-muted-foreground">
              Değişiklik ve iptal için son zaman: {formatLongDate(appointment.modifyDeadline)}{" "}
              {formatTime(appointment.modifyDeadline)}
            </p>
          )
        : appointment.status === "CONFIRMED" && (
            <p className="rounded-xl border bg-muted/50 p-4 text-sm text-muted-foreground">
              Randevuya 2 saatten az kaldığı için çevrimiçi değişiklik yapılamıyor. Lütfen işletmeyle iletişime geçin.
            </p>
          )}

      {isRescheduling && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Yeni saat seçin</CardTitle>
            <CardDescription>
              Hizmet süreniz ({formatDuration(appointment.totalDurationMinutes)}) ve berberiniz aynı kalır.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <DateStrip
              startKey={todayKey}
              days={BOOKING_HORIZON_DAYS}
              selectedKey={dateKey}
              onSelect={(key) => {
                setDateKey(key);
                setSlot(null);
              }}
              isDisabled={(key) => !appointment.staffWorkingDays.includes(dayOfWeekFromKey(key))}
            />
            <SlotGrid
              state={slotsState}
              selected={slot?.startTime ?? null}
              onSelect={setSlot}
              onRetry={reload}
              excludeStartTime={appointment.startTime}
            />
          </CardContent>
          <CardFooter className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={closeReschedule} disabled={isPending}>
              Vazgeç
            </Button>
            <Button className="flex-1" onClick={confirmReschedule} disabled={!slot || isPending}>
              {pendingAction === "reschedule" && <Loader2 className="animate-spin" />}
              {slot ? `${slot.label} olarak onayla` : "Saat seçin"}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
