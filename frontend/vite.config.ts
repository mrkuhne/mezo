/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // Extend the default precache globs (js/wasm/css/html) with ico/png/svg/woff2 so
        // the self-hosted brand fonts (public/fonts/*.woff2) are precached — the app
        // then renders Geist + Fraunces offline instead of falling back to system.
        globPatterns: ['**/*.{js,wasm,css,html,ico,png,svg,woff2}'],
        // The vendored exercise demo stills (public/exercises/*.jpg, ~15 MB, mezo-8xdl.2) must
        // NEVER enter the precache — the precache IS the install cost, and demo photos are not
        // install-critical. Belt and braces: `jpg` is absent from globPatterns above AND the
        // directory is ignored, so adding another extension there can't silently pull them in.
        globIgnores: ['**/exercises/**'],
        // They are cached on first view instead and kept — the files are content-addressed by
        // slug and only ever replaced wholesale by a re-import, so CacheFirst can't go stale.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/exercises/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'exercise-images',
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        // Web Push handlers live in their own plain file so the generateSW strategy stays
        // intact (switching to injectManifest would mean owning the whole worker for two
        // event listeners) — bd mezo-h4wp.6.1.
        importScripts: ['push-sw.js'],
        // Entry chunk outgrew the 2 MiB default precache limit (bd mezo-xkz6). Raised to
        // 3 MiB as an immediate unblock; proper follow-up is route-level code splitting
        // (manualChunks) to bring the entry chunk back under the default limit.
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      manifest: {
        name: 'Mezo',
        short_name: 'Mezo',
        description: 'Holistic AI performance & health companion',
        theme_color: '#FBF6EF',
        background_color: '#E6E1D8',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // Custom dev port — 5173 is taken by other local projects.
  server: { port: 5180 },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    exclude: [...configDefaults.exclude, 'tests/**'],
  },
})
