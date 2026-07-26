// ============================================
// FANTA SCHEDINA — REGISTRO DEI TRATTAMENTI
// Fonte di verità unica per l'informativa privacy mostrata in `/privacy`
// e per il registro dei trattamenti in docs/privacy/registro.md.
// Se cambia un trattamento, si aggiorna qui e si allinea la documentazione.
// ============================================

export interface ProcessingActivity {
  purpose: string;
  data: string;
  legalBasis: string;
}

export interface Processor {
  name: string;
  role: string;
  location: string;
}

export const PRIVACY = {
  version: '1.0',
  lastUpdated: '26 luglio 2026',

  controller: {
    // TODO(prod): sostituire con la denominazione e l'indirizzo reali del titolare
    // prima dell'apertura al pubblico.
    name: 'FantaSchedina',
    email: 'privacy@fantaschedina.it',
  },

  processing: [
    {
      purpose: 'Creazione e gestione dell\'account',
      data: 'Email, nome utente',
      legalBasis: 'Esecuzione del contratto (art. 6.1.b)',
    },
    {
      purpose: 'Erogazione del gioco: schedine, punteggi, classifiche, gettoni',
      data: 'Pronostici, punteggi, transazioni virtuali',
      legalBasis: 'Esecuzione del contratto (art. 6.1.b)',
    },
    {
      purpose: 'Classifiche pubbliche e leghe',
      data: 'Nome utente, punteggi',
      legalBasis: 'Esecuzione del contratto (art. 6.1.b)',
    },
    {
      purpose: 'Sicurezza, prevenzione abusi e limitazione delle richieste',
      data: 'Identificativo utente, log tecnici, indirizzo IP',
      legalBasis: 'Legittimo interesse (art. 6.1.f)',
    },
    {
      purpose: 'Diagnostica errori e continuità del servizio',
      data: 'Log applicativi, identificativo utente pseudonimizzato',
      legalBasis: 'Legittimo interesse (art. 6.1.f)',
    },
  ] satisfies ProcessingActivity[],

  processors: [
    {
      name: 'Google Ireland Ltd (Firebase, Google Cloud)',
      role: 'autenticazione, database, funzioni serverless, backup',
      location: 'UE — europe-west1',
    },
    {
      name: 'Vercel Inc.',
      role: 'hosting e distribuzione del frontend',
      location: 'UE/USA — SCC + Data Privacy Framework',
    },
    {
      name: 'Functional Software Inc. (Sentry)',
      role: 'raccolta degli errori applicativi',
      location: 'UE — region.de',
    },
  ] satisfies Processor[],

  retention: {
    afterDeletionDays: 30,
    logsDays: 30,
    backupDays: 30,
  },
} as const;
