# Rollback

> Il reperibile ha autorità piena di rollback: nessuna escalation,
> nessuna giustificazione preventiva. Si torna indietro prima, si capisce dopo.

**Obiettivo T1: < 30 minuti.**

Il sistema ha **tre artefatti indipendenti** che si deployano separatamente.
Un rollback può riguardarne uno solo o tutti e tre. Vanno annullati
nell'ordine inverso rispetto al deploy.

| Artefatto | Dove | Tempo tipico |
|---|---|---|
| Frontend | Vercel | ~1 min |
| Cloud Functions | Firebase | ~5 min |
| Firestore rules | Firebase | ~1 min |

## Quando fare rollback

Non sono spunti di riflessione: sono soglie. Se una si verifica, si torna indietro.

- error rate > 2% per 5 minuti consecutivi
- latenza p95 > 3 s per 10 minuti
- qualsiasi errore di integrità dati (saldi incoerenti, doppi accrediti)
- login non funzionante
- una funzione core inutilizzabile senza workaround

## 1. Frontend (Vercel)

```bash
# Elenco dei deploy recenti
npx vercel ls fantaschedina

# Ritorno al precedente
npx vercel rollback <deployment-url> --yes
```

Attenzione al **service worker**: i client con la PWA installata possono
restare sulla versione vecchia in cache. `index.html` contiene già uno script
che forza `registration.update()` a ogni caricamento, ma la propagazione
richiede una ricarica. In caso di rollback urgente, comunicalo agli utenti.

## 2. Cloud Functions

Le functions non hanno un "undo" nativo: si ridistribuisce il codice precedente.

```bash
# 1. Trova il tag o il commit della versione buona
git log --oneline -n 10

# 2. Portati su quel commit senza toccare master
git checkout <sha-buono>

# 3. Ridistribuisci
$env:FUNCTIONS_DISCOVERY_TIMEOUT="120"   # necessario su Windows
firebase deploy --only functions

# 4. Torna su master
git checkout master
```

Per una singola function:

```bash
firebase deploy --only functions:submitSchedina
```

> **Migrazioni di schema.** Firestore non ha uno schema esplicito: se la
> versione nuova ha scritto documenti con campi nuovi, il rollback del codice
> **non** li rimuove. Verifica che la versione precedente li ignori senza
> rompersi. Se non è così, serve uno script di pulizia: scrivilo *prima* di
> deployare una modifica di forma dei dati, non dopo.

## 3. Firestore rules

```bash
git checkout <sha-buono> -- firestore.rules
firebase deploy --only firestore:rules
git checkout master -- firestore.rules
```

Le rules si propagano in pochi secondi. È l'operazione più rapida e va fatta
**per prima** se il problema è un accesso negato o, peggio, un accesso concesso
per errore.

## 4. Verifica post-rollback

```bash
# Il frontend risponde e ha gli header di sicurezza
curl -sI https://fantaschedina.vercel.app | Select-String -Pattern 'HTTP/|content-security|x-content-type'
```

Poi a mano, in un browser in incognito:

- [ ] login
- [ ] la dashboard mostra la giornata corrente
- [ ] la classifica si popola
- [ ] apertura schedina senza errori in console

## 5. Prova periodica

Il rollback va provato **su ogni artefatto candidato**, non una volta all'anno.

```
PROVA DI ROLLBACK
Data: ....................  Eseguito da: ....................
Artefatto di partenza: ....................
Artefatto di destinazione: ....................

Frontend  — inizio ......:......  fine ......:......  durata ..........
Functions — inizio ......:......  fine ......:......  durata ..........
Rules     — inizio ......:......  fine ......:......  durata ..........

TOTALE: ..........   (obiettivo T1: < 30 min)
Verifiche post-rollback superate: SI / NO
Note: ....................
```
