import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/support/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    env: { ...loadEnv("test", process.cwd(), ""), MAIL_SANDBOX_DIR: ".data/test-mail-sandbox", APP_ENV: "test" },
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 60000,
    fileParallelism: false,
    coverage: { provider: "v8", include: ["src/lib/**"], reporter: ["text", "html"] },
  },
});
