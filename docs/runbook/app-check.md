# Attivare App Check

## Il problema che risolve

Le Cloud Functions verificano che la chiamata provenga da un utente
autenticato, ma non da **quale applicazione**. Chiunque ottenga un ID token
Firebase valido — anche legittimamente, registrandosi — può chiamare le
callable da uno script, ignorando completamente il frontend.

Per un gioco con un'economia di gettoni questo significa poter automatizzare
i minigiochi. Il rate limiting server-side contiene il danno, non lo elimina.

App Check aggiunge un attestato di integrità dell'app.

## Perché non è già attivo

`ENFORCE_APP_CHECK = false` in `functions/src/index.ts`.

Se lo si attivasse senza la site key reCAPTCHA configurata sul frontend,
il client non allegherebbe alcun token e **ogni chiamata verrebbe respinta**:
l'app diventerebbe inutilizzabile all'istante. L'ordine di attivazione conta.

## Sequenza

### 1. Crea la chiave reCAPTCHA Enterprise

Google Cloud Console → Security → reCAPTCHA Enterprise → **Create key**

- Platform: **Website**
- Domini: `fantaschedina.vercel.app` e `localhost`
- Non spuntare "Use checkbox challenge" (serve il punteggio, non il widget)

Annota la **site key**.

### 2. Registra l'app in App Check

Firebase Console → App Check → tab Apps → app Web → **reCAPTCHA Enterprise**
→ incolla la site key → Save.

Non attivare ancora l'enforcement.

### 3. Configura il frontend

Vercel → Settings → Environment Variables:

```
VITE_RECAPTCHA_ENTERPRISE_SITE_KEY=<site key>
```

Poi ridistribuisci il frontend. `src/lib/firebase.ts` inizializza App Check
solo se la variabile è presente, quindi da questo momento i client iniziano
ad allegare il token.

### 4. Osserva prima di imporre

**Attendi almeno 48 ore** e controlla Firebase Console → App Check → Metrics.

Devi vedere una quota di richieste verificate vicina al 100%. Se resta bassa,
qualcosa non funziona: non procedere, altrimenti tagli fuori utenti veri.

Cause tipiche di richieste non verificate:
- dominio non incluso nella chiave reCAPTCHA
- utenti con la PWA installata e vecchio bundle in cache
- estensioni del browser che bloccano `recaptcha.net`

### 5. Attiva l'enforcement

In `functions/src/index.ts`:

```ts
const ENFORCE_APP_CHECK = true;
```

```bash
firebase deploy --only functions
```

### 6. Verifica

- [ ] Login e navigazione normale funzionano
- [ ] Invio schedina funziona
- [ ] Un minigioco accredita gettoni
- [ ] Una chiamata diretta con solo l'ID token viene respinta:

```bash
# atteso: 401 / "App Check token" nell'errore
curl -X POST \
  https://europe-west1-fantaschedina-4a1b2.cloudfunctions.net/playMinigame \
  -H "Authorization: Bearer <ID_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"data":{"action":"wheel_spin"}}'
```

## Rollback

Se dopo l'attivazione arrivano segnalazioni di errori di permesso:

```ts
const ENFORCE_APP_CHECK = false;
```

```bash
firebase deploy --only functions   # ~5 min
```

## Sviluppo locale

`src/lib/firebase.ts` imposta `FIREBASE_APPCHECK_DEBUG_TOKEN = true` in DEV.
Alla prima esecuzione la console del browser stampa un debug token: va
registrato in Firebase Console → App Check → app Web → Manage debug tokens.

I test E2E girano contro gli emulatori, che non applicano App Check.
