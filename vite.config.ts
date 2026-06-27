import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

export default defineConfig({
  base: "/webgame/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "戦将 SenSho",
        short_name: "戦将",
        description: "将軍を直接操作するスマホ専用RTS",
        theme_color: "#0f172a",
        background_color: "#0f172a",
        display: "fullscreen",
        orientation: "portrait",
        start_url: "/webgame/",
        scope: "/webgame/",
        icons: [
          {
            src: "icon-192.svg",
            sizes: "192x192",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
          {
            src: "icon-512.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    host: true,
  },
});
