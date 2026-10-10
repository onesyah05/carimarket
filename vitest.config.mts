import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Pengujian unit untuk logika murni (tanpa MySQL dan tanpa panggilan Threads).
 * Alias `@/` mengikuti tsconfig agar impor di sumber dan pengujian sama.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` hanya tersedia dalam runtime Next; saat pengujian
      // impornya dipetakan ke modul kosong.
      "server-only": fileURLToPath(new URL("./src/test/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
