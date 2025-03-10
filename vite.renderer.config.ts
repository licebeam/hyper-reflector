import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    sourcemap: true,
    // outDir: ".vite/renderer", // Output directory set to .vite
    emptyOutDir: true,
  },
});