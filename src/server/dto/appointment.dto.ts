// src/server/dto/appointment.dto.ts
// Server Action dönüşleri istemciye serileştirilir: Prisma.Decimal sınıf örneği geçemez,
// manageTokenHash ise hiçbir koşulda istemciye dönmemelidir.
import type { Appointment, AppointmentItem, AppointmentStatus } from "@prisma/client";

export interface AppointmentItemDTO {
  serviceId: string;
  serviceName: string;
  orderIndex: number;
  durationMinutes: number;
  unitPrice: string; // "450.00"
}

export interface AppointmentDTO {
  id: string;
  referenceCode: string;
  staffId: string;
  customerName: string;
  customerPhone: string;
  startTime: Date;
  endTime: Date;
  totalDurationMinutes: number;
  totalPrice: string; // "450.00"
  status: AppointmentStatus;
  notes: string | null;
  items?: AppointmentItemDTO[];
}

export interface CreatedAppointmentDTO extends AppointmentDTO {
  /** Yalnızca oluşturma anında bir kez döner; SMS/e-posta linkine gömülür, DB'de saklanmaz. */
  rawManageToken: string;
}

export function toAppointmentDTO(appt: Appointment & { items?: AppointmentItem[] }): AppointmentDTO {
  return {
    id: appt.id,
    referenceCode: appt.referenceCode,
    staffId: appt.staffId,
    customerName: appt.customerName,
    customerPhone: appt.customerPhone,
    startTime: appt.startTime,
    endTime: appt.endTime,
    totalDurationMinutes: appt.totalDurationMinutes,
    totalPrice: appt.totalPrice.toFixed(2),
    status: appt.status,
    notes: appt.notes,
    items: appt.items
      ?.slice()
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((item) => ({
        serviceId: item.serviceId,
        serviceName: item.serviceName,
        orderIndex: item.orderIndex,
        durationMinutes: item.durationMinutes,
        unitPrice: item.unitPrice.toFixed(2),
      })),
  };
}
