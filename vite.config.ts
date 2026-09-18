import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// Release per Sentry: se non e' stata impostata a mano, si usa il commit da
// cui Vercel sta costruendo. Senza, ogni errore arriverebbe senza sapere quale
// deploy lo ha introdotto, che e' meta' dell'informazione utile (18/09/2026).
if (!process.env.VITE_APP_VERSION && process.env.VERCEL_GIT_COMMIT_SHA) {
  process.env.VITE_APP_VERSION = process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7);
}

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'pwa-64x64.png', 'pwa-192x192.png', 'pwa-512x512.png', 'maskable-icon-512x512.png', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Fantaschedina',
        short_name: 'Fantaschedina',
        description: 'Il fantasy football italiano con schedine, minigiochi e classifiche.',
        theme_color: '#0a0a0a',
        background_color: '#eef1f7',
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
        // Notifiche push: gestite dallo stesso SW della PWA (vedi public/push-sw.js).
        importScripts: ['push-sw.js'],
        globPatterns: ['**/*.{svg,png,woff2,ico}'],
        runtimeCaching: [
          {
            // I file in /assets hanno l'hash del contenuto nel nome: un URL
            // non cambia mai contenuto, quindi la cache non puo' essere stale.
            // Il nuovo codice arriva con il nuovo index.html (NetworkFirst
            // qui sotto), che punta a nomi nuovi. Le visite successive alla
            // prima non scaricano piu' nulla del bundle.
            urlPattern: ({ url }) => url.pathname.startsWith('/assets/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'app-assets',
              expiration: { maxAgeSeconds: 30 * 86400, maxEntries: 120 },
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
          // Le icone usate da piu' pagine finivano ognuna in un file da 300 B:
          // 35 richieste in piu' navigando l'app. Qui stanno in un chunk solo.
          'icons-vendor': ['lucide-react'],
          'firebase-app-vendor': ['firebase/app', 'firebase/app-check'],
          'firebase-auth-vendor': ['firebase/auth'],
          'firebase-firestore-vendor': ['firebase/firestore'],
          'firebase-functions-vendor': ['firebase/functions'],
          // Caricato solo quando l'utente attiva le notifiche (import dinamico).
          'firebase-messaging-vendor': ['firebase/messaging'],
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
