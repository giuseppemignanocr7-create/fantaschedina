// Rigenera le quote della giornata aperta chiamando la callable amministrativa
// con forceOdds, poi controlla che nessuna partita resti con quote calcolate.
import { readFileSync } from 'node:fs';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const PROGETTO = 'fantaschedina-4a1b2';
const REGIONE = 'europe-west1';

const env = readFileSync('../.env', 'utf8');
const apiKey = env.match(/VITE_FIREBASE_API_KEY=(.+)/)?.[1]?.trim();
if (!apiKey) throw new Error('VITE_FIREBASE_API_KEY non trovata in .env');

initializeApp({ credential: applicationDefault(), projectId: PROGETTO });
const db = getFirestore();

const admin = await db.collection('profiles').where('role', '==', 'admin').limit(1).get();
if (admin.empty) throw new Error('nessun profilo amministratore');
const adminUid = admin.docs[0].id;
console.log('amministratore:', admin.docs[0].data().username, `(${adminUid})`);

const custom = await getAuth().createCustomToken(adminUid);
const scambio = await fetch(
  `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: custom, returnSecureToken: true }),
  }
);
const sessione = await scambio.json();
if (!sessione.idToken) throw new Error('accesso fallito: ' + JSON.stringify(sessione).slice(0, 200));

const chiamata = await fetch(
  `https://${REGIONE}-${PROGETTO}.cloudfunctions.net/adminSyncMatchday`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessione.idToken}`,
    },
    body: JSON.stringify({ data: { forceOdds: true } }),
  }
);
console.log('adminSyncMatchday →', chiamata.status);
console.log(JSON.stringify(await chiamata.json()).slice(0, 300));

// Verifica: margine di ogni partita della giornata corrente
const meta = await db.collection('matchdays').doc('_meta').get();
const n = meta.data()?.currentNumber;
const md = (await db.collection('matchdays').doc(String(n)).get()).data();
console.log(`\ngiornata ${n}: verifica delle quote`);
let calcolate = 0;
for (const m of md.matches ?? []) {
  const o = md.odds?.[m.id]?.esito;
  if (!o) { console.log(`  ${m.homeTeam.name}-${m.awayTeam.name}: NESSUNA QUOTA`); continue; }
  const margine = (1 / o['1'] + 1 / o.X + 1 / o['2']) * 100;
  const finte = margine < 100;
  if (finte) calcolate++;
  console.log(`  ${finte ? 'CALCOLATE' : 'reali    '} ${m.homeTeam.name}-${m.awayTeam.name}: 1=${o['1']} X=${o.X} 2=${o['2']} (${margine.toFixed(1)}%)`);
}
console.log(`\npartite con quote calcolate: ${calcolate}/${(md.matches ?? []).length}`);
console.log('agenzie salvate:', Object.keys(md.oddsPerBookmaker ?? {}).join(', ') || 'nessuna');
process.exit(0);
