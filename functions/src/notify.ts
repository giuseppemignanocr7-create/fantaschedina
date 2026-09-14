// ============================================
// NOTIFICHE — regole e testi
//
// Logica pura, senza Firestore: si prova con i test unitari. Qui stanno
// le categorie, le preferenze, le ore di silenzio, i tetti giornalieri e
// il repertorio dei testi.
//
// Il principio: una notifica deve riguardare chi la riceve, arrivare quando
// serve e non ripetersi uguale. Un avviso identico tutti i giorni smette di
// essere letto dopo tre volte.
// ============================================

export type Categoria = 'schedina' | 'giro' | 'live' | 'esito' | 'social';

export const CATEGORIE: { id: Categoria; nome: string; dettaglio: string }[] = [
  { id: 'schedina', nome: 'Schedina', dettaglio: 'Quando sta per chiudere e non hai giocato' },
  { id: 'giro', nome: 'Giro quotidiano', dettaglio: 'Quiz e ruota gratis, mattina e pomeriggio' },
  { id: 'live', nome: 'Partite in diretta', dettaglio: 'Gol che cambiano i tuoi pronostici ed esiti' },
  { id: 'esito', nome: 'Giornata valutata', dettaglio: 'I tuoi punti e la tua posizione' },
  { id: 'social', nome: 'Leghe e sfide', dettaglio: 'Sorpassi, inviti, duelli, premi' },
];

export type PrefNotifiche = Partial<Record<Categoria, boolean>>;

/** Senza preferenze salvate tutto e' attivo: chi non sceglie riceve tutto. */
export function categoriaAttiva(prefs: PrefNotifiche | undefined | null, cat: Categoria): boolean {
  return prefs?.[cat] !== false;
}

/** Tetto giornaliero per categoria: oltre, la notifica finisce solo in casella. */
export const TETTI: Record<Categoria, number> = {
  schedina: 2,
  giro: 2,
  live: 6,
  esito: 3,
  social: 5,
};

/**
 * Ore di silenzio: fra le 23 e le 8 niente push. La copia in casella si
 * scrive lo stesso, cosi' al risveglio la campanella ha tutto.
 */
export function inOreDiSilenzio(oraRoma: number): boolean {
  return oraRoma >= 23 || oraRoma < 8;
}

/** Ora di Roma (0-23) da un istante qualsiasi. */
export function oraDiRoma(d: Date): number {
  return Number(
    new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', hour12: false }).format(d)
  );
}

/**
 * Sceglie una frase dal repertorio in modo stabile: stesso seme, stessa
 * frase. Il seme e' di solito uid+giorno, cosi' due persone lo stesso
 * giorno leggono testi diversi e la stessa persona non vede due volte di
 * fila la stessa formula.
 */
export function scegli<T>(opzioni: readonly T[], seme: string): T {
  let h = 0;
  for (let i = 0; i < seme.length; i++) h = (h * 31 + seme.charCodeAt(i)) >>> 0;
  return opzioni[h % opzioni.length];
}

// ---------- Repertorio ----------

const GIRO_MATTINA = [
  'Il caffè l’hai preso, il giro gratis no',
  'Buongiorno: quiz e ruota ti aspettano',
  'Due minuti adesso, gettoni per tutta la giornata',
] as const;

const GIRO_SERA = [
  'Non chiudere la giornata a mani vuote',
  'Ultimo giro: quiz e ruota scadono a mezzanotte',
  'Ci sono ancora gettoni con il tuo nome sopra',
] as const;

const PRESA = ['Campione.', 'Che occhio.', 'Letta benissimo.', 'Sapevi già tutto.'] as const;
const SBAGLIATA = ['Questa no.', 'Niente da fare.', 'Ci sta.', 'Va storta a tutti.'] as const;
const SORPASSO_SU = ['Sorpasso!', 'Avanti tutta.', 'Scalata.'] as const;
const SORPASSO_SUBITO = ['Ti hanno soffiato il posto.', 'Sorpasso subìto.', 'Serve una risposta.'] as const;

