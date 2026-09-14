// Categorie di notifica mostrate all'utente.
// Tenere allineata a functions/src/notify.ts (fonte di verità server).

export type CategoriaNotifica = 'schedina' | 'giro' | 'live' | 'esito' | 'social';

export interface CategoriaInfo {
  id: CategoriaNotifica;
  nome: string;
  dettaglio: string;
  emoji: string;
}

export const CATEGORIE_NOTIFICA: CategoriaInfo[] = [
  { id: 'schedina', nome: 'Schedina', dettaglio: 'Quando sta per chiudere e non hai giocato', emoji: '⏰' },
  { id: 'giro', nome: 'Giro quotidiano', dettaglio: 'Quiz e ruota gratis, mattina e pomeriggio', emoji: '🎮' },
  { id: 'live', nome: 'Partite in diretta', dettaglio: 'Gol che ribaltano i tuoi pronostici ed esiti', emoji: '⚽' },
  { id: 'esito', nome: 'Giornata valutata', dettaglio: 'I tuoi punti e la posizione in classifica', emoji: '🏁' },
  { id: 'social', nome: 'Leghe e premi', dettaglio: 'Duelli, estrazioni, inviti', emoji: '🏆' },
];

export type PrefNotifiche = Partial<Record<CategoriaNotifica, boolean>>;

/** Senza preferenze salvate tutto è attivo: chi non sceglie riceve tutto. */
export function categoriaAttiva(prefs: PrefNotifiche | undefined | null, cat: CategoriaNotifica): boolean {
  return prefs?.[cat] !== false;
}
