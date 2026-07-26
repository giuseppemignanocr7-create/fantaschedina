import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // `firebase-functions` è installato solo in functions/node_modules.
      // Senza questo alias i test e il codice sotto test caricherebbero due
      // istanze diverse del modulo e i mock non intercetterebbero nulla.
      'firebase-functions/v2': path.resolve(
        __dirname,
        './functions/node_modules/firebase-functions/lib/v2/index.js'
      ),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'json-summary', 'html'],
      include: ['src/lib/**/*.ts', 'functions/src/**/*.ts'],
      exclude: [
        '**/__tests__/**',
        '**/*.d.ts',
        // Dati statici: sono tabelle di contenuti, non logica.
        'functions/src/quizData.ts',
        'src/lib/privacy.ts',
      ],
      // Soglie fissate al livello misurato il 26/07/2026: servono a impedire
      // regressioni, non a certificare che la copertura sia buona.
      //
      // Il valore di `lines` è basso perché `functions/src/index.ts` (~2000
      // righe: settlement, economia, callable) non ha ancora test: richiede
      // l'emulatore Firestore. È il prossimo intervento prioritario.
      // Branch e function sono alti perché la logica pura — scoring, quote,
      // economia, random, penalty, http — è coperta bene.
      //
      // Queste soglie si alzano, non si abbassano.
      thresholds: {
        lines: 19,
        functions: 74,
        branches: 80,
      },
    },
  },
});
