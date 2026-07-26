import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon.ico', 'pwa-64x64.png', 'pwa-192x192.png', 'pwa-512x512.png', 'maskable-icon-512x512.png', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Fantaschedina',
        short_name: 'Fantaschedina',
        description: 'Il fantasy football italiano con schedine, minigiochi e classifiche.',
        theme_color: '#0a0a0a',
        background_color: '#0a0a0a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        id: '/',
        categories: ['sports', 'games'],
        icons: [
          {
            src: 'pwa-64x64.png',
            sizes: '64x64',
            type: 'image/png',
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ['**/*.{svg,png,woff2,ico}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.endsWith('.js') || url.pathname.endsWith('.css'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'app-bundles',
              expiration: { maxAgeSeconds: 86400, maxEntries: 60 },
            },
          },
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'app-html',
              expiration: { maxAgeSeconds: 300 },
            },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://site.api.espn.com',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'espn-api',
              expiration: { maxAgeSeconds: 300 },
            },
          },
          {
            urlPattern: ({ url }) => url.origin.includes('googleusercontent'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'team-logos',
              expiration: { maxAgeSeconds: 86400, maxEntries: 100 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // firestore's modular SDK alone minifies to ~570kB (offline persistence, realtime
    // listeners, transactions) - that's its real floor, not something manualChunks can shrink.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'firebase-app-vendor': ['firebase/app', 'firebase/app-check'],
          'firebase-auth-vendor': ['firebase/auth'],
          'firebase-firestore-vendor': ['firebase/firestore'],
          'firebase-functions-vendor': ['firebase/functions'],
          // Incluso solo se VITE_SENTRY_DSN è configurata: senza, il ramo che
          // chiama Sentry.init() è irraggiungibile e rollup lo elimina.
          // Chunk a parte perché cambia molto meno spesso del codice dell'app.
          'sentry-vendor': ['@sentry/react'],
        },
      },
    },
  },
  server: {
    port: 3000,
    open: true
  }
})
