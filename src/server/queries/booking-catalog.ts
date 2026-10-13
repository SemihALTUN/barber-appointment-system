// src/server/queries/booking-catalog.ts
import "server-only";
import { prisma } from "@/lib/prisma";
import type { BookingCatalog } from "@/types/booking";

export async function getBookingCatalog(): Promise<BookingCatalog> {
  const [services, staff] = await Promise.all([
    prisma.service.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, description: true, durationMinutes: true, price: true },
    }),
    prisma.staff.findMany({
      where: { isActive: true },
      orderBy: { user: { name: "asc" } },
      select: {
        id: true,
        title: true,
        bio: true,
        user: { select: { name: true } },
        services: { where: { service: { isActive: true } }, select: { serviceId: true } },
        shifts: { select: { dayOfWeek: true } },
      },
    }),
  ]);

  return {
    services: services.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      durationMinutes: s.durationMinutes,
      price: s.price.toFixed(2),
    })),
    staff: staff.map((s) => ({
      id: s.id,
      name: s.user.name,
      title: s.title,
      bio: s.bio,
      serviceIds: s.services.map((x) => x.serviceId),
      workingDays: [...new Set(s.shifts.map((x) => x.dayOfWeek))].sort(),
    })),
  };
}
