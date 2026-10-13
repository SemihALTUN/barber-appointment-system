// src/components/booking/booking-wizard.tsx
"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { firstWorkingDayKey } from "@/lib/date-keys";
import { formatDuration, formatPrice, sumPrices } from "@/lib/format";
import { createAppointment } from "@/server/actions/create-appointment";
import { getAvailableSlots } from "@/server/actions/get-available-slots";
import {
  CustomerNameSchema,
  MAX_SERVICES_PER_APPOINTMENT,
  TurkishMobilePhoneSchema,
} from "@/server/schemas/appointment.schema";
import type { CreatedAppointmentDTO } from "@/server/dto/appointment.dto";
import type { BookingCatalog, CatalogService, SlotOption } from "@/types/booking";
import { BookingSuccess } from "./booking-success";
import { DETAILS_FORM_ID, DetailsStep, type DetailsErrors, type DetailsValues } from "./details-step";
import { ServiceStep } from "./service-step";
import { SlotStep } from "./slot-step";
import { StaffStep } from "./staff-step";
import { useSlots } from "./use-slots";

type Step = "services" | "staff" | "slot" | "details" | "done";
const STEPS: ReadonlyArray<{ id: Exclude<Step, "done">; label: string }> = [
  { id: "services", label: "Hizmet" },
  { id: "staff", label: "Berber" },
  { id: "slot", label: "Saat" },
  { id: "details", label: "Bilgiler" },
];

