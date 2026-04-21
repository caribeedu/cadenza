import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

const rendererRoot = resolve(__dirname, "src/renderer");

// Vitest shares Vite's resolver with the renderer build, so tests can
// import components using the same `@shared/...` aliases as production
// code. The `node` environment is the default; individual test files
// opt into `jsdom` with the `// @vitest-environment jsdom` pragma when
// they need DOM/React APIs, so pure-lib tests don't pay the jsdom boot
// cost.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@app": resolve(rendererRoot, "app"),
      "@features": resolve(rendererRoot, "features"),
      "@shared": resolve(rendererRoot, "shared"),
      "@styles": resolve(rendererRoot, "shared/styles"),
    },
  },
  test: {
    css: false,
    environment: "node",
    globals: true,
    include: ["src/**/*.{test,spec}.{ts,tsx,js,jsx,mjs}"],
    setupFiles: ["./vitest.setup.ts"],
  },
});
