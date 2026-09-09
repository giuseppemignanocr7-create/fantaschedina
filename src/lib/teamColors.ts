// Colori sociali delle squadre, usati solo per colorare i nomi nelle card
// (home, mockup 09/09/2026). Nessun impatto sul dominio: se una squadra non
// è in elenco si ricade sul grigio neutro, leggibile su fondo bianco.
const TEAM_COLORS: Record<string, string> = {
  ata: '#1e40af', // Atalanta
  bol: '#a4243b', // Bologna
  cag: '#9b1b30', // Cagliari
  com: '#1b4ea0', // Como
  emp: '#1668b3', // Empoli
  fio: '#7b2f8f', // Fiorentina
  gen: '#9e1b32', // Genoa
  int: '#12408f', // Inter
  juv: '#1f2937', // Juventus
  laz: '#3f88c5', // Lazio
  lec: '#b8860b', // Lecce
  mil: '#c8102e', // Milan
  mon: '#b3121f', // Monza
  nap: '#0f86c6', // Napoli
  par: '#1b64b0', // Parma
  rom: '#8e1f2f', // Roma
  tor: '#8b1a1a', // Torino
  udi: '#111827', // Udinese
  ven: '#15803d', // Venezia
  ver: '#1f4b99', // Verona
};

const FALLBACK = '#334155';

/** Colore sociale della squadra a partire da id o sigla (es. `fio`, `FIO`). */
export function teamColor(key?: string): string {
  if (!key) return FALLBACK;
  return TEAM_COLORS[key.toLowerCase()] ?? FALLBACK;
}
