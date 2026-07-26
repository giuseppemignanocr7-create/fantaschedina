# Osservabilità

> Prima di questa configurazione, un crash in produzione non lo sapeva nessuno:
> `ErrorBoundary` scriveva su `console.error` e l'informazione moriva lì.

Tre domande a cui questa configurazione deve saper rispondere:
**cosa si è rotto, quando me ne accorgo, chi lo sa alle 3 di notte.**

## 1. Sentry (errori applicativi)

### Setup

1. https://sentry.io → nuovo progetto **React**, region **EU** (i dati restano in UE:
   è il presupposto per quanto dichiarato nell'informativa privacy)
2. Copia il DSN
3. Vercel → Environment Variables → `VITE_SENTRY_DSN=<dsn>`
4. Ridistribuisci il frontend

L'inizializzazione è in `src/lib/monitoring.ts`: se il DSN manca, Sentry resta
disattivato e l'app funziona normalmente. Nessun blocco in sviluppo.

### Cosa è già configurato nel codice

- `tracesSampleRate` al 10%: sufficiente a vedere le tendenze senza esaurire la quota
- `release` legato al commit, per capire quale deploy ha introdotto un errore
- **scrubbing PII**: email e password vengono rimosse prima dell'invio. Solo
  l'`uid` viene trasmesso, ed è uno pseudonimo

### Alert da creare

| Condizione | Canale |
|---|---|
| Nuova classe di errore introdotta da un release | email |
| Più di 10 eventi dello stesso tipo in 5 minuti | email |
| Errore che colpisce più di 5 utenti distinti | email |

## 2. Uptime esterno

Un controllo indipendente dall'infrastruttura che stai monitorando: se cade
Vercel, deve essere qualcosa *fuori* da Vercel ad accorgersene.

### Configurato su Cloud Monitoring

*Creato il 26 luglio 2026.*

| Risorsa | Valore |
|---|---|
| Uptime check | `Frontend Fantaschedina` — `fantaschedina.vercel.app`, ogni 5 min, HTTPS su `/` |
| Alert policy | `Frontend Fantaschedina irraggiungibile` — scatta se il check fallisce in piu' di una regione per 5 min |
| Canale | email a `giuseppemignanocr7@gmail.com` |

```bash
gcloud monitoring uptime list-configs --project fantaschedina-4a1b2
gcloud alpha monitoring policies list --project fantaschedina-4a1b2
```

> Cloud Monitoring gira su Google Cloud, cioe' sulla stessa infrastruttura di
> Firestore e delle functions. Copre la caduta di Vercel, **non** un guasto
> esteso di Google. Un secondo check su un provider terzo (Better Stack,
> UptimeRobot) resta la scelta corretta prima dell'apertura al pubblico.

### Ancora da verificare

**Il canale email e' stato creato ma non provato.** Metti in pausa il check,
lascialo fallire e conferma che la notifica arrivi davvero. Un alert
configurato e mai verificato e' un alert che non esiste: nella casella di posta
puo' finire in spam, o l'indirizzo puo' essere sbagliato senza che nulla lo
segnali.

### Secondo check, da aggiungere

| Check | URL | Frequenza | Atteso |
|---|---|---|---|
| Firestore | `https://firestore.googleapis.com/v1/projects/fantaschedina-4a1b2/databases/(default)` | 5 min | HTTP 200/401 |

## 3. Cloud Logging e alert di budget

### Metrica sugli errori delle functions

```bash
gcloud logging metrics create function_errors \
  --description="Errori nelle Cloud Functions" \
  --log-filter='resource.type="cloud_function" AND severity>=ERROR'
```

Poi in Cloud Monitoring → Alerting: notifica se `function_errors > 10` in 5 minuti.

### Alert di budget

Google Cloud Console → Billing → Budgets & alerts:

- Budget mensile: **10 €** (adeguato a una beta chiusa)
- Soglie di notifica: 50%, 90%, 100%

Non blocca la spesa, ma toglie la possibilità di scoprire un loop a fine mese.

### Dipendenze esterne degradate

Il client HTTP in `functions/src/http.ts` logga in modo strutturato:

| Evento | Significato |
|---|---|
| `http:failure` | singolo tentativo fallito, si riprova |
| `http:exhausted` | tentativi esauriti, il dato non è disponibile |
| `http:client-error` | 4xx, nessun retry (errore deterministico) |

```bash
firebase functions:log -n 100 | Select-String -Pattern 'http:exhausted'
```

Un `http:exhausted` con `label=espn:*` significa che il settlement salterà
questo ciclo e recupererà al successivo. È degrado previsto, non un guasto.

## 4. Cosa NON è coperto

Deliberatamente fuori scope per il tier T1, da affrontare prima di aprire al pubblico:

- tracing distribuito (OpenTelemetry)
- SLO formali ed error budget
- synthetic monitoring sui percorsi di business
- metriche RED per singolo servizio
