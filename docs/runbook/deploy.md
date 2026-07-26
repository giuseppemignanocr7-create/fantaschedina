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

## 3b. Configurazione della pipeline

*Configurata il 26 luglio 2026.*

### Già fatto

**Environment `production-deploy`** — reviewer obbligatorio
`giuseppemignanocr7-create`, deploy consentito solo da branch protetti.

> Si chiama `production-deploy` e non `production` perché su questo repo esiste
> già un environment `Production` creato dall'integrazione Vercel, privo di
> protection rules. Agganciarsi a quello avrebbe fatto passare il deploy senza
> approvazione.

**Branch protection su `master`** — PR obbligatoria, force push e cancellazione
vietati, `enforce_admins` attivo, status check richiesti:
`Sicurezza (segreti, dipendenze)`,
`Frontend (typecheck, lint, test, build)`,
`Cloud Functions (typecheck, build)`.

> `required_approving_review_count` è **0**: sei l'unico manutentore e GitHub
> non permette di approvare le proprie PR. Il gate reale sono gli status check,
> non l'approvazione umana. Diventa 1 quando entra una seconda persona.

**Secret già caricati** (10): `FIREBASE_PROJECT_ID`, `VERCEL_ORG_ID`,
`VERCEL_PROJECT_ID`, i sei `VITE_FIREBASE_*` e `FIREBASE_SERVICE_ACCOUNT`.

**Service account di deploy** — `github-deploy@fantaschedina-4a1b2.iam.gserviceaccount.com`,
creata apposta invece di riusare la chiave `firebase-adminsdk`, che avrebbe
dato alla CI anche lettura e scrittura sui dati degli utenti e il controllo
completo di Authentication. Ruoli assegnati:

```
firebase.admin            rules, indexes, configurazione progetto
cloudfunctions.admin      deploy delle functions
run.admin                 le functions v2 sono Cloud Run
artifactregistry.admin    immagini di build
cloudbuild.builds.editor  build delle functions
iam.serviceAccountUser    impersonare la SA di runtime
serviceusage.serviceUsageConsumer
```

```bash
gcloud projects get-iam-policy fantaschedina-4a1b2 \
  --flatten="bindings[].members" \
  --filter="bindings.members:github-deploy@fantaschedina-4a1b2.iam.gserviceaccount.com" \
  --format="value(bindings.role)"
```

> La chiave e' stata generata, caricata come secret e cancellata dal disco.
> Ruotala se sospetti un'esposizione:
> `gcloud iam service-accounts keys list --iam-account github-deploy@fantaschedina-4a1b2.iam.gserviceaccount.com`

```bash
gh secret list
gh api repos/giuseppemignanocr7-create/fantaschedina/branches/master/protection
```

### Ancora da fare a mano

| Secret | Perché non è automatizzabile |
|---|---|
| `VERCEL_TOKEN` | Vercel non espone la creazione di token via CLI. Dashboard → Settings → Tokens, scope sul team `fantaschedina` |
| `VITE_SENTRY_DSN` | Richiede un progetto Sentry, vedi `osservabilita.md` |
| `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` | Opzionale, vedi `app-check.md` |

```bash
gh secret set VERCEL_TOKEN
```

> Senza `VERCEL_TOKEN` il job di deploy del frontend fallisce. Il deploy di
> rules e functions invece e' gia' completo.

### Sbloccarsi in emergenza

Con `enforce_admins` attivo non puoi pushare su `master` nemmeno tu. Per un
hotfix quando la CI è rotta:

```bash
gh api -X DELETE repos/giuseppemignanocr7-create/fantaschedina/branches/master/protection/enforce_admins
# ... push del fix ...
gh api -X POST repos/giuseppemignanocr7-create/fantaschedina/branches/master/protection/enforce_admins
```

Riattivala subito dopo. Una protezione disattivata "temporaneamente" e mai
ripristinata è lo scenario più comune di regressione.

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
