// src/components/panel/add-break-dialog.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import type { BlockType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import { formatDateKey, istanbulDateKey } from "@/lib/date-keys";
import { SLOT_INTERVAL_MINUTES, getIstanbulDateParts } from "@/lib/timezone";
import { addTimeBlock } from "@/server/actions/add-time-block";
import { BLOCK_LABEL } from "./time-block-card";

const STEP = SLOT_INTERVAL_MINUTES;
const TIME_OPTIONS = Array.from({ length: (24 * 60) / STEP }, (_, i) => {
  const minutes = i * STEP;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});
// Client bundle'a Prisma runtime'ı çekmemek için enum değerleri string literal olarak tutulur
const BLOCK_TYPES: readonly BlockType[] = ["BREAK", "OFF_DUTY", "EMERGENCY"];
const LAST_SLOT = 24 * 60 - STEP; // Günün son seçilebilir saati (30 dk için 23:30)

const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const toHhmm = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

function defaultStart(dateKey: string, shifts: { startTime: string }[]): string {
  if (dateKey === istanbulDateKey()) {
    const p = getIstanbulDateParts(new Date());
    const next = Math.ceil((p.hour * 60 + p.minute + 1) / STEP) * STEP;
    return toHhmm(Math.min(next, LAST_SLOT - STEP));
  }
  return shifts[0]?.startTime ?? "12:00";
}

interface AddBreakDialogProps {
  staffId: string;
  dateKey: string;
  shifts: { startTime: string; endTime: string }[];
}

export function AddBreakDialog({ staffId, dateKey, shifts }: AddBreakDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<BlockType>("BREAK");
  const [start, setStart] = useState("12:00");
  const [end, setEnd] = useState("12:30");
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    if (next) {
      // Varsayılanlar açılışta hesaplanır → SSR/hydration farkı oluşmaz
      const s = defaultStart(dateKey, shifts);
      setType("BREAK");
      setStart(s);
      setEnd(toHhmm(Math.min(toMinutes(s) + STEP, LAST_SLOT)));
      setReason("");
    }
    setOpen(next);
  }

  function changeStart(value: string) {
    setStart(value);
    if (toMinutes(end) <= toMinutes(value)) setEnd(toHhmm(Math.min(toMinutes(value) + STEP, LAST_SLOT)));
  }

  function submit() {
    if (toMinutes(end) <= toMinutes(start)) {
      toast.error("Bitiş saati başlangıçtan sonra olmalıdır.");
      return;
    }
    startTransition(async () => {
      const res = await addTimeBlock({
        staffId,
        startTime: new Date(`${dateKey}T${start}:00.000+03:00`),
        endTime: new Date(`${dateKey}T${end}:00.000+03:00`),
        type,
        reason: reason || undefined,
      });
      if (res.success) {
        toast.success(`${BLOCK_LABEL[type]} eklendi: ${start}–${end}`);
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error.message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 h-12 rounded-full px-5 shadow-lg">
          <Plus />
          Mola ekle
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mola / izin ekle</DialogTitle>
          <DialogDescription>
            {formatDateKey(dateKey, { weekday: "long", day: "numeric", month: "long" })} — bu aralık müşteri randevularına
            kapanır.
          </DialogDescription>
        </DialogHeader>

        <form
          id="add-break-form"
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tür">
            {BLOCK_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={type === t}
                onClick={() => setType(t)}
                className={cn(
                  "h-10 rounded-lg border text-sm font-medium transition-colors",
                  type === t ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"
                )}
              >
                {BLOCK_LABEL[t]}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="break-start">Başlangıç</Label>
              <NativeSelect id="break-start" value={start} onChange={(e) => changeStart(e.target.value)}>
                {TIME_OPTIONS.slice(0, -1).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="break-end">Bitiş</Label>
              <NativeSelect id="break-end" value={end} onChange={(e) => setEnd(e.target.value)}>
                {TIME_OPTIONS.filter((t) => toMinutes(t) > toMinutes(start)).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="break-reason">Açıklama (isteğe bağlı)</Label>
            <Input
              id="break-reason"
              maxLength={200}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Örn. Öğle arası"
            />
          </div>
        </form>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Vazgeç
          </Button>
          <Button type="submit" form="add-break-form" disabled={isPending}>
            {isPending && <Loader2 className="animate-spin" />}
            Ekle
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
