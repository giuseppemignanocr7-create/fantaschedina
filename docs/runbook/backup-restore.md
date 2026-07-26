# Backup e restore

> Un backup non testato non è un backup: è un file.
> Questo runbook non è completo finché non hai eseguito **almeno un restore**
> e compilato il verbale in fondo.

## 1. Configurazione iniziale (una tantum)

Prerequisiti: `gcloud` autenticato sul progetto, ruolo `Owner` o
`Datastore Import Export Admin`.

```bash
gcloud config set project fantaschedina-4a1b2
```

### 1.1 Point-in-time recovery

PITR consente di riportare il database a un istante qualsiasi degli ultimi
7 giorni. È la difesa contro l'errore umano (una migrazione sbagliata, una
cancellazione di massa), non contro la perdita del progetto.

```bash
gcloud firestore databases update --database='(default)' \
  --enable-pitr
```

Verifica:

```bash
gcloud firestore databases describe --database='(default)' \
  --format='value(pointInTimeRecoveryEnablement)'
# atteso: POINT_IN_TIME_RECOVERY_ENABLED
```

### 1.2 Bucket per gli export

Il bucket deve stare nella **stessa region** del database, altrimenti
l'export fallisce. Versioning e retention policy proteggono da una
cancellazione accidentale o dolosa dei backup stessi.

```bash
gcloud storage buckets create gs://fantaschedina-backups \
  --location=europe-west1 \
  --uniform-bucket-level-access

gcloud storage buckets update gs://fantaschedina-backups --versioning

# I backup non sono cancellabili per 30 giorni, nemmeno da un Owner.
gcloud storage buckets update gs://fantaschedina-backups \
  --retention-period=30d

# Pulizia automatica oltre i 90 giorni
cat > /tmp/lifecycle.json <<'EOF'
{"rule":[{"action":{"type":"Delete"},"condition":{"age":90}}]}
EOF
gcloud storage buckets update gs://fantaschedina-backups \
  --lifecycle-file=/tmp/lifecycle.json
```

### 1.3 Export giornaliero automatico

```bash
# Permessi al service account di Firestore
PROJECT_NUMBER=$(gcloud projects describe fantaschedina-4a1b2 --format='value(projectNumber)')
SA="service-${PROJECT_NUMBER}@gcp-sa-firestore.iam.gserviceaccount.com"

gcloud storage buckets add-iam-policy-binding gs://fantaschedina-backups \
  --member="serviceAccount:${SA}" --role=roles/storage.admin

# Job schedulato alle 03:15 ora di Roma
gcloud scheduler jobs create http firestore-daily-export \
  --location=europe-west1 \
  --schedule="15 3 * * *" \
  --time-zone="Europe/Rome" \
  --uri="https://firestore.googleapis.com/v1/projects/fantaschedina-4a1b2/databases/(default):exportDocuments" \
  --http-method=POST \
  --oauth-service-account-email="${SA}" \
  --message-body='{"outputUriPrefix":"gs://fantaschedina-backups/daily"}'
```

Verifica che il primo export sia andato a buon fine:

```bash
gcloud scheduler jobs run firestore-daily-export --location=europe-west1
sleep 120
gcloud storage ls gs://fantaschedina-backups/daily/
```

## 2. Prova di restore

**Da eseguire su un progetto Firebase separato, mai sul progetto di produzione.**
Un import su produzione sovrascrive i documenti con lo stesso ID.

```bash
# 1. Avvia il cronometro
date -u +"inizio: %H:%M:%S"

# 2. Individua l'export più recente
gcloud storage ls gs://fantaschedina-backups/daily/

# 3. Importa nel progetto di prova
gcloud config set project fantaschedina-restore-test
gcloud firestore import gs://fantaschedina-backups/daily/<TIMESTAMP>

# 4. Ferma il cronometro quando l'import risulta completato
date -u +"fine: %H:%M:%S"
```

### Verifiche di integrità

Non basta che l'import termini senza errori: bisogna guardare i dati.

```bash
# Conteggi per collezione, da confrontare con la produzione
for c in profiles schedine matchdays wallet_transactions leagues prizes; do
  echo -n "$c: "
  gcloud firestore documents list --collection-ids="$c" --limit=1000 \
    --format='value(name)' | wc -l
done
```

Poi, puntando il frontend al progetto di prova:

- [ ] login funzionante
- [ ] classifica popolata e coerente
- [ ] una schedina già valutata mostra gli stessi punti della produzione
- [ ] saldo gettoni di un utente noto invariato
- [ ] `wallet_transactions` coerente con il saldo (somma = coins)

## 3. Verbale di restore

Da compilare a ogni prova e da conservare. **Prossima prova entro 90 giorni.**

```
TEST DI RESTORE
Data: ....................  Eseguito da: ....................
Backup usato: ....................  Ambiente: progetto di prova isolato

Inizio: ......:......   Fine: ......:......
RTO misurato: ......:......   (obiettivo T1: < 4 h)
Timestamp ultimo dato recuperato: ....................
RPO misurato: ......:......   (obiettivo: < 24 h)

VERIFICHE
  [ ] conteggi per collezione allineati
  [ ] login funzionante
  [ ] classifica coerente
  [ ] saldo gettoni verificato su utente campione
  [ ] wallet_transactions coerente con il saldo

ESITO: PASS / FAIL
Problemi riscontrati: ....................
Prossimo test entro: ....................
```

## 4. Ripristino in emergenza sulla produzione

Da usare solo dopo una perdita di dati confermata, con il servizio fermo.

1. **Metti il servizio in manutenzione.** Su Vercel: `vercel rollback` a una
   build con banner di manutenzione, oppure disabilita temporaneamente le
   Cloud Functions con `gcloud functions delete` sulle sole callable di scrittura.
2. **Annota l'istante del danno** — serve per il PITR.
3. Ripristino puntuale (entro 7 giorni, preferibile: perde meno dati):
   ```bash
   gcloud firestore databases restore \
     --source-database='(default)' \
     --destination-database='recovered' \
     --snapshot-time='2026-07-26T09:00:00Z'
   ```
   Verifica i dati sul database `recovered` **prima** di ripuntarci l'app.
4. In alternativa, ripristino da export (perde fino a 24 h):
   ```bash
   gcloud firestore import gs://fantaschedina-backups/daily/<TIMESTAMP>
   ```
5. Riattiva il servizio e comunica agli utenti l'eventuale finestra di dati persi.
