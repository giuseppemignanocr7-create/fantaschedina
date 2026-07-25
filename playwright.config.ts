import { defineConfig, devices } from '@playwright/test';

/**
 * E2E contro gli emulatori Firebase (auth + firestore), mai contro il
 * progetto reale: playwright.config avvia sia gli emulatori sia il dev
 * server con VITE_USE_FIREBASE_EMULATORS=true (vedi src/lib/firebase.ts).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  // Su CI il primo test paga la compilazione a richiesta di Vite (dev server
  // a freddo su runner condivisi lenti): il timeout di default (30s) basta
  // in locale ma non sempre lì, specialmente sul primissimo page.goto.
  timeout: process.env.CI ? 90_000 : 30_000,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: [
    {
      command: 'npx firebase emulators:start --only auth,firestore --project fantaschedina-4a1b2',
      // L'emulatore Auth (9099) è pronto dopo Firestore (8080): controllare
      // Firestore da solo crea una race condition in cui il primo test che
      // chiama signIn/signUp riceve ERR_CONNECTION_REFUSED su Auth.
      port: 9099,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'npm run dev',
      port: 3000,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      // Valori fittizi ma con lo stesso projectId dell'emulatore: firebase.ts
      // richiede queste variabili per inizializzarsi (vedi assertConfig), ma
      // dato che tutto passa per gli emulatori locali non serve un progetto
      // reale. Sovrascrivono di proposito eventuali .env/.env.local locali,
      // così i test E2E restano isolati dal progetto Firebase reale.
      env: {
        VITE_USE_FIREBASE_EMULATORS: 'true',
        VITE_FIREBASE_API_KEY: 'demo-e2e-api-key',
        VITE_FIREBASE_AUTH_DOMAIN: 'fantaschedina-4a1b2.firebaseapp.com',
        VITE_FIREBASE_PROJECT_ID: 'fantaschedina-4a1b2',
        VITE_FIREBASE_STORAGE_BUCKET: 'fantaschedina-4a1b2.appspot.com',
        VITE_FIREBASE_MESSAGING_SENDER_ID: '000000000000',
        VITE_FIREBASE_APP_ID: '1:000000000000:web:0000000000000000000000',
      },
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});
