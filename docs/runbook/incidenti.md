# Gestione incidenti

## Severità

| Livello | Definizione | Risposta |
|---|---|---|
| **SEV1** | Servizio inutilizzabile, perdita dati, breccia di sicurezza | subito, di notte compresa |
| **SEV2** | Funzione core degradata senza workaround | entro 4 h in orario diurno |
| **SEV3** | Funzione secondaria, workaround disponibile | prossimo giorno lavorativo |

## Primi 5 minuti

1. **Dichiara l'incidente** nel canale del team. Anche da solo: serve la traccia oraria.
2. **Guarda, non ipotizzare:** Sentry → Cloud Logging → uptime monitor.
3. **Stabilizza prima di capire.** Se il deploy è recente, torna indietro:
   il rollback è reversibile, un'indagine di 40 minuti sotto pressione no.
4. **Annota gli orari** man mano. A posteriori non te li ricordi.

---

## Sintomo: il sito non carica

```bash
curl -sI https://fantaschedina.vercel.app
npx vercel ls fantaschedina
```

| Diagnosi | Azione |
|---|---|
| Deploy fallito o rotto | [`rollback.md`](./rollback.md) §1 |
| Vercel in disservizio | https://www.vercel-status.com — non c'è nulla da fare se non comunicarlo |
| Errore JS che blocca il render | Sentry, poi rollback |

## Sintomo: login non funziona

1. Firebase Console → Authentication → verifica che il provider Email/Password sia attivo
2. https://status.firebase.google.com
3. Se compare `auth/invalid-api-key`: le variabili `VITE_FIREBASE_*` su Vercel sono
   state modificate o perse. Ripristinale e ridistribuisci il frontend.
4. Se compare `appCheck/fetch-status-error`: App Check è stato attivato lato server
   senza site key valida sul client → riporta `ENFORCE_APP_CHECK = false` in
   `functions/src/index.ts` e ridistribuisci le functions.

## Sintomo: punteggi o classifica non si aggiornano

Il settlement dipende da ESPN. Percorso di diagnosi:

```bash
firebase functions:log --only settleMatchdays -n 50
firebase functions:log --only updateLiveScores -n 50

# ESPN risponde?
curl -s "https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/scoreboard?limit=5" | head -c 300
```

| Diagnosi | Azione |
|---|---|
| Log con `http:exhausted label=espn:*` | ESPN è down. **Comportamento atteso: il settlement recupera al ciclo successivo, ogni ora.** Nessun intervento, ma avvisa gli utenti se dura oltre le 2 h |
| Nessuna esecuzione della function | Cloud Scheduler → verifica che il job non sia in pausa |
| Partite finite ma giornata non valutata | Forza il settlement dal pannello Admin (`adminForceSettle`) |

## Sintomo: gettoni o punti incoerenti

**È un SEV1: c'è di mezzo l'integrità dei dati. Non improvvisare.**

1. **Non "correggere a mano" un saldo.** Prima capisci quante persone sono coinvolte.
2. `wallet_transactions` è l'audit trail: la somma degli `amount` di un utente
   deve corrispondere al suo campo `coins`.

   ```js
   // Firebase Console → Firestore → query
   // collection wallet_transactions, where userId == '<uid>'
   // somma degli amount === profiles/<uid>.coins ?
   ```
3. Se la discrepanza riguarda **un solo utente**: probabile transazione parziale.
   Correggi con una nuova `wallet_transaction` compensativa, mai modificando
   `coins` direttamente — altrimenti perdi la tracciabilità.
4. Se riguarda **molti utenti**: ferma le callable coinvolte, valuta il
   restore puntuale con PITR ([`backup-restore.md`](./backup-restore.md) §4).

## Sintomo: costi cloud in salita

```bash
gcloud billing accounts list
firebase functions:log -n 100 | Select-String -Pattern 'http:exhausted|error'
```

Cause tipiche, in ordine di probabilità:

- una function schedulata in loop → tutte hanno `maxInstances`, ma verifica
- retry su un provider esterno degradato → cerca `http:exhausted` nei log
- traffico anomalo su una callable → controlla i log di `enforceRateLimit`

Contenimento immediato: abbassa `MAX_INSTANCES` in `functions/src/index.ts`
e ridistribuisci, oppure metti in pausa il job in Cloud Scheduler.

---

## Post-mortem

Obbligatorio per ogni SEV1 e SEV2, **entro 5 giorni lavorativi**.
Si scrive sui sistemi e sui processi, mai sulle persone.

```
INCIDENTE: <id> — <titolo>
DATA: <inizio> → <fine>       DURATA: <hh:mm>
SEVERITÀ: SEV1 | SEV2 | SEV3
IMPATTO: <utenti colpiti, funzioni indisponibili, dati persi>

TIMELINE (ora di Roma)
  hh:mm  causa scatenante
  hh:mm  primo segnale (rilevato da: alert / utente / caso)
  hh:mm  inizio indagine
  hh:mm  mitigazione applicata
  hh:mm  ripristino completo

METRICHE
  Time to detect:   <min>
  Time to mitigate: <min>
  Time to resolve:  <min>

CAUSA RADICE
  <5 whys>

COSA HA FUNZIONATO
COSA NON HA FUNZIONATO
DOVE SIAMO STATI FORTUNATI

AZIONI CORRETTIVE
  | # | Azione | Tipo | Owner | Scadenza |

QUALE CONTROLLO L'AVREBBE INTERCETTATO?
  → se nessuno, aggiungilo. Il runbook si aggiorna dopo ogni incidente.
```