function StepIndicator({ currentIndex }: { currentIndex: number }) {
  return (
    <ol className="flex items-center gap-2" aria-label="Randevu adımları">
      {STEPS.map((step, i) => (
        <li key={step.id} className="flex flex-1 flex-col gap-1.5">
          <span className={cn("h-1.5 rounded-full transition-colors", i <= currentIndex ? "bg-primary" : "bg-muted")} aria-hidden />
          <span
            className={cn("text-xs", i === currentIndex ? "font-medium text-foreground" : "text-muted-foreground")}
            aria-current={i === currentIndex ? "step" : undefined}
          >
            {step.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

interface BookingWizardProps {
  catalog: BookingCatalog;
  todayKey: string;
  /** Ana sayfadaki fiyat listesinden gelen ön seçili hizmetler (sunucuda doğrulanmış) */
  initialServiceIds?: string[];
}

export function BookingWizard({ catalog, todayKey, initialServiceIds = [] }: BookingWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("services");
  const [serviceIds, setServiceIds] = useState<string[]>(initialServiceIds);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [dateKey, setDateKey] = useState<string | null>(null);
  const [slot, setSlot] = useState<SlotOption | null>(null);
  const [details, setDetails] = useState<DetailsValues>({ customerName: "", customerPhone: "", notes: "" });
  const [errors, setErrors] = useState<DetailsErrors>({});
  const [result, setResult] = useState<CreatedAppointmentDTO | null>(null);
  const [isSubmitting, startSubmit] = useTransition();

  const serviceMap = useMemo(() => new Map(catalog.services.map((s) => [s.id, s])), [catalog.services]);
  const selectedServices = serviceIds.map((id) => serviceMap.get(id)).filter((s): s is CatalogService => s !== undefined);
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.durationMinutes, 0);
  const totalPrice = sumPrices(selectedServices.map((s) => s.price));

  const eligibleStaff = useMemo(
    () => catalog.staff.filter((member) => serviceIds.every((id) => member.serviceIds.includes(id))),
    [catalog.staff, serviceIds]
  );
  const selectedStaff = catalog.staff.find((s) => s.id === staffId) ?? null;

  const slotsLoader =
    staffId && dateKey && serviceIds.length > 0 ? () => getAvailableSlots({ staffId, serviceIds, dateKey }) : null;
  const { state: slotsState, reload: reloadSlots } = useSlots(
    slotsLoader,
    slotsLoader ? `${staffId}|${dateKey}|${serviceIds.join(",")}` : null
  );

  // --- Seçim işleyicileri ---------------------------------------------------
  function toggleService(id: string) {
    if (serviceIds.includes(id)) {
      setServiceIds(serviceIds.filter((x) => x !== id));
    } else if (serviceIds.length >= MAX_SERVICES_PER_APPOINTMENT) {
      toast.error(`En fazla ${MAX_SERVICES_PER_APPOINTMENT} hizmet seçebilirsiniz.`);
      return;
    } else {
      setServiceIds([...serviceIds, id]);
    }
    setSlot(null);
  }

  function selectStaff(id: string) {
    if (id === staffId) return;
    setStaffId(id);
    setDateKey(null);
    setSlot(null);
  }

  function selectDate(key: string) {
    setDateKey(key);
    setSlot(null);
  }

  function updateDetail(field: keyof DetailsValues, value: string) {
    setDetails((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  // --- Adım geçişleri -------------------------------------------------------
  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const canContinue =
    (step === "services" && serviceIds.length > 0) ||
    (step === "staff" && staffId !== null) ||
    (step === "slot" && slot !== null) ||
    step === "details";

  function goNext() {
    if (step === "services") {
      if (staffId && !eligibleStaff.some((s) => s.id === staffId)) {
        setStaffId(null);
        setDateKey(null);
        setSlot(null);
      }
      setStep("staff");
    } else if (step === "staff" && selectedStaff) {
      if (!dateKey) setDateKey(firstWorkingDayKey(todayKey, selectedStaff.workingDays));
      setStep("slot");
    } else if (step === "slot" && slot) {
      setStep("details");
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goBack() {
    const prev = STEPS[stepIndex - 1];
    if (prev) setStep(prev.id);
  }

  // --- Gönderim ---------------------------------------------------------------
  function submit() {
    const nextErrors: DetailsErrors = {};
    const name = CustomerNameSchema.safeParse(details.customerName);
    const phone = TurkishMobilePhoneSchema.safeParse(details.customerPhone);
    if (!name.success) nextErrors.customerName = name.error.issues[0]?.message;
    if (!phone.success) nextErrors.customerPhone = phone.error.issues[0]?.message;
    if (details.notes.length > 500) nextErrors.notes = "Not en fazla 500 karakter olabilir.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !staffId || !slot) return;

    const chosenSlot = slot;
    const chosenStaffId = staffId;
    startSubmit(async () => {
      const res = await createAppointment({
        staffId: chosenStaffId,
        serviceIds,
        startTime: chosenSlot.startTime,
        customerName: details.customerName,
        customerPhone: details.customerPhone,
        notes: details.notes || undefined,
      });

      if (res.success) {
        setResult(res.data);
        setStep("done");
        window.scrollTo({ top: 0 });
        return;
      }

      toast.error(res.error.message);
      switch (res.error.code) {
        case "SLOT_UNAVAILABLE":
        case "INVALID_TIMEFRAME":
          setSlot(null);
          setStep("slot");
          reloadSlots();
          break;
        case "STAFF_NOT_ELIGIBLE":
        case "INVALID_SERVICE":
          setStaffId(null);
          setDateKey(null);
          setSlot(null);
          setStep("services");
          router.refresh(); // Katalog değişmiş olabilir
          break;
      }
    });
  }

  // --- Görünüm --------------------------------------------------------------
  if (step === "done" && result) {
    return <BookingSuccess appointment={result} staffName={selectedStaff?.name ?? ""} />;
  }

  return (
    <div className="space-y-6">
      <StepIndicator currentIndex={stepIndex} />

      {step === "services" && <ServiceStep services={catalog.services} selectedIds={serviceIds} onToggle={toggleService} />}
      {step === "staff" && <StaffStep staff={eligibleStaff} selectedId={staffId} onSelect={selectStaff} />}
      {step === "slot" && selectedStaff && (
        <SlotStep
          todayKey={todayKey}
          staffName={selectedStaff.name}
          workingDays={selectedStaff.workingDays}
          dateKey={dateKey}
          onDateChange={selectDate}
          slotsState={slotsState}
          selectedSlot={slot}
          onSelectSlot={setSlot}
          onRetry={reloadSlots}
        />
      )}
      {step === "details" && selectedStaff && dateKey && slot && (
        <DetailsStep
          values={details}
          errors={errors}
          onChange={updateDetail}
          onSubmit={submit}
          summary={{
            services: selectedServices,
            staffName: selectedStaff.name,
            dateKey,
            slotLabel: slot.label,
            totalDuration,
            totalPrice,
          }}
        />
      )}

      {/* Mobil öncelikli sabit alt çubuk */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {stepIndex > 0 ? (
            <Button variant="outline" size="icon" onClick={goBack} disabled={isSubmitting} aria-label="Önceki adım">
              <ArrowLeft />
            </Button>
          ) : (
            <Button asChild variant="outline" size="icon">
              <Link href="/" aria-label="Ana sayfaya dön">
                <ArrowLeft />
              </Link>
            </Button>
          )}
          <div className="min-w-0 flex-1 text-sm">
            {serviceIds.length > 0 ? (
              <>
                <div className="font-semibold tabular-nums">{formatPrice(totalPrice)}</div>
                <div className="truncate text-muted-foreground">
                  {formatDuration(totalDuration)}
                  {slot ? ` · ${slot.label}` : ""}
                </div>
              </>
            ) : (
              <span className="text-muted-foreground">Hizmet seçilmedi</span>
            )}
          </div>
          {step === "details" ? (
            <Button type="submit" form={DETAILS_FORM_ID} disabled={isSubmitting} className="min-w-36">
              {isSubmitting && <Loader2 className="animate-spin" />}
              Randevuyu onayla
            </Button>
          ) : (
            <Button onClick={goNext} disabled={!canContinue} className="min-w-36">
              Devam
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
