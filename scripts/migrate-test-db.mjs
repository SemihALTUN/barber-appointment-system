// scripts/migrate-test-db.mjs — Migration'ları .env.test'teki test veritabanına uygular
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

if (!existsSync(".env.test")) {
  console.error(".env.test bulunamadı. Örnek: DATABASE_URL=postgresql://.../barber_test_db");
  process.exit(1);
}

const env = { ...process.env };
for (const raw of readFileSync(".env.test", "utf8").split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || line.startsWith("#") || !line.includes("=")) continue;
  const i = line.indexOf("=");
  let value = line.slice(i + 1).trim();
  if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
  env[line.slice(0, i).trim()] = value;
}

const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  env,
  shell: process.platform === "win32",
});
process.exit(result.status ?? 1);
