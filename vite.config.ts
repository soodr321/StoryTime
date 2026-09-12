/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { mkdirSync, writeFileSync } from "node:fs";

/**
 * Dev only: the recording screen posts each raw take straight into assets/voice-pack/, so the
 * family's voice becomes a build asset like the Commons originals — pinned, re-processable, and
 * shipped to every device. Nothing like this exists in the production build.
 */
const voicePack = () => ({
  name: "voice-pack",
  apply: "serve" as const,
  configureServer(server: { middlewares: { use: (fn: (req: { url?: string; method?: string; on: (e: string, f: (c?: Buffer) => void) => void }, res: { statusCode: number; end: (s?: string) => void }, next: () => void) => void) => void } }) {
    server.middlewares.use((req, res, next) => {
      const m = req.url?.match(/^\/__voice\/([a-z]{1,3})(?:\?|$)/);
      if (!m || req.method !== "PUT") return next();
      const chunks: Buffer[] = [];
      req.on("data", (c?: Buffer) => c && chunks.push(c));
      req.on("end", () => {
        try {
          mkdirSync("assets/voice-pack", { recursive: true });
          writeFileSync(`assets/voice-pack/${m[1]}.webm`, Buffer.concat(chunks));
          res.statusCode = 204; res.end();
        } catch (e) { res.statusCode = 500; res.end(String(e)); }
      });
    });
  },
});

export default defineConfig({
  base: process.env.BASE_PATH ?? "/",
  plugins: [
    voicePack(),
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
        globIgnores: ["library/**", "prompts/**", "blends/**"],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => /\/(library|prompts|sounds|blends)\/.*\.(m4a|mp3|wav|json)$/.test(url.pathname),
            handler: "CacheFirst",
            options: { cacheName: "storytime-audio-v5", expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 } },
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
