# Politica di sicurezza

## Segnalare una vulnerabilità

Scrivi a **security@fantaschedina.it** con: descrizione, passi per riprodurre,
impatto stimato. Non aprire una issue pubblica.

Ci impegniamo a rispondere entro 72 ore e a tenerti aggiornato fino alla chiusura.

| Gravità | Tempo di correzione |
|---|---|
| Critical | immediato |
| High | ≤ 7 giorni |
| Medium | ≤ 30 giorni |
| Low | backlog |

## Come è protetta l'applicazione

### Autorizzazione

Tutto ciò che tocca punti, gettoni e schedine gira **server-side** su Cloud
Functions. Le Firestore rules negano ogni scrittura client su quelle collezioni
(`allow write: if false`); solo l'Admin SDK, che le bypassa, può modificarle.

Le schedine altrui sono leggibili solo dopo la deadline della giornata: è una
misura anti-copia, non solo di privacy.

### Limitazione delle richieste

`enforceRateLimit` usa Firestore in transazione. La transazione non è un
dettaglio: un check-then-act non atomico permetterebbe a chiamate parallele
dello stesso utente di leggere tutte lo stesso conteggio e superare il limite.

| Operazione | Limite |
|---|---|
| `submitSchedina` | 3 / minuto |
| `changePrediction`, `cancelSchedina` | 5 / minuto |
| `manageLeague` | 10 / minuto |
| `managePenaltyDuel` | 15 / minuto |
| `exportMyData`, `deleteAccount` | 3 / ora |

### Casualità

Gli esiti che assegnano gettoni — ruota, rigori, ordine delle risposte del quiz —
usano `node:crypto`, non `Math.random()`. La sequenza di V8 è deterministica e,
con abbastanza estrazioni osservate, prevedibile: in un gioco con un'economia
sarebbe un canale di abuso concreto. Vedi `functions/src/random.ts`.

### Segreti

Nessun segreto nel repository, verificato su tutta la history con gitleaks a
ogni esecuzione della CI. I secret server stanno in Firebase Secret Manager,
quelli client sono variabili d'ambiente Vercel.

Le chiavi `VITE_FIREBASE_*` sono pubbliche per costruzione: sono identificatori
di progetto, non credenziali. La protezione dei dati è affidata alle Firestore
rules e ad App Check, non alla segretezza di quelle chiavi.

### Trasporto

TLS 1.2+ con HSTS e preload. CSP, `X-Content-Type-Options`, `Referrer-Policy`,
`Permissions-Policy` e `frame-ancestors 'none'` configurati in `vercel.json`.

## Limitazioni note

Dichiarate apertamente: questa è una **beta chiusa (T1)**, non un servizio
pubblico maturo.

| Area | Stato |
|---|---|
| App Check | implementato ma **non in enforcement** — vedi `docs/runbook/app-check.md` |
| Pentest esterno | mai eseguito |
| Test di carico | mai eseguiti, punto di rottura ignoto |
| Test IDOR automatizzati | non ancora presenti (le rules sono restrittive ma non dimostrate da test) |
| Test sulle Cloud Functions | assenti: `functions/src/index.ts` non è coperto |

Questi punti vanno chiusi prima di aprire il servizio al pubblico.

## Dipendenze

`npm audit --omit=dev` è un gate bloccante in CI a livello `critical`.

**Eccezione accettata e motivata:**

`react-router` 7.18.1 ha un advisory High
([GHSA-qwww-vcr4-c8h2](https://github.com/advisories/GHSA-qwww-vcr4-c8h2)) che
riguarda esclusivamente la **modalità RSC** con server action. FantaSchedina è
una SPA che usa `BrowserRouter` senza rendering server, quindi il codice
vulnerabile non è raggiungibile.

Non esiste una versione priva di avvisi: le release precedenti (≤ 7.17.0)
contengono open redirect in `<Link>` e `useNavigate` che invece **ci
riguarderebbero davvero**. Restare aggiornati è la scelta meno rischiosa.

Da rivedere a ogni release di react-router.
