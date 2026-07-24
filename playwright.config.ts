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
      port: 8080,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: 'npm run dev',
      port: 3000,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: { VITE_USE_FIREBASE_EMULATORS: 'true' },
    },
  ],
});
