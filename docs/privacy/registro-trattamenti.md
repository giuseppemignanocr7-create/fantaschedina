# Registro delle attività di trattamento

*Art. 30 GDPR — Versione 1.0 — 26 luglio 2026*

> La fonte di verità tecnica è `src/lib/privacy.ts`, che alimenta la pagina
> `/privacy` mostrata agli utenti. Se cambia un trattamento si aggiornano
> entrambi: un'informativa che non corrisponde ai trattamenti reali è, di per
> sé, una violazione.

## Titolare

| Voce | Valore |
|---|---|
| Titolare | **DA COMPLETARE** — denominazione, indirizzo, P.IVA/CF |
| Contatto privacy | privacy@fantaschedina.it |
| DPO | non nominato (non ricorrono i presupposti dell'art. 37) |

> **Da completare prima dell'apertura al pubblico.** Un'informativa senza un
> titolare identificabile non è valida.

## Trattamenti

### T1 — Gestione dell'account

| Voce | Valore |
|---|---|
| Finalità | Creazione, autenticazione e gestione dell'account |
| Base giuridica | Art. 6.1.b — esecuzione del contratto |
| Interessati | Utenti registrati |
| Categorie di dati | Email, nome utente, password (hash gestito da Firebase Auth) |
| Destinatari | Google Ireland (Firebase Auth) |
| Conservazione | Durata dell'account + 30 giorni dalla cancellazione |
| Misure | TLS, hash password gestito dal provider, MFA disponibile |

### T2 — Erogazione del gioco

| Voce | Valore |
|---|---|
| Finalità | Schedine, punteggi, classifiche, gettoni, minigiochi |
| Base giuridica | Art. 6.1.b — esecuzione del contratto |
| Interessati | Utenti registrati |
| Categorie di dati | Pronostici, punteggi, statistiche, transazioni in valuta virtuale |
| Destinatari | Google Ireland (Firestore) |
| Conservazione | Durata dell'account + 30 giorni |
| Misure | Firestore rules restrittive, scritture solo server-side |

### T3 — Classifiche e leghe

| Voce | Valore |
|---|---|
| Finalità | Mostrare classifiche e composizione delle leghe |
| Base giuridica | Art. 6.1.b — esecuzione del contratto |
| Interessati | Utenti registrati |
| Categorie di dati | Nome utente, punteggi |
| Destinatari | Altri utenti dell'applicazione |
| Conservazione | Durata dell'account |
| Nota | L'email **non** è mai esposta ad altri utenti. Le schedine altrui sono visibili solo dopo la deadline della giornata |

### T4 — Sicurezza e prevenzione abusi

| Voce | Valore |
|---|---|
| Finalità | Limitazione delle richieste, prevenzione di automazioni e frodi |
| Base giuridica | Art. 6.1.f — legittimo interesse |
| Interessati | Utenti registrati |
| Categorie di dati | Identificativo utente, timestamp, indirizzo IP (trattato dai fornitori) |
| Destinatari | Google Ireland, Vercel |
| Conservazione | 30 giorni |
| Bilanciamento | L'interesse a proteggere l'integrità del gioco e degli account prevale: i dati sono minimi, pseudonimizzati e conservati per un periodo breve |

### T5 — Diagnostica degli errori

| Voce | Valore |
|---|---|
| Finalità | Rilevare e correggere malfunzionamenti |
| Base giuridica | Art. 6.1.f — legittimo interesse |
| Interessati | Utenti registrati |
| Categorie di dati | Identificativo utente pseudonimo, stack trace, versione dell'app |
| Destinatari | Functional Software Inc. (Sentry), region UE |
| Conservazione | 30 giorni |
| Misure | Scrubbing attivo di email, password e token prima dell'invio (`src/lib/monitoring.ts`); `sendDefaultPii: false` |

## Responsabili del trattamento (art. 28)

| Responsabile | Servizio | Ubicazione | DPA |
|---|---|---|---|
| Google Ireland Ltd | Firebase Auth, Firestore, Cloud Functions, Cloud Storage | UE (europe-west1) | Cloud Data Processing Addendum — **da accettare** |
| Vercel Inc. | Hosting frontend, CDN | UE/USA | DPA — **da firmare** |
| Functional Software Inc. | Error tracking | UE (region.de) | DPA — **da firmare** |

Trasferimenti extra-UE coperti da Clausole Contrattuali Standard e, dove
applicabile, dal Data Privacy Framework UE-USA.

## Diritti degli interessati

| Diritto | Come si esercita | Stato |
|---|---|---|
| Accesso (art. 15) | Account → Scarica i miei dati | ✅ implementato |
| Rettifica (art. 16) | Profilo → modifica nome utente | ✅ implementato |
| Cancellazione (art. 17) | Account → Elimina account | ✅ implementato |
| Portabilità (art. 20) | Account → Scarica i miei dati (JSON) | ✅ implementato |
| Limitazione / opposizione | privacy@fantaschedina.it | procedura manuale |

Implementazione: callable `exportMyData` e `deleteAccount` in
`functions/src/index.ts`. La cancellazione è a cascata su profilo, schedine,
transazioni, duelli e leghe possedute, seguita dalla revoca dei token e dalla
rimozione dell'utenza di autenticazione.

## Cookie e archiviazione locale

Solo archiviazione tecnica necessaria alla sessione (gestita da Firebase Auth)
e alle preferenze dell'app. Nessun cookie di profilazione, nessun analytics di
terze parti: **non è richiesto un banner di consenso**.

Se in futuro si introducono analytics o pixel di marketing, occorre aggiungere
un banner con blocco preventivo e rifiuto facile quanto l'accettazione.

## Violazione dei dati

Procedura operativa: `docs/runbook/incidenti.md`.
Notifica al Garante entro **72 ore** dalla conoscenza, se sussiste rischio per
i diritti e le libertà degli interessati.

## Valutazione d'impatto (DPIA)

**Non necessaria** allo stato attuale: nessuna profilazione, nessun trattamento
di categorie particolari, nessun monitoraggio sistematico su larga scala,
utenza limitata in beta chiusa.

Da rivalutare se si introducono: profilazione comportamentale, pagamenti,
raccolta di dati di fatturazione o apertura al pubblico su larga scala.

## Punti aperti

- [ ] Identificare il titolare (denominazione, indirizzo, P.IVA/CF)
- [ ] Accettare il DPA di Google Cloud
- [ ] Firmare il DPA di Vercel
- [ ] Firmare il DPA di Sentry
- [ ] Attivare una casella privacy@ realmente monitorata
