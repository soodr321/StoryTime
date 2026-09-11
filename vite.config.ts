/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: process.env.BASE_PATH ?? "/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["apple-touch-icon.png", "icon-192.png", "icon-512.png"],
      manifest: {
        name: "StoryTime",
        short_name: "StoryTime",
        description: "Nani reads the story. You read the magic words.",
        display: "standalone",
        orientation: "portrait",
        start_url: ".",
        scope: "./",
        background_color: "#fbf6ea",
        theme_color: "#fbf6ea",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
      workbox: {
        // App shell is precached. Library audio is cache-on-play with a small LRU so the
        // audio cache can never push the origin over iOS quota and evict IndexedDB.
        globPatterns: ["**/*.{js,css,html,png,svg,json,woff2}"],
        globIgnores: ["library/**", "prompts/**"],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => /\/(library|prompts|sounds)\/.*\.(m4a|mp3|wav|json)$/.test(url.pathname),
            handler: "CacheFirst",
            options: { cacheName: "storytime-audio-v3", expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
        ],
      },
    }),
  ],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
  },
});
