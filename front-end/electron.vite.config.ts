import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import { resolve } from "node:path";

const rendererRoot = resolve(__dirname, "src/renderer");

export default defineConfig({
  main: {
    build: {
      lib: {
        entry: resolve(__dirname, "src/main/index.ts"),
      },
    },
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    build: {
      // Sandboxed preloads must be CommonJS; ``package.json`` declares
      // ``"type": "module"`` so we force CJS + an explicit ``index.js``
      // filename here to override the default ``.mjs`` output.
      lib: {
        entry: resolve(__dirname, "src/preload/index.ts"),
        fileName: () => "index.js",
        formats: ["cjs"],
      },
      rollupOptions: {
        output: {
          entryFileNames: "index.js",
        },
      },
    },
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    build: {
      rollupOptions: {
        input: {
          index: resolve(rendererRoot, "index.html"),
        },
      },
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@app": resolve(rendererRoot, "app"),
        "@features": resolve(rendererRoot, "features"),
        "@shared": resolve(rendererRoot, "shared"),
        "@styles": resolve(rendererRoot, "shared/styles"),
      },
    },
    root: rendererRoot,
  },
});
