# Runbook operativi — FantaSchedina

Documentazione minima per operare il servizio. Chi non ha scritto il codice
deve poter rilasciare, ripristinare e gestire un incidente usando solo questi file.

| File | Quando serve |
|---|---|
| [`deploy.md`](./deploy.md) | Rilasciare una nuova versione |
| [`rollback.md`](./rollback.md) | Tornare alla versione precedente, in fretta |
| [`backup-restore.md`](./backup-restore.md) | Configurare i backup e provare un ripristino |
| [`incidenti.md`](./incidenti.md) | Qualcosa è rotto in produzione |
| [`app-check.md`](./app-check.md) | Attivare App Check senza rompere i client |
| [`osservabilita.md`](./osservabilita.md) | Configurare Sentry, uptime, alert di budget |

## Coordinate del servizio

| Voce | Valore |
|---|---|
| Frontend | https://fantaschedina.vercel.app (Vercel) |
| Backend | Firebase project `fantaschedina-4a1b2`, region `europe-west1` |
| Database | Cloud Firestore (nativo) |
| Dati partite | ESPN public API — **nessun SLA, nessun contratto** |
| Quote | odds-api.io (opzionale) con fallback algoritmico |
| Tier di criticità | **T1** — beta chiusa |

## Soglie concordate (T1)

| Metrica | Obiettivo |
|---|---|
| Rollback | < 30 min |
| Restore verificato | ogni 90 giorni |
| Reperibilità post-deploy | 24 h |
| Disponibilità | 99,5% mensile |

## Cosa NON è ancora coperto

Da affrontare prima di aprire al pubblico (passaggio a T0):
load test e punto di rottura, SLO formali, pentest, deploy canary, multi-AZ.
