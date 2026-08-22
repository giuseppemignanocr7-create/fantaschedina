# Fantaschedina ⚽🪙

Gioco di pronostici Serie A multi-utente: schedine settimanali, classifica condivisa, premi, **minigiochi che fanno guadagnare gettoni** e **power-up** spendibili sulla schedina.

Stack: **React 18 + Vite + TypeScript + Tailwind + Zustand** (client), **Firebase Auth + Firestore + Cloud Functions** (backend sicuro), dati partite **ESPN public API**.

---

## Architettura di sicurezza (importante)

Tutta la logica che tocca **punti e gettoni** gira server-side su Cloud Functions:

| Azione | Dove gira | Perché |
|---|---|---|
| Invio schedina | callable `submitSchedina` | valida deadline, sostituisce le quote con quelle ufficiali, addebita i power-up, e verifica l'appartenenza alla lega per le schedine di lega |
| Settlement giornata | scheduled `settleMatchdays` (ogni ora) | valuta le schedine, aggiorna punti/profili in transaction, assegna premi |
| Sync giornata + quote | scheduled `syncMatchday` (ogni 6h) | le quote sono generate SOLO server-side |
| Minigiochi | callable `playMinigame` | esiti estratti dal server, cooldown 1/giorno su Firestore |
| Missioni | callable `claimMission` | verifica progressi dal profilo, accredita gettoni |
| Premi settimanali | callable `adminManageWeeklyPrizes` | l'admin decide cosa si vince in una giornata; il settlement li assegna al podio |
| Classifica | callable `getRankings` | calcolata una volta sola dal server, anche per lega: il client non scarica più tutti i profili |
| Pulizia duelli | scheduled `cleanupPenaltyDuels` (ogni ora) | chiude le sfide ferme e cancella quelle mai iniziate |
| Cambio Last-Minute | callable `changePrediction` | addebita 100 gettoni, consuma il power-up e cambia 1 pronostico dopo la deadline, solo su partite non iniziate |

Le **Firestore Rules** (`firestore.rules`) bloccano ogni scrittura client su punti, gettoni, schedine e giornate. Le schedine altrui sono leggibili **solo dopo la deadline** (anti-copia).

## Come si fanno i punti

I punti di una schedina sono la **somma delle quote indovinate, moltiplicata
per 10**: una giocata a 2.00 vale 20 punti, dieci giocate a 2.00 ne valgono
200. Ogni quota è cappata a 5.00 (quindi max 50 punti a giocata) e le quote
sotto 1.30 non sono valide. Chi indovina 9 pronostici su 10 prende **+5
punti**, chi li indovina tutti e 10 **+10 punti**. I punti si sommano giornata
dopo giornata in classifica generale.

I punti sono una cosa, i **gettoni** un'altra: i primi fanno la classifica, i
secondi si spendono in power-up e si guadagnano coi minigiochi.

## Due circuiti: generale e leghe

Ogni giornata un utente compila **una schedina per la classifica generale** e
**una per ogni lega** di cui fa parte: stesse partite, stessa deadline, punti
separati.

| | Circuito generale | Leghe |
|---|---|---|
| Documento | `schedine/{uid}_{giornata}` | `schedine/{uid}_{giornata}_{lega}` |
| Dove finiscono i punti | profilo (`totalPoints`) | `leagues/{lega}/standings/{uid}` |
| Gettoni dai pronostici | sì | no |
| Statistiche e missioni | sì | no |
| Power-up | sì, a pagamento | sì, si pagano su ogni schedina |
| Premio di giornata | 100 gettoni al migliore | solo la vittoria in classifica di lega |

I gettoni si guadagnano quindi solo dal circuito generale e dai minigiochi,
mentre le leghe li consumano: è una scelta di bilanciamento, non un effetto
collaterale. In schedina un pulsante **copia dalla schedina generale** evita di
ricompilare dieci pronostici per ogni lega.

## Economia di gioco 🪙

**Guadagni gettoni con:**

| Fonte | Premio | Limite |
|---|---|---|
| Quiz Calcio | +3 a risposta esatta (max 10 domande) | 1 partita al giorno |
| Ruota giornaliera | 5–100 a caso su 8 spicchi | 1 giro al giorno |
| Rigori | +2 a gol (5 tiri) | 50 gettoni al giorno |
| Memoria Calcio | +5 a livello, +1 ogni 5 secondi risparmiati | 40 gettoni al giorno |
| Duelli rigori 1v1 | 50 a vittoria, 25 a pareggio | 150 gettoni al giorno |
| Sfide 1vs1 | 5–30 secondo la prestazione | una per avversario a settimana |
| Missioni | 50–500 una tantum | una volta per missione |
| Schedina | +2 gettoni a pronostico esatto, +50 con 9/10, +150 con 10/10, +100 al vincitore di giornata | per giornata |

