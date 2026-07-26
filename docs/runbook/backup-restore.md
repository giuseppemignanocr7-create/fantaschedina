# Backup e restore

> Un backup non testato non è un backup: è un file.
> Questo runbook non è completo finché non hai eseguito **almeno un restore**
> e compilato il verbale in fondo.

## 0. Stato attuale

*Configurato il 26 luglio 2026 tramite Firebase CLI.*

| Protezione | Stato | Valore |
|---|---|---|
| Point-in-time recovery | ✅ attivo | retention 7 giorni (`604800s`) |
| Delete protection | ✅ attiva | il database non è cancellabile |
| Backup gestiti | ✅ attivi | giornalieri, retention 7 giorni |
| Export offsite su GCS | ❌ non configurato | vedi §1.2, opzionale |
| Restore provato | ❌ **mai eseguito** | vedi §2 |

Database: `(default)`, location **`eur3`** (multi-region Europa), edition
STANDARD, free tier.

Verifica rapida:

```bash
firebase firestore:databases:get "(default)"
firebase firestore:backups:schedules:list
firebase firestore:backups:list
```

> **`eur3`, non `europe-west1`.** Le Cloud Functions girano in
> `europe-west1`, il database no. Un bucket di export creato nella region
> sbagliata fa fallire l'export con un errore poco chiaro.

## 1. Configurazione iniziale (una tantum)

### 1.1 PITR, delete protection e backup gestiti — già fatto

PITR riporta il database a un istante qualsiasi degli ultimi 7 giorni: è la
difesa contro l'errore umano (una migrazione sbagliata, una cancellazione di
massa). I backup gestiti sono snapshot giornalieri indipendenti.

Comandi usati, riportati per poterli rieseguire su un altro progetto:

```bash
firebase firestore:databases:update "(default)" \
  --point-in-time-recovery ENABLED \
  --delete-protection ENABLED

firebase firestore:backups:schedules:create \
  --database "(default)" --recurrence DAILY --retention 7d
```

> Con delete protection attiva, `firebase firestore:databases:delete` viene
> rifiutato. Per cancellare davvero il database bisogna prima disattivarla:
> è esattamente l'attrito che serve.

### 1.2 Export offsite su GCS (opzionale, non configurato)

I backup gestiti vivono dentro lo stesso progetto Google Cloud. Proteggono da
errore umano sui dati, **non** dalla perdita o sospensione del progetto. Per
coprire anche quel caso serve un export su un bucket, idealmente in un altro
progetto.

Richiede `gcloud`. Rimandabile per la beta chiusa; necessario prima
dell'apertura al pubblico.

```bash
gcloud config set project fantaschedina-4a1b2

# La location deve corrispondere a quella del database: eur3.
gcloud storage buckets create gs://fantaschedina-backups \
  --location=eur3 \
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

## 1bis. Restore dai backup gestiti (metodo attuale)

Il restore di un backup gestito **crea sempre un database nuovo**: non
sovrascrive `(default)`. È una proprietà utile, perché permette di verificare i
dati prima di spostare il traffico.

```bash
# 1. Elenca i backup disponibili
firebase firestore:backups:list

# 2. Ripristina in un database nuovo
firebase firestore:databases:restore \
  --backup projects/fantaschedina-4a1b2/locations/eur3/backups/<BACKUP_ID> \
  --database restore-test

# 3. Ispeziona restore-test dalla console prima di qualsiasi switch

# 4. A verifica conclusa, elimina il database di prova per non pagarlo
firebase firestore:databases:delete restore-test
```

Per far puntare l'app al database ripristinato serve modificare
l'inizializzazione di Firestore (client e functions) indicando il database ID:
non è un'operazione istantanea. Se l'obiettivo è tornare indietro nel tempo su
`(default)`, usa PITR.

### Restore PITR su `(default)`

Copre gli ultimi 7 giorni con granularità al minuto. Anche qui l'output è un
database nuovo:

```bash
firebase firestore:databases:restore \
  --source-database "(default)" \
  --snapshot-time 2026-07-26T09:30:00Z \
  --database recovery-20260726
```

> `--snapshot-time` deve essere successivo a `earliestVersionTime`, leggibile
> con `firebase firestore:databases:get "(default)"`. Prima di quell'istante i
> dati non esistono più.

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
