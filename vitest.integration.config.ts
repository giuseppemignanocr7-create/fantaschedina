import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Test di integrazione delle Cloud Functions contro l'emulatore Firestore.
 *
 * Separati dai test unitari (`vitest.config.ts`) perché richiedono un
 * emulatore in ascolto, e quindi Java: `npm run test:integration` lo avvia e
 * lo spegne da solo tramite `firebase emulators:exec`.
 *
 * Girano in serie e in un solo processo: condividono un unico database, e
 * parallelizzarli renderebbe i test dipendenti dall'ordine di esecuzione.
 */
export default defineConfig({
  resolve: {
    // Nessun alias su firebase-functions: qui si carica `functions/src/index.ts`
    // per intero, con i suoi sottopercorsi (v2/scheduler, v2/https, params...).
    // La risoluzione Node parte dal file importatore e trova da sola
    // functions/node_modules, dove il pacchetto è installato.
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['functions/src/__tests__/**/*.itest.ts'],
    setupFiles: ['./functions/src/__tests__/setup.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
