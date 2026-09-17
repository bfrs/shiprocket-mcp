import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// A fixed 32-byte key so encrypted fixtures are deterministic across runs.
// Individual tests that exercise key handling override TOKEN_ENC_KEY themselves.
const TEST_TOKEN_ENC_KEY = Buffer.alloc(32, 7).toString("base64");

export default defineConfig({
  resolve: {
    // Mirror tsconfig "paths": "@/x" → "src/x"
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: {
      TOKEN_ENC_KEY: TEST_TOKEN_ENC_KEY,
      // Never let the test run pick up a developer's Redis by accident.
      REDIS_HOST: "",
    },
  },
});
