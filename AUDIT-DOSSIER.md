# FANTA SCHEDINA — Audit Production-Ready

> Data audit: 12 luglio 2026  
> Branch/ambiente: `main` locale + produzione Firebase/Vercel  
> Progetto Firebase: `fantaschedina-4a1b2` (europe-west1, Blaze)  
> Frontend: https://fantaschedina.vercel.app

---

## 1. Executive Summary

L'audit ha coperto architettura, static analysis, sicurezza, logica di dominio (quote, live, punteggi, economia) e UX.  
Sono stati identificati e fixati **criticità di sicurezza e consistenza** nel backend (settlement, minigiochi, leghe, quote live, dati profilo) e **bug UX/dati** nel frontend (mock in produzione, rank non aggiornato, profilo/password non funzionanti, stagione hardcoded, dead link).

| Area | Esito pre-fix | Esito post-fix |
|------|---------------|----------------|
| Typecheck frontend | ✅ pass | ✅ pass |
| Typecheck functions | ✅ pass | ✅ pass |
| Unit tests | ✅ 1421/1421 pass | ✅ 1421/1421 pass |
| Lint frontend | ✅ pass | ✅ pass |
| Build frontend | ⚠️ interrotto durante la verifica finale | da rieseguire |
| Build functions | ✅ build TS ok | ✅ build TS ok |

---

## 2. Architettura e flusso dati

- **Frontend**: React 18 + Vite 5 + TypeScript 5 + Tailwind + Zustand.
- **Backend**: Firebase Cloud Functions v6 (Node 20), Firestore, Firebase Auth.
- **Live data**: doppio canale — polling client ESPN ogni 45s + scheduled function `updateLiveScores` ogni 2 minuti che scrive su Firestore; il client si sottoscrive al documento `matchdays/{n}`.
- **Economia**: valuta virtuale `coins`/`coinsEarned`, premi `weekly_winner`, `highest_odds`, `poker`; audit trail `wallet_transactions`.
- **Leghe**: create/ingresso/uscita/eliminazione server-side, invito tramite codice a 6 caratteri.
- **Quote**: generate server-side da `generateMatchdayOdds` e scritte nel doc `matchdays`; il client le usa solo in display.

---

## 3. Static Analysis

### Frontend
- `tsc --noEmit`: ✅ 0 errori
- ESLint: ✅ 0 errori
- Vitest: ✅ 1421 test pass

### Functions
- `tsc --noEmit`: ✅ 0 errori
- Build: ✅ 0 errori

### Note
- Il comando `npm run build` frontend è stato interrotto durante la verifica finale; va rieseguito prima del deploy.

---

## 4. Security Audit

### 4.1 Autenticazione e segreti
- ✅ Nessuna chiave privata o credenziale esposta nei file tracciati (controllo automatizzato su git-tracked files).
- ✅ `.env.example` contiene solo placeholder vuoti.
- ⚠️ **Non implementato Firebase App Check**: le callable functions sono esposte a token validi di altre app. **Raccomandazione alta**.

### 4.2 Firestore Rules (fixate)
- `profiles`: accesso in scrittura limitato a `username`, `avatarUrl`, `updatedAt`; creazione profilo vincolata ai valori iniziali esatti (100 coins, 0 stats, email token uguale a `request.auth.token.email`, ecc.).
- `matchdays`: read-only per client.
- `schedine`: write disabilitato; lettura consentita solo al proprietario, se `settled=true` o dopo la deadline.
- `leagues`: write disabilitato; lettura consentita solo a leghe pubbliche o membri.
- `wallet_transactions`, `prizes`, `quiz_questions`, `quiz_sessions`: write disabilitato.

### 4.3 Cloud Functions (fixate)
- `settleMatchdays`: rimosso lock pre-settlement che poteva corrompere lo stato. Ora `settleSchedine` è idempotente a livello di singola schedina (transaction: schedina + profilo + wallet transaction).
- `updateLiveScores`: ridotta la finestra di polling a singole partite in corso, evitando chiamate ESPN inutili per giornate passate/future.
- `playMinigame`: quiz/ruota/rigori ora atomici in transaction; impossibile ottenere doppia ricompensa giornaliera concorrente.
- `submitSchedina`, `changePrediction`, `claimMission`: già transactional; quote ufficiali server-side.
- Aggiunte callable `getPublicProfiles` e `manageLeague`: tutte le mutazioni di lega e la classifica pubblica passano dal server.

---

## 5. Domain Logic Audit

### 5.1 Scoring
- Client (`src/lib/scoring.ts`) e server (`functions/src/scoring.ts`) condividono la stessa logica `evaluateSchedina`.
- Unit tests scoring/matrix/simulation passano.

