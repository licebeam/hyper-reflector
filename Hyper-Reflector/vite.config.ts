import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const isDev = mode === "development";
  const host = "127.0.0.1"; // <= pin to IPv4

  return {
    plugins: [react()],
    base: isDev ? "/" : "./",
    clearScreen: false,
    server: {
      port: 1420,
      strictPort: true,
      host, // <= important
      hmr: { protocol: "ws", host, port: 1421 },
      watch: { ignored: ["**/src-tauri/**"] }
    },
    build: {
      outDir: "dist",
      assetsDir: "assets",
      sourcemap: false
    }
  };
});