// vitest.config.ts
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** Bağımlılıksız .env okuyucu: testler yalnızca .env.test'teki izole veritabanını kullanır. */
function readEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const entries = readFileSync(path, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const i = line.indexOf("=");
      let value = line.slice(i + 1).trim();
      if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
      return [line.slice(0, i).trim(), value] as const;
    });
  return Object.fromEntries(entries);
}

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    env: { ...readEnvFile(".env.test"), NODE_ENV: "test", DISABLE_REDIS: "true" },
    fileParallelism: false, // Tek test DB'si; dosyalar arası yarış istemiyoruz
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
