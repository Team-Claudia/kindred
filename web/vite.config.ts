import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  // .env.local sits at the repo root, so .worktreeinclude copies it into new worktrees.
  envDir: '..',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Kindred',
        short_name: 'Kindred',
        description: 'Coordinate care with your family.',
        lang: 'en-CA',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#fbf8f1',
        theme_color: '#fbf8f1',
        // Placeholder icons from scripts/generate-icons.mjs; swap in the brand later.
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache the Nunito font (Latin subsets), so the installed app keeps
        // its typeface offline.
        globPatterns: ['**/*.{js,css,html}', '**/nunito-latin*.woff2'],
        // The calendar feed is served by Supabase, not the app shell.
        navigateFallbackDenylist: [/^\/cal\//],
        // Push and notification-tap handlers (task 1.4), served from public/.
        importScripts: ['push-sw.js'],
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
