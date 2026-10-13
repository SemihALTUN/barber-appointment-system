// src/types/booking.ts — Server ↔ Client arasında paylaşılan düz tipler
import type { AppointmentStatus } from "@prisma/client";

export interface CatalogService {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  price: string; // "450.00"
}

export interface CatalogStaff {
  id: string;
  name: string;
  title: string;
  bio: string | null;
  serviceIds: string[];
  workingDays: number[]; // 0: Pazar ... 6: Cumartesi
}

export interface BookingCatalog {
  services: CatalogService[];
  staff: CatalogStaff[];
}

export interface SlotOption {
  startTime: string; // UTC ISO
  label: string; // "10:15" (İstanbul)
}

export interface SlotsResult {
  dateKey: string;
  durationMinutes: number;
  totalPrice: string;
  slots: SlotOption[];
}

/** Takip kodu + telefon sorgusunun salt okunur sonucu (yönetim yetkisi vermez). */
export interface AppointmentLookupResult {
  referenceCode: string;
  status: AppointmentStatus;
  startTime: string;
  endTime: string;
  staffName: string;
  services: string[];
  totalPrice: string;
}

export interface ManagedAppointmentView {
  id: string;
  referenceCode: string;
  status: AppointmentStatus;
  customerName: string;
  staffName: string;
  staffTitle: string;
  staffWorkingDays: number[];
  startTime: string;
  endTime: string;
  totalDurationMinutes: number;
  totalPrice: string;
  items: { serviceName: string; durationMinutes: number; unitPrice: string }[];
  canModify: boolean;
  modifyDeadline: string;
}
