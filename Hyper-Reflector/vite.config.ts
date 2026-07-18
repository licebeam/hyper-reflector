import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import pkg from "./package.json";

export default defineConfig(({ mode }) => {
  const isDev = mode === "development";
  const host = "127.0.0.1";

  return {
    plugins: [react(), tailwindcss()],
    base: isDev ? "/" : "./",
    clearScreen: false,
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    server: {
      port: 1420,
      strictPort: true,
      host,
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