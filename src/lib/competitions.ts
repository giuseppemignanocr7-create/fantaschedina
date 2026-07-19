// ============================================
// FANTA SCHEDINA - CATALOGO CAMPIONATI (client)
// Etichette/badge UI. La lista degli attivi arriva dal server
// (adminManageCompetitionsFn) — qui solo nome + codice per il display.
// Tenere allineato a functions/src/config.ts COMPETITIONS.
// ============================================

export interface CompetitionInfo {
  code: string;
  name: string;
}

export const COMPETITIONS: CompetitionInfo[] = [
  { code: 'ita.1', name: 'Serie A' },
  { code: 'eng.1', name: 'Premier League' },
  { code: 'esp.1', name: 'La Liga' },
  { code: 'ger.1', name: 'Bundesliga' },
  { code: 'fra.1', name: 'Ligue 1' },
  { code: 'uefa.champions', name: 'Champions League' },
  { code: 'uefa.europa', name: 'Europa League' },
  { code: 'ita.coppa_italia', name: 'Coppa Italia' },
];

const BY_CODE = new Map(COMPETITIONS.map(c => [c.code, c.name]));

export function competitionName(code: string): string {
  return BY_CODE.get(code) ?? code;
}