I valori vivono in `functions/src/config.ts` e sono verificati dai test: se
cambi quelli, questa tabella va aggiornata a mano.

**Li spendi in power-up sulla schedina:**
- 🃏 **Jolly Raddoppio** (200) — raddoppia i punti di 1 pronostico
- 🛡️ **Scudo** (150) — annulla le penalità quote basse
- ⭐ **Assicurazione** (120) — con 8/10 ricevi il bonus del 9/10
- 🔄 **Cambio Last-Minute** (100) — dopo la deadline cambia 1 pronostico, una volta sola per schedina e solo su una partita non ancora iniziata (prima della deadline la schedina si modifica gratis)

Config centralizzata in `functions/src/config.ts` (server, fonte di verità) e `src/lib/economy.ts` (client, mirror).

---

## Setup

### 1. Dipendenze
```bash
npm install
npm --prefix functions install
```

### 2. Progetto Firebase (piano Blaze richiesto per le Functions)
1. https://console.firebase.google.com → **Add project**
2. **Authentication → Email/Password → Enable**
3. **Firestore Database → Create database** (production mode, regione `eur3`)
4. **Upgrade → piano Blaze** (le Functions schedulate lo richiedono; free tier generoso)
5. **Project settings → Your apps → Web** → copia `firebaseConfig`

### 3. Variabili d'ambiente
```bash
cp .env.example .env   # compila con i valori del firebaseConfig
```

### 4. Collega il progetto e deploya backend
```bash
npm i -g firebase-tools
firebase login
# Sostituisci il project id in .firebaserc, poi:
firebase deploy --only firestore:rules,firestore:indexes
firebase deploy --only functions
```

### 4b. Quote reali (opzionale, gratuito)

