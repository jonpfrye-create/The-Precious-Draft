import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Next resolves the "@/..." alias from tsconfig, but Vitest doesn't read
// tsconfig paths on its own. Without this, any test whose subject imports
// "@/..." fails to load - and a suite that fails to *load* still reports
// the run as passing, just with fewer tests, which is a bad way to lose
// coverage.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