### 5.2 Settlement
- Prima: lock globale, batch non-atomiche, profili aggiornati senza transaction, possibilità di doppio pagamento.
- Dopo: ogni schedina viene valutata in una transaction che include schedina, profilo e wallet transaction con ID deterministico.

### 5.3 Live results
- `updateLiveScores` ora filtra `activeMatches` per singola partita entro finestra -5 min / +4 ore (e fino a 8 ore se già in live).
- Client evita polling ESPN fuori finestra e fonde i dati nello snapshot Firestore senza sovrascriverlo.

### 5.4 Economia
- Monete iniziali: 100.
- Costi power-up: Jolly/Shield/Insurance 25, Last-Minute 50.
- Reward: `perCorrectPrediction` 5, bonus 9/10, weekly winner, poker, highest odds.
- Audit wallet introdotto anche per settlement, quiz, ruota, rigori.

### 5.5 Quote
- Generate deterministicamente server-side e salvate in `matchdays/{n}.odds`; invio usa sempre queste quote.

---

## 6. UX / Frontend Audit

### 6.1 Fix applicati
- `App.tsx`: `loadMatchday` parte solo dopo che Auth ha risolto l'utente.
- `store/index.ts`: rimosso mock iniziale in produzione; rank utente si aggiorna quando arrivano classifiche; bozza schedina si resetta correttamente al cambio giornata.
- `LivePage.tsx`: subscription realtime usa il numero di giornata attuale.
- `ProfiloPage.tsx`: dati demo rimossi; username e password ora modificabili realmente via Firebase; badge basati sulle statistiche reali.
- `AccountPage.tsx`: rimossa etichetta PRO fittizia e voce menu "Impostazioni" senza pagina.
- `SchedinaPage.tsx`, `ClassificaPage.tsx`, `StoricoPage.tsx`, `Footer.tsx`: stagione/copyright dinamici.
- `StoricoPage.tsx`: la label "vinta" dipende ora dai premi ufficiali `weekly_winner`, non da euristica 9+ corretti.

### 6.2 Raccomandazioni UX residue
- Aggiungere messaggi di errore espliciti su schermate vuote quando `currentMatchday` è null.
- Implementare loading skeleton per live tracker e classifiche.
- A11y: aggiungere `aria-label` ai bottoni icona e associare `htmlFor` su form espliciti.
- Responsive: verificare su dispositivi reali (320px, 768px).

---

## 7. Fix implementati (elenco file)

- `functions/src/index.ts`
- `functions/src/espn.ts`
- `firestore.rules`
- `src/App.tsx`
- `src/store/index.ts`
- `src/pages/LivePage.tsx`
- `src/pages/ProfiloPage.tsx`
- `src/pages/AccountPage.tsx`
- `src/pages/SchedinaPage.tsx`
- `src/pages/ClassificaPage.tsx`
- `src/pages/StoricoPage.tsx`
- `src/components/layout/Footer.tsx`
- `src/lib/db.ts`
- `src/lib/leagues.ts`
- `src/lib/gameApi.ts`
- `src/lib/scoring.ts`
- `src/lib/season.ts` (nuovo)
- `src/hooks/useFirebaseAuth.ts`
- `src/services/footballApi.ts`

---

## 8. Raccomandazioni prioritarie

| Priorità | Azione | Motivo |
|----------|--------|--------|
| **Alta** | Abilitare Firebase App Check (reCAPTCHA Enterprise v3) sulle callable functions | Previene abuso token da altre app |
| **Alta** | Eseguire `npm run build` frontend e verificare output | Build interrotta in fase di verifica |
| **Alta** | Aggiornare dipendenze vulnerabili: `firebase`, `react-router-dom`, `@google-cloud/firestore`, `undici`, `protobufjs` | `npm audit` riporta advisory critici; richiedono major upgrade |
| **Media** | Configurare Cloud Functions Node.js 22 (`engines.node: "22"`) | Node 20 decommission previsto per ottobre 2026 |
| **Media** | Aggiungere test E2E per submit schedina, live, minigiochi | Copertura attuale solo unit |
| **Bassa** | Implementare pagina 404 dedicata e gestione errori router | Attualmente fallback generico |
| **Bassa** | Audit accessibilità con Lighthouse/axe | Migliorare contrasti e navigazione tastiera |

---

## 9. Comandi per il deploy

```powershell
# Frontend
npm run build
# Poi vercel --prod (o push su branch deploy)

# Firestore rules e indexes
firebase deploy --only firestore:rules,firestore:indexes

# Cloud Functions (Windows richiede timeout discovery)
$env:FUNCTIONS_DISCOVERY_TIMEOUT="120"
firebase deploy --only functions
```

