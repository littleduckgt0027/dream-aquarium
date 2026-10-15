import { defineConfig } from "vite";
export default defineConfig({
  root: "frontend",
  base: process.env.VITE_BASE || "/",
  build: { outDir: "../dist", emptyOutDir: true },
  server: { proxy: { "/api": "http://127.0.0.1:3000" } },
});
