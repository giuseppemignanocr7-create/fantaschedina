# Fantaschedina ⚽🪙

Gioco di pronostici Serie A multi-utente: schedine settimanali, classifica condivisa, premi, **minigiochi che fanno guadagnare gettoni** e **power-up** spendibili sulla schedina.

Stack: **React 18 + Vite + TypeScript + Tailwind + Zustand** (client), **Firebase Auth + Firestore + Cloud Functions** (backend sicuro), dati partite **ESPN public API**.

---

## Architettura di sicurezza (importante)

Tutta la logica che tocca **punti e gettoni** gira server-side su Cloud Functions:

| Azione | Dove gira | Perché |
|---|---|---|
| Invio schedina | callable `submitSchedina` | valida deadline, sostituisce le quote con quelle ufficiali, addebita i power-up |
| Settlement giornata | scheduled `settleMatchdays` (ogni ora) | valuta le schedine, aggiorna punti/profili in transaction, assegna premi |
| Sync giornata + quote | scheduled `syncMatchday` (ogni 6h) | le quote sono generate SOLO server-side |
| Minigiochi | callable `playMinigame` | esiti estratti dal server, cooldown 1/giorno su Firestore |
| Missioni | callable `claimMission` | verifica progressi dal profilo, accredita gettoni |
| Cambio Last-Minute | callable `changePrediction` | modifica 1 pronostico post-invio, pre-deadline |

Le **Firestore Rules** (`firestore.rules`) bloccano ogni scrittura client su punti, gettoni, schedine e giornate. Le schedine altrui sono leggibili **solo dopo la deadline** (anti-copia).

## Economia di gioco 🪙

**Guadagni gettoni con:**
- Minigiochi (1 partita/giorno per gioco): Quiz (+5/risposta), Ruota (10–150), Rigori (+10/gol)
- Missioni (50–500 gettoni)
- Performance schedina: +2/esatto, +50 con 9/10, +150 con 10/10, +100 vincitore di giornata

**Li spendi in power-up sulla schedina:**
- 🃏 **Jolly Raddoppio** (200) — raddoppia i punti di 1 pronostico
- 🛡️ **Scudo** (150) — annulla le penalità quote basse
- ⭐ **Assicurazione** (120) — con 8/10 ricevi il bonus del 9/10
- 🔄 **Cambio Last-Minute** (100) — modifica 1 pronostico dopo l'invio

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
# 3. Ridistribuisci le functions
firebase deploy --only functions
```

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
| `schedine` | `{uid}_{matchday}` | Solo Functions | pronostici, power-up, risultati valutati |
| `leagues` | auto | Client (rules vincolate) | leghe private, codici invito, membri |
| `wallet_transactions` | auto | Solo Functions | audit trail gettoni |
| `prizes` | `weekly_{n}`, … | Solo Functions | albo d'oro premi |
| `quiz_questions` | `q001…` | Seed script | pool domande quiz |
| `quiz_sessions` | `{uid}` | Solo Functions | sessione quiz anti-cheat |

## Flusso settlement (automatico)

1. `syncMatchday` (ogni 6h) crea la prossima giornata con quote server-side
2. Gli utenti inviano la schedina via `submitSchedina` (deadline enforced)
3. `settleMatchdays` (ogni ora, post-deadline) legge i risultati ESPN
4. Quando tutte le partite sono finite: valuta le schedine (multi-mercato: 1X2, O/U, GG/NG, DC, multigoal, 1° tempo), applica i power-up, aggiorna profili in transaction, assegna premi (vincitore, quota più alta, poker), accredita gettoni e resetta `weeklyPoints` dei non-giocanti

## Test

```bash
npm test
```
Coprono `src/lib/scoring.ts` e `functions/src/scoring.ts` (regole punti, bonus, penalità, mercati, power-up, premi speciali).

## Deploy frontend

Statico su **Vercel** o **Netlify**: imposta le `VITE_FIREBASE_*` nel pannello del provider. Il backend è interamente su Firebase.

## Roadmap
- [ ] Sfide 1vs1 sui pronostici (minigioco "Sfide")
- [ ] Notifiche push pre-deadline
- [ ] Quote da provider reale (es. odds API) al posto dell'odds engine
- [ ] Classifiche di lega settimanali con premi in gettoni
