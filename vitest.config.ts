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
      // Conta tutti i file inclusi, anche quelli che nessun test importa.
      // Senza, la percentuale dipende da quali file un test tira dentro: il
      // primo test su `db.ts` ha fatto crollare la copertura per funzione dal
      // 78% al 61% pur avendo aggiunto copertura, perché quel file prima non
      // entrava nel denominatore. Un numero che si muove per motivi opposti a
      // quelli reali non serve a nessuno.
      all: true,
      exclude: [
        '**/__tests__/**',
        '**/*.d.ts',
        // Dati statici: sono tabelle di contenuti, non logica.
        'functions/src/quizData.ts',
        'src/lib/privacy.ts',
      ],
      // Soglie fissate al livello misurato il 20/08/2026: servono a impedire
      // regressioni, non a certificare che la copertura sia buona.
      //
      // `lines` resta basso perché questo è il conteggio dei soli test
      // unitari, e `functions/src/index.ts` (~2200 righe) è coperto dai test
      // di integrazione, che girano a parte contro l'emulatore Firestore
      // (`npm run test:integration`) e non contribuiscono a questo numero.
      // Branch e function sono alti perché la logica pura — scoring, quote,
      // economia, power-up, settlement, random, penalty, http — è coperta bene.
      //
      // Queste soglie si alzano, non si abbassano — con un'eccezione già
      // capitata: il 20/08/2026 `functions` è sceso da 78% a 61% *aggiungendo*
      // test. Il primo test su `db.ts` lo ha reso analizzabile (prima l'import
      // falliva senza mock di Firebase) e le sue ~20 funzioni sono entrate nel
      // denominatore. Righe e branch infatti sono salite. Abbassare la soglia
      // è lecito solo così: quando cambia cosa viene misurato, mai quando
      // peggiora quanto è coperto.
      // Ricalibrate il 22/08/2026 dopo i test su lib/markets.ts.
      thresholds: {
        lines: 21.7,
        functions: 64,
        branches: 86,
      },
    },
  },
});
