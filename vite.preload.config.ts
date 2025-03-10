import { defineConfig } from "vite";
import { builtinModules } from "node:module";

export default defineConfig({
  build: {
    sourcemap: true,
    // outDir: ".vite/preload", // Output directory set to .vite
    emptyOutDir: true,
    lib: {
      entry: "src/preload.ts",
      formats: ["cjs"],
    },
    rollupOptions: {
      external: ["electron", ...builtinModules],
      output: {
        entryFileNames: "[name].js",
      },
    },
  },
});