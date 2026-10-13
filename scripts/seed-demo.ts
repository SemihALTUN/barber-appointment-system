// scripts/seed-demo.ts — Denemek için örnek hizmet, personel ve vardiyalar (tekrar çalıştırmak güvenlidir)
// Hizmet süreleri randevu aralığının (30 dk) katlarıdır; aksi hâlde randevu sonrası kısa boşluklar kalır.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SERVICES = [
  { name: "Saç Kesimi", description: "Yıkama ve şekillendirme dahil", durationMinutes: 30, price: 400 },
  { name: "Sakal Tıraşı", description: "Sıcak havlu ile ustura tıraşı", durationMinutes: 30, price: 200 },
  { name: "Saç + Sakal", description: "Saç kesimi ve sakal düzeltme", durationMinutes: 60, price: 550 },
  { name: "Çocuk Saç Kesimi", description: "12 yaş altı", durationMinutes: 30, price: 300 },
  { name: "Cilt Bakımı", description: "Temizleme ve maske", durationMinutes: 30, price: 450 },
];

const STAFF = [
  {
    name: "Mehmet Usta",
    title: "Usta Berber",
    bio: "20 yıllık deneyim, klasik kesim ve ustura tıraşı.",
    services: SERVICES.map((s) => s.name),
    shifts: [1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ dayOfWeek, startTime: "09:00", endTime: "19:00" })),
  },
  {
    name: "Can Yılmaz",
    title: "Kıdemli Stilist",
    bio: "Modern kesimler ve cilt bakımı.",
    services: ["Saç Kesimi", "Saç + Sakal", "Cilt Bakımı"],
    shifts: [0, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ dayOfWeek, startTime: "11:00", endTime: "21:00" })),
  },
];

async function main() {
  if ((await prisma.service.count()) > 0) {
    console.log("Veritabanında zaten hizmet var; demo verisi eklenmedi.");
    return;
  }

  const services = await Promise.all(SERVICES.map((data) => prisma.service.create({ data })));
  const byName = new Map(services.map((s) => [s.name, s.id]));

  for (const member of STAFF) {
    await prisma.user.create({
      data: {
        name: member.name,
        role: "STAFF",
        staffProfile: {
          create: {
            title: member.title,
            bio: member.bio,
            services: { create: member.services.map((n) => ({ serviceId: byName.get(n)! })) },
            shifts: { create: member.shifts },
          },
        },
      },
    });
  }

  console.log(`Demo verisi eklendi: ${services.length} hizmet, ${STAFF.length} personel.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
