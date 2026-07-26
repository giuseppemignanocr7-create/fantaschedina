#!/usr/bin/env node
// ============================================
// BUDGET DI DIMENSIONE DEL BUNDLE
//
// Le regressioni di peso non si notano una alla volta: si accumulano finché
// l'app non è lenta sul 4G di un telefono medio. Questo controllo le rende
// visibili subito, al momento in cui vengono introdotte.
//
// I budget sono sul contenuto compresso (gzip): è quello che viaggia in rete.
// Vanno abbassati quando si ottimizza, alzati solo con una ragione scritta.
// ============================================

import { readdir, readFile, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const ASSETS_DIR = 'dist/assets';

/**
 * Budget in KB gzip, calibrati sulla build del 26/07/2026 con circa il 5%
 * di margine. La chiave è il prefisso del nome del chunk.
 *
 * `firebase-firestore-vendor` è il chunk più pesante e non è comprimibile
 * oltre: l'SDK modulare include persistenza offline, listener realtime e
 * transazioni. È il pavimento della libreria, non uno spreco nostro.
 */
const BUDGETS = {
  'index-': 45,
  'react-vendor-': 62,
  'firebase-firestore-vendor-': 152,
  'firebase-auth-vendor-': 28,
  'firebase-app-vendor-': 6,
  'firebase-functions-vendor-': 6,
  'sentry-vendor-': 32,
};

/**
 * Tetto complessivo su tutto il JS prodotto, in KB gzip.
 * Misurato: 386 KB con Sentry attivo, 357 KB senza.
 */
const TOTAL_JS_BUDGET = 405;

const KB = 1024;

async function main() {
  let files;
  try {
    files = await readdir(ASSETS_DIR);
  } catch {
    console.error(`✗ ${ASSETS_DIR} non trovato: esegui prima "npm run build".`);
    process.exit(1);
  }

  const jsFiles = files.filter(f => f.endsWith('.js'));
  if (jsFiles.length === 0) {
    console.error('✗ Nessun file JS prodotto dalla build.');
    process.exit(1);
  }

  const rows = [];
  let totalGzip = 0;

  for (const file of jsFiles) {
    const path = join(ASSETS_DIR, file);
    const { size: raw } = await stat(path);
    const gzip = gzipSync(await readFile(path)).length;
    totalGzip += gzip;

    const budgetKey = Object.keys(BUDGETS).find(k => file.startsWith(k));
    const budget = budgetKey ? BUDGETS[budgetKey] : null;

    rows.push({
      file,
      rawKB: raw / KB,
      gzipKB: gzip / KB,
      budget,
      over: budget !== null && gzip / KB > budget,
    });
  }

  rows.sort((a, b) => b.gzipKB - a.gzipKB);

  console.log('\nDimensione dei chunk (gzip)\n');
  for (const r of rows) {
    const budgetLabel = r.budget === null ? '—' : `${r.budget} KB`;
    const mark = r.over ? '✗' : ' ';
    console.log(
      `${mark} ${r.file.padEnd(44)} ${r.gzipKB.toFixed(1).padStart(7)} KB   budget ${budgetLabel}`
    );
  }

  const totalKB = totalGzip / KB;
  console.log(`\n  Totale JS: ${totalKB.toFixed(1)} KB gzip (budget ${TOTAL_JS_BUDGET} KB)\n`);

  const violations = rows.filter(r => r.over);
  if (violations.length > 0) {
    console.error('✗ Budget superato:');
    for (const v of violations) {
      console.error(
        `  ${v.file}: ${v.gzipKB.toFixed(1)} KB > ${v.budget} KB (+${(v.gzipKB - v.budget).toFixed(1)} KB)`
      );
    }
    console.error(
      '\nSe la crescita è giustificata, alza il budget in scripts/check-bundle-size.mjs\n' +
        'spiegando il perché nel messaggio di commit.\n'
    );
    process.exit(1);
  }

  if (totalKB > TOTAL_JS_BUDGET) {
    console.error(
      `✗ Totale JS ${totalKB.toFixed(1)} KB oltre il budget di ${TOTAL_JS_BUDGET} KB.\n`
    );
    process.exit(1);
  }

  console.log('✓ Tutti i budget rispettati.\n');
}

main().catch(err => {
  console.error('✗ Controllo fallito:', err);
  process.exit(1);
});