Le quote sono generate algoritmicamente di default. Per usare **quote reali da bookmaker europei** via [The Odds API](https://the-odds-api.com) (500 crediti/mese gratis, nessuna carta):

```bash
# 1. Registrati su the-odds-api.com → ottieni una API key gratuita
# 2. Imposta la secret su Firebase
firebase functions:secrets:set ODDS_API_KEY
# 3. Ridistribuisci le functions (obbligatorio a ogni cambio di secret)
firebase deploy --only functions
```

> Il secret è dichiarato con `defineSecret` e collegato a `syncMatchday` e
> `adminSyncMatchday`. Le function v2 ricevono i secret **solo** se elencati
> nelle loro opzioni: senza, `process.env` resta vuoto e il sistema ricade
> silenziosamente sulle quote algoritmiche.

Se la key non è impostata o l'API non risponde, il sistema usa automaticamente l'engine algoritmico come fallback. Mercati coperti da quote reali: `esito`, `over_under`, `goal_nogoal`, `doppia_chance` (derivata). Mercati algoritmici: `multigoal`, `esito_1t`, `over_under_1t`, `goal_nogoal_1t`.

### 5. Seed domande quiz
```bash
# Scarica il service account JSON: Console → Project settings → Service accounts
set GOOGLE_APPLICATION_CREDENTIALS=C:\path\serviceAccount.json
npm run seed:quiz
```

### 6. Avvio
```bash
npm run dev       # sviluppo
npm run check     # tsc + eslint + vitest
npm run build     # produzione
```

---

## Struttura dati Firestore

| Collection | Doc ID | Scrittura | Contenuto |
|---|---|---|---|
| `profiles` | `{uid}` | Functions (client: solo username/avatar) | punti, gettoni, statistiche, missioni riscosse |
| `matchdays` | `{number}`, `_meta` | Solo Functions | partite, risultati (anche HT), quote ufficiali, deadline |
| `schedine` | `{uid}_{matchday}` o `{uid}_{matchday}_{lega}` | Solo Functions | pronostici, power-up, risultati valutati |
| `leagues` | auto | Client (rules vincolate) | leghe private, codici invito, membri |
| `leagues/{id}/standings` | `{uid}` | Solo Functions | classifica di lega, alimentata dalle schedine di lega |
| `wallet_transactions` | auto | Solo Functions | audit trail gettoni |
| `prizes` | `weekly_{n}`, … | Solo Functions | albo d'oro: podio di giornata e premio assegnato |
| `weekly_prizes` | `{matchday}` | Solo Functions (admin) | premi in palio per una giornata |
| `quiz_questions` | `q001…` | Seed script | pool domande quiz |
| `quiz_sessions` | `{uid}` | Solo Functions | sessione quiz anti-cheat |

## Flusso settlement (automatico)

1. `syncMatchday` (ogni 6h) crea la prossima giornata con quote server-side
2. Gli utenti inviano la schedina via `submitSchedina` (deadline enforced)
3. `settleMatchdays` (ogni ora, post-deadline) legge i risultati ESPN
4. Quando tutte le partite sono finite: valuta le schedine (multi-mercato: 1X2, O/U, GG/NG, DC, multigoal, 1° tempo), applica i power-up, aggiorna profili in transaction, assegna premi (vincitore, quota più alta, poker), accredita gettoni e resetta `weeklyPoints` dei non-giocanti

## Test e verifiche

```bash
npm test                 # test unitari (logica pura)
npm run test:coverage    # con soglie di copertura
npm run check            # typecheck + lint (0 warning) + test + coverage
npm run check:bundle     # budget di dimensione (richiede build)
npm run audit:prod       # CVE sulle sole dipendenze di produzione
npm run test:integration # callable contro l'emulatore Firestore (richiede Java)
npm run test:e2e         # Playwright contro gli emulatori Firebase
```

Coperti dai test unitari: scoring client e server, motore quote, economia,
classifiche, sorgente casuale, motore rigori, client HTTP resiliente,
contabilità dei power-up.

Coperti dai test di integrazione (`functions/src/__tests__/*.itest.ts`):
invio e reinvio della schedina con addebito/rimborso dei power-up,
annullamento, Cambio Last-Minute, settlement di giornata, duelli con tetto
giornaliero e pulizia, minigiochi, classifica generale e di lega. Girano
contro un Firestore vero perché transazioni e idempotenza non si verificano
con dei mock.

**Non ancora coperto:** leghe (`manageLeague`), missioni (`claimMission`),
quiz e cancellazione account.

### Emulatore su Windows

Se l'emulatore Firestore non parte con `Unable to establish loopback
connection`, il JVM non riesce a creare il socket AF_UNIX nella cartella
temporanea di default (tipico dei path con nome corto tipo `GIUSEP~1`).
Si risolve indicandogliene un'altra:

```bash
setx JAVA_TOOL_OPTIONS "-Djdk.net.unixdomain.tmpdir=C:\jtmp"
```

## Deploy

**Il deploy in produzione avviene solo dalla CI, con approvazione manuale.**
Non usare `vercel --prod` da locale: pubblicherebbe codice che non ha superato
i gate.

GitHub → Actions → *Deploy in produzione* → Run workflow.

Procedura completa, configurazione dei secret e criteri di abort:
[`docs/runbook/deploy.md`](./docs/runbook/deploy.md).

## Operatività

| Documento | Quando serve |
|---|---|
| [`docs/runbook/deploy.md`](./docs/runbook/deploy.md) | Rilasciare |
| [`docs/runbook/rollback.md`](./docs/runbook/rollback.md) | Tornare indietro |
| [`docs/runbook/backup-restore.md`](./docs/runbook/backup-restore.md) | Backup e ripristino |
| [`docs/runbook/incidenti.md`](./docs/runbook/incidenti.md) | Qualcosa è rotto |
| [`docs/runbook/osservabilita.md`](./docs/runbook/osservabilita.md) | Sentry, uptime, alert |
| [`docs/runbook/app-check.md`](./docs/runbook/app-check.md) | Attivare App Check |
| [`SECURITY.md`](./SECURITY.md) | Postura di sicurezza e limiti noti |
| [`docs/privacy/registro-trattamenti.md`](./docs/privacy/registro-trattamenti.md) | Adempimenti GDPR |

## Stato: beta chiusa (T1)

Prima di aprire al pubblico vanno chiusi:

- [ ] Backup: PITR + export giornaliero, con **un restore realmente provato**
- [ ] Sentry e uptime monitor configurati e notifica testata
- [ ] App Check in enforcement (`docs/runbook/app-check.md`)
- [ ] Titolare del trattamento identificato, DPA firmati
- [ ] Test sulle Cloud Functions con emulatore
- [ ] E2E su schedina, minigiochi e leghe
- [ ] Test di carico e punto di rottura noto
- [ ] Pentest esterno

## Roadmap
- [ ] Negozio con pagamenti reali (progetto separato, soglie T0)
- [ ] Notifiche push pre-deadline
- [ ] Classifiche di lega settimanali con premi in gettoni