---

## 10. Conclusioni

Il codebase è stato reso **significativamente più robusto e sicuro**. Le logiche di settlement, economia e live ora sono atomiche e coerenti tra client e server; i dati mock sono stati eliminati; profilo, password e leghe sono funzionanti.  
Prima di andare in produzione è necessario:

1. completare `npm run build`;
2. eseguire smoke test sul deploy di staging;
3. pianificare l'upgrade delle dipendenze vulnerabili;
4. abilitare Firebase App Check.

---

*Dossier generato da Cascade durante l'audit production-ready di FantaSchedina.*

---

# Audit KILLCRITIC — 20 agosto 2026

Secondo passaggio, sullo stato attuale del ramo `master`. Salute di partenza
verificata (non dichiarata): typecheck pulito, ESLint 0 warning, 1462 test
verdi, build e budget bundle rispettati, working tree pulita, nessun segreto
tracciato. I difetti stavano tutti dove non arrivava nessun test: dentro
`functions/src/index.ts`.

## Difetti trovati e corretti

### CRITICI

**1. Doppio rimborso dei power-up: gettoni creati dal nulla**

`submitSchedina` accreditava il rimborso pieno dei power-up precedenti ma
addebitava solo la differenza: ogni modifica della schedina regalava
`2×refund − cost` gettoni. Con gli stessi power-up l'utente incassava l'intero
costo a ogni reinvio (fino a 470 gettoni), dall'interfaccia normale — la pagina
invita esplicitamente a modificare la schedina dopo l'invio.

Misurato con il codice pre-fix rimesso temporaneamente: partendo da 1000
gettoni, due reinvii portavano il saldo a **1470 invece di 530**.

Corretto in `functions/src/powerups.ts` (`computePowerupCharge`): rimborso e
addebito interi e separati, così il registro `wallet_transactions` resta
leggibile. Un rimborso non alimenta più `coinsEarned`, che è una statistica di
gioco e alimenta la missione `coins_1000`.

**2. Il power-up "Cambio Last-Minute" non esisteva**

Venduto a 100 gettoni in README e catalogo client, ma `changePrediction` non
addebitava nulla, non consumava `lastMinuteUsed`, e nessuna schermata lo
chiamava. Ora è quello che il nome promette: dopo la deadline, su una partita
non ancora iniziata, una volta sola per schedina, a pagamento. Prima della
deadline la callable rifiuta, perché lì modificare la schedina è gratis.

**3. Zero test su `functions/src/index.ts`**

Aggiunto un harness di integrazione contro l'emulatore Firestore
(`npm run test:integration`, job CI dedicato): 40 test su invio/reinvio
schedina, power-up, annullamento, Cambio Last-Minute, settlement, duelli e
minigiochi. I due difetti critici sarebbero stati fermati da un test qualsiasi
su queste strade.

### ALTI

**4. Faucet dei duelli** — 50 gettoni a vittoria senza tetto giornaliero, con
duelli contro bot creabili in serie. Introdotto il tetto di 150/giorno, come
già facevano rigori (50) e memoria (40). Il documento del duello espone ora
quanto è stato *davvero* accreditato: col tetto raggiunto il client annunciava
gettoni mai arrivati.

