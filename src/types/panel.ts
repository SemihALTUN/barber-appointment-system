// src/types/panel.ts
import type { AppointmentStatus, BlockType } from "@prisma/client";

export interface PanelAppointment {
  id: string;
  referenceCode: string;
  status: AppointmentStatus;
  customerName: string;
  customerPhone: string;
  startTime: string;
  endTime: string;
  totalDurationMinutes: number;
  totalPrice: string;
  notes: string | null;
  services: string[];
  noShowCount: number;
}

export interface PanelTimeBlock {
  id: string;
  startTime: string;
  endTime: string;
  type: BlockType;
  reason: string | null;
}

export interface PanelDaySchedule {
  staffId: string;
  staffName: string;
  dateKey: string;
  shifts: { startTime: string; endTime: string }[];
  appointments: PanelAppointment[];
  timeBlocks: PanelTimeBlock[];
}

export interface PanelStaffOption {
  id: string;
  name: string;
}
