// Traduzione delle causali di wallet_transactions in italiano leggibile.
// Modulo puro, senza Firebase: cosi' si prova nei test unitari, che girano
// in CI senza le variabili d'ambiente del progetto.

/** Causale leggibile a partire dal `reason` scritto dal server. */
export function etichettaCausale(reason: string): string {
  const g = reason.match(/_g(\d+)$/)?.[1];
  const giornata = g ? ` giornata ${g}` : '';
  if (reason.startsWith('settlement')) return `Punti della${giornata}`;
  if (reason.startsWith('powerups_refund')) return `Rimborso power-up${giornata}`;
  if (reason.startsWith('powerup_lastminute')) return `Cambio last-minute${giornata}`;
  if (reason.startsWith('powerups')) return `Power-up${giornata}`;
  if (reason.startsWith('raffle')) return `Biglietti estrazione${giornata}`;
  if (reason.startsWith('mission')) return 'Missione completata';
  if (reason.includes('quiz')) return 'Quiz calcio';
  if (reason.includes('ruota') || reason.includes('wheel')) return 'Ruota della fortuna';
  if (reason.includes('rigori') || reason.includes('penalty_shoot')) return 'Rigori';
  if (reason.includes('memoria')) return 'Memoria calcio';
  if (reason.includes('sfida')) return 'Sfida 1vs1';
  if (reason.includes('duel')) return reason.includes('draw') ? 'Duello: pareggio' : 'Duello vinto';
  if (reason.includes('weekly') || reason.includes('winner')) return 'Vincitore di giornata';
  if (reason.includes('starting') || reason.includes('welcome')) return 'Bonus di benvenuto';
  return reason.replace(/_/g, ' ');
}
