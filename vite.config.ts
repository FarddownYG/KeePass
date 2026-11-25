import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

const stub = fileURLToPath(new URL('./src/stubs/empty.ts', import.meta.url))

// Node-only optional deps of kdbxweb are stubbed in the browser bundle (WebCrypto + native DOMParser are used).
function aliases(mode: string): Record<string, string> {
  return mode === 'test' ? { '@xmldom/xmldom': stub } : { crypto: stub, '@xmldom/xmldom': stub }
}

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script', // external /registerSW.js — no inline script (CSP)
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Keyhold',
        short_name: 'Keyhold',
        description: 'Gestionnaire de mots de passe KeePass (KDBX 4), chiffré dans le navigateur.',
        lang: 'fr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#f7f7f5',
        theme_color: '#1f6f5c',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json,webmanifest}'],
        navigateFallback: '/index.html',
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        // Never cache third-party responses (HIBP must stay live, in-memory only).
        runtimeCaching: [],
      },
    }),
  ],
  resolve: {
    alias: aliases(mode),
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    modulePreload: { polyfill: false },
  },
  worker: { format: 'es' },
  test: {
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    testTimeout: 60_000,
  },
}))
