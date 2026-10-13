// scripts/create-admin.ts
// Kullanım: npm run admin:create -- admin@ornek.com "Ad Soyad"
// Şifre ADMIN_PASSWORD ortam değişkeninden okunur; yoksa terminalden sorulur (en az 12 karakter).
import { createInterface } from "node:readline/promises";
import { hash } from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function askPassword(): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question("Yönetici şifresi (en az 12 karakter): ")).trim();
  } finally {
    rl.close();
  }
}

async function main() {
  const [rawEmail, name] = process.argv.slice(2);
  if (!rawEmail || !name) {
    console.error('Kullanım: npm run admin:create -- <email> "<Ad Soyad>"');
    process.exit(1);
  }
  const password = process.env.ADMIN_PASSWORD ?? (await askPassword());
  if (password.length < 12) {
    console.error("Şifre en az 12 karakter olmalıdır.");
    process.exit(1);
  }

  const email = rawEmail.trim().toLowerCase(); // Giriş şeması e-postayı küçük harfe çevirir
  const passwordHash = await hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: { name, passwordHash, role: "ADMIN" },
    create: { email, name, passwordHash, role: "ADMIN" },
  });
  console.log(`Yönetici hazır: ${user.email}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
