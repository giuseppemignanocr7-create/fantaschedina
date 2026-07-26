# Deploy

**Il deploy in produzione avviene esclusivamente dalla CI, con approvazione manuale.**
Il vecchio `npx vercel --prod` da locale non va più usato: pubblicava codice
che non aveva superato alcun gate.

## Flusso

```
push su master → gate automatici → approvazione manuale → deploy → verifica
```

I gate girano su `.github/workflows/ci.yml`; il deploy su
`.github/workflows/deploy.yml`, vincolato all'environment protetto `production`.

## 1. Prima del deploy

- [ ] Tutti i gate CI verdi sull'**artefatto candidato** (non su un commit diverso)
- [ ] 0 bug Blocker/Critical aperti
- [ ] Backup recente verificato: `gcloud storage ls gs://fantaschedina-backups/daily/`
- [ ] Reperibile designato per le 24 h successive
- [ ] Non è venerdì pomeriggio, non è la vigilia di un ponte
- [ ] Se la modifica tocca la forma dei dati: percorso inverso scritto e provato

## 2. Ordine di deploy

L'ordine non è arbitrario. Le rules devono essere già permissive verso i nuovi
campi **prima** che il codice li scriva; il frontend deve andare per ultimo
perché è quello che genera il traffico.

1. **Firestore rules e indici** — `firebase deploy --only firestore:rules,firestore:indexes`
2. **Cloud Functions** — `firebase deploy --only functions`
3. **Frontend** — build Vite + deploy Vercel

## 3. Deploy manuale (solo emergenze)

Da usare unicamente quando la CI è indisponibile e c'è un incidente in corso.
Va annotato nel canale del team.

```powershell
# Gate minimi, in locale
npm ci
npx tsc --noEmit
npx eslint . --max-warnings 0
npx vitest run
npm --prefix functions ci
npm --prefix functions run build

# Deploy nell'ordine corretto
firebase deploy --only firestore:rules,firestore:indexes
$env:FUNCTIONS_DISCOVERY_TIMEOUT="120"
firebase deploy --only functions
npm run build
npx vercel --prod --yes
```

## 3b. Configurazione della pipeline (una tantum)

Finché questi passaggi non sono completati, `deploy.yml` fallisce. L'editor
segnala i riferimenti ai secret come "context access might be invalid": è
atteso, sparisce una volta creati.

**Settings → Environments → New environment → `production`**

- Required reviewers: almeno una persona (è ciò che rende il deploy approvato,
  non automatico)
- Deployment branches: solo `master`

**Settings → Secrets and variables → Actions**

| Secret | Da dove si ottiene |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | Firebase Console → Impostazioni → Account di servizio → Genera nuova chiave privata (JSON completo) |
| `FIREBASE_PROJECT_ID` | `fantaschedina-4a1b2` |
| `VERCEL_TOKEN` | Vercel → Settings → Tokens |
| `VERCEL_ORG_ID` | file `.vercel/project.json` |
| `VERCEL_PROJECT_ID` | file `.vercel/project.json` |
| `VITE_FIREBASE_*` | stessi valori del pannello Vercel |
| `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` | opzionale, vedi `app-check.md` |
| `VITE_SENTRY_DSN` | opzionale, vedi `osservabilita.md` |

**Settings → Branches → Add rule su `master`**

- Require a pull request before merging
- Require status checks: `Sicurezza (segreti, dipendenze)`,
  `Frontend (typecheck, lint, test, build)`, `Cloud Functions (typecheck, build)`
- Do not allow bypassing the above settings

## 4. Configurazione dei secret

### Firebase (server)

```bash
firebase functions:secrets:set ODDS_API_KEY
firebase deploy --only functions   # necessario dopo ogni cambio di secret
```

> Un secret è disponibile a una function v2 **solo** se dichiarato nelle sue
> opzioni (`secrets: [ODDS_API_KEY]`). Senza, `process.env` resta vuoto e il
> sistema degrada in silenzio. Vedi `functions/src/index.ts`.

### Vercel (client)

Variabili richieste, da configurare nel pannello del progetto:

| Variabile | Obbligatoria | Nota |
|---|---|---|
| `VITE_FIREBASE_API_KEY` | sì | |
| `VITE_FIREBASE_AUTH_DOMAIN` | sì | |
| `VITE_FIREBASE_PROJECT_ID` | sì | |
| `VITE_FIREBASE_STORAGE_BUCKET` | sì | |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | sì | |
| `VITE_FIREBASE_APP_ID` | sì | |
| `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` | no | necessaria per App Check |
| `VITE_SENTRY_DSN` | no | senza, l'error tracking è disattivato |

## 5. Verifica post-deploy

Da eseguire entro 15 minuti, prima di considerare chiuso il rilascio.

```bash
# Header di sicurezza presenti
curl -sI https://fantaschedina.vercel.app | grep -Ei 'content-security|x-content-type|referrer|permissions|strict-transport'
```

Smoke test manuale in incognito:

- [ ] login con account di prova
- [ ] la dashboard mostra la giornata corrente
- [ ] apertura e compilazione schedina
- [ ] classifica popolata
- [ ] un minigioco accredita gettoni
- [ ] console del browser senza errori

Poi, sui cruscotti:

- [ ] Sentry: nessuna nuova classe di errore
- [ ] Cloud Logging: nessun picco di `severity>=ERROR`
- [ ] uptime monitor verde

## 6. Criteri di abort

Definiti **prima**, non durante. Se si verificano, si applica
[`rollback.md`](./rollback.md) senza discussione.

- error rate > 2% per 5 min
- latenza p95 > 3 s per 10 min
- qualsiasi errore di integrità dati
- login non funzionante
