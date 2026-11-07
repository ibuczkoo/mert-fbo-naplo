import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "MERT FBŐ napló",
        short_name: "FBŐ napló",
        description: "Fegyveres biztonsági őrség szolgálati naplói",
        lang: "hu",
        theme_color: "#1f3a5f",
        background_color: "#f6f7f9",
        display: "standalone",
        start_url: "/",
        icons: [{ src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }],
      },
      workbox: {
        // Az alkalmazás-keret offline is betölt; az API-hívásokat a saját szinkronsor kezeli, nem a cache.
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
      },
    }),
  ],
  server: {
    proxy: { "/api": "http://127.0.0.1:3000" },
  },
});