export interface Testo {
  title: string;
  body: string;
}

/** Promemoria del giro quotidiano: dice cosa manca davvero. */
export function testoGiro(
  momento: 'mattina' | 'sera',
  mancanti: { quiz: boolean; ruota: boolean },
  massimo: number,
  seme: string
): Testo | null {
  if (!mancanti.quiz && !mancanti.ruota) return null;
  const cosa =
    mancanti.quiz && mancanti.ruota
      ? 'Quiz e ruota'
      : mancanti.quiz
      ? 'Il quiz'
      : 'La ruota';
  const frase = scegli(momento === 'mattina' ? GIRO_MATTINA : GIRO_SERA, seme);
  return {
    title: momento === 'mattina' ? '🎮 Il tuo giro gratis' : '🌙 Ultimo giro di oggi',
    body: `${frase} ${cosa} ${mancanti.quiz && mancanti.ruota ? 'valgono' : 'vale'} fino a ${massimo} gettoni.`,
  };
}

export interface EsitoPartita {
  label: string;
  score: string;
  corretto: boolean;
}

/** Esiti delle partite appena chiuse, raggruppati in un solo avviso. */
export function testoEsiti(esiti: EsitoPartita[], seme: string): Testo | null {
  if (esiti.length === 0) return null;
  if (esiti.length === 1) {
    const e = esiti[0];
    const frase = scegli(e.corretto ? PRESA : SBAGLIATA, seme);
    return {
      title: `${e.corretto ? '✅' : '❌'} ${e.label} ${e.score}`,
      body: `${frase} ${e.corretto ? 'Pronostico indovinato.' : 'Il pronostico non è passato.'}`,
    };
  }
  const prese = esiti.filter(e => e.corretto).length;
  const dettaglio = esiti.map(e => `${e.corretto ? '✅' : '❌'} ${e.label} ${e.score}`).join(' · ');
  return {
    title: `🏁 ${prese} su ${esiti.length} ${prese === esiti.length ? '· en plein' : ''}`.trim(),
    body: dettaglio,
  };
}

export interface CambioPartita {
  label: string;
  score: string;
  oraCorretto: boolean;
}

/** Un gol ha ribaltato un pronostico: l'avviso piu' emozionante che abbiamo. */
export function testoCambio(cambi: CambioPartita[], seme: string): Testo | null {
  if (cambi.length === 0) return null;
  // Se piu' partite cambiano insieme, si racconta quella buona: una
  // notifica che da' una notizia bella viene aperta, una che ne da' tre no.
  const c = cambi.find(x => x.oraCorretto) ?? cambi[0];
  const altri = cambi.length - 1;
  const coda = altri > 0 ? ` (e altre ${altri} si muovono)` : '';
  if (c.oraCorretto) {
    return {
      title: `🔥 ${c.label} ${c.score}`,
      body: `${scegli(PRESA, seme)} Il tuo pronostico è tornato avanti${coda}.`,
    };
  }
  return {
    title: `😱 ${c.label} ${c.score}`,
    body: `Il tuo pronostico è saltato${coda}. C'è tempo per rifarsi.`,
  };
}

/** Giornata valutata: punti e posizione in una riga sola. */
export function testoGiornata(
  giornata: number,
  punti: number,
  posizione: number | null,
  variazione: number | null,
  seme: string
): Testo {
  const p = punti.toFixed(1).replace('.0', '');
  let body = `Hai fatto ${p} punti.`;
  if (posizione != null) {
    if (posizione === 1) body += ' Sei in testa alla classifica. 🥇';
    else if (variazione != null && variazione > 0)
      body += ` ${scegli(SORPASSO_SU, seme)} Sei ${posizione}° (+${variazione}).`;
    else if (variazione != null && variazione < 0)
      body += ` ${scegli(SORPASSO_SUBITO, seme)} Sei ${posizione}° (${variazione}).`;
    else body += ` Sei ${posizione}° in classifica.`;
  }
  return { title: `🏁 Giornata ${giornata} valutata`, body };
}