**5. `adminForceSettle` valutava partite non concluse** — a differenza dello
scheduler, non controllava nulla e marcava `settled: true` in modo
irreversibile, contando come sbagliati i pronostici su partite non giocate.
Ora rifiuta ed elenca le partite aperte; si forza solo con `force: true`
(secondo clic esplicito nell'admin UI, più log di warning). Aggiunti anche i
gol del primo tempo, che mancavano: la stessa giornata valeva punteggi diversi
a seconda che la valutasse lo scheduler o l'admin.

**6. Input dei minigiochi presi per buoni** — `memoria_play` accettava
qualunque `timeRemaining`, e un campo non numerico diventava `NaN`: Firestore
scrive NaN senza errori, rendendo il saldo irrecuperabile. Introdotto
`functions/src/input.ts` (`intInRange`) e il tetto al tempo residuo derivato
dai tempi dei livelli. Stessa stretta sulla potenza dei tiri nei rigori.

### MEDI

**7. README economia falso** — quiz +5 (reale 3), rigori +10/gol (reale 2),
ruota 10–150 (reale 5–100), "1 partita al giorno" falso per rigori e memoria.
Sostituito da una tabella corretta.

**8. Mirror economia senza rete** — `src/lib/economy.ts` è una copia manuale di
`functions/src/config.ts` e nessun test le confrontava. Aggiunto
`economyMirror.test.ts`: 39 asserzioni su valori, prezzi e missioni.

**9. Vincitore di giornata a caso** — a parità di punti vinceva la prima
schedina restituita da Firestore. Ora `pickWeeklyWinner` applica criteri
espliciti (punti, esatti, orario di consegna, uid) ed è deterministico.

**10. Saldi altrui esposti** — `getPublicProfiles` restituiva `coins` e
`coinsEarned` di ogni utente, e `sfida_start` il saldo dell'avversario:
nessuna schermata li usava. Rimossi.

**11. Reset `weeklyPoints` non batchato** — sostituito da un `WriteBatch`.

### Trovato durante la verifica

**12. Profilo non creato dopo la registrazione (a volte)**

Alla registrazione `ensureProfile` parte due volte — da `signUp` e dal listener
`onAuthStateChanged`, che ha già letto "profilo assente". La seconda scrive su
un documento nel frattempo creato: Firestore la valuta come *update*, le rules
la respingono (giustamente: consentono di toccare solo username e avatar), e il
codice trattava il rifiuto come errore, segnalandolo a Sentry e chiamando
`setProfile(null)`. Utente registrato, profilo non caricato fino al reload.
Osservato in console durante la verifica manuale con gli emulatori.

Ora `ensureProfile` rilegge il documento invece di fallire, e solo un rifiuto
vero (profilo davvero assente) resta un errore. Coperto da
`src/lib/__tests__/ensureProfile.test.ts`.

## Restano aperti

| # | Voce | Perché non è chiusa |
|---|---|---|
| A | **App Check spento** (`ENFORCE_APP_CHECK = false`) | Prerequisiti fuori dal repo: chiave reCAPTCHA Enterprise, site key su Vercel, 48h di metriche. Attivarlo prima respinge ogni chiamata. Procedura in [`docs/runbook/app-check.md`](docs/runbook/app-check.md). |
| B | **Fine partita dei duelli** | `canFinish` chiude solo a round dispari dopo i tiri regolari: la fase regolare non decide mai la sfida e lo spareggio si chiude dopo il tiro di uno solo dei due. Sistemarlo cambia l'esito delle partite e nelle modalità bot (asimmetriche) va deciso caso per caso. |
| C | **Sfide 1vs1 non collegate** | `sfida_start` e `sfida_play` sono deployate ma nessuna pagina le chiama. O si completa la feature o si rimuove la superficie. |
| D | ~~Classifiche O(N)~~ | **Chiusa**: vedi sotto. |
| E | ~~Duelli orfani~~ | **Chiusa**: vedi sotto. |

## Secondo giro (stessa giornata)

**13. Duelli orfani** — un duello creato e mai raggiunto restava in `waiting`
per sempre, e uno in cui entrambi smettevano di giocare restava in `playing`
per sempre. Aggiunta `cleanupPenaltyDuels` (schedulata ogni ora): elimina le
attese oltre l'ora, chiude come **abbandonate** le partite ferme da più di 30
minuti (senza premio e senza sconfitta: il client mostrava "HAI PERSO" a chi
era rimasto a giocare) e cancella lo storico oltre i 7 giorni.

**14. Classifiche O(N)** — ogni client scaricava l'intero elenco dei profili a
pagine da 100 e ordinava in locale: N/100 invocazioni e N letture per ogni
utente che apriva la classifica, e di nuovo per ogni classifica di lega, che
scaricava tutti i profili del gioco per tenerne i pochi della lega. Ora c'è la
callable `getRankings`, che calcola una volta sola e restituisce solo le righe;
con `leagueId` è ristretta ai membri, e una lega privata non è leggibile da
fuori. La logica di ordinamento è portata in `functions/src/rankings.ts` e
confrontata con la copia client da `rankingsMirror.test.ts`.

## Verifiche finali

| Controllo | Esito |
|---|---|
| `tsc` app, test e functions | 0 errori |
| ESLint `--max-warnings 0` | pulito |
| Test unitari | 1560 |
| Test di integrazione (emulatore) | 52 |
| Build + budget bundle | entro i budget (360.8 / 405 KB gzip) |

Verifica manuale con emulatori Auth + Firestore: registrazione, giornata con
deadline passata e schedina inviata: il banner del Cambio Last-Minute compare,
il flusso a due passi arriva alla schermata di conferma con partita, nuova
quota e costo corretti. La chiamata finale alla callable non è stata esercitata
dal browser (richiede anche l'emulatore Functions) ed è coperta dai test di
integrazione.
