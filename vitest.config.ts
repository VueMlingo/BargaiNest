import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: [
      "node_modules/**",
      "dist/**",
      "checkpoints/**",
    ],
    hookTimeout: 30_000,
    setupFiles: ["./tests/setup-env.ts"],
  },
});
