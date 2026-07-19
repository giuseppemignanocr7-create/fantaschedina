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
