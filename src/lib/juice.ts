import confetti from 'canvas-confetti';

/** Vibrazione tattile (mobile) */
export function vibrate(pattern: number | number[] = 30) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try { navigator.vibrate(pattern); } catch { /* noop */ }
  }
}

/** Esplosione classica per un successo (gol, risposta giusta) */
export function burstConfetti(origin?: { x: number; y: number }) {
  confetti({
    particleCount: 90,
    spread: 75,
    startVelocity: 38,
    origin: origin ?? { x: 0.5, y: 0.6 },
    colors: ['#10b981', '#34d399', '#fbbf24', '#ffffff'],
    zIndex: 9999,
    disableForReducedMotion: true,
  });
}

/** Pioggia di monete dorate (vincita gettoni) */
export function coinRain(durationMs = 1600) {
  const end = Date.now() + durationMs;
  const frame = () => {
    confetti({
      particleCount: 4,
      angle: 270,
      spread: 120,
      startVelocity: 18,
      gravity: 1.1,
      origin: { x: Math.random(), y: -0.1 },
      colors: ['#fbbf24', '#f59e0b', '#fde68a'],
      shapes: ['circle'],
      scalar: 1.15,
      zIndex: 9999,
      disableForReducedMotion: true,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  };
  frame();
}

/** Mega celebrazione (jackpot, punteggio perfetto) */
export function jackpotCelebration() {
  vibrate([60, 40, 60, 40, 120]);
  const defaults = { startVelocity: 32, spread: 360, ticks: 70, zIndex: 9999, disableForReducedMotion: true };
  let count = 0;
  const interval = setInterval(() => {
    count += 1;
    if (count > 6) { clearInterval(interval); return; }
    confetti({
      ...defaults,
      particleCount: 60,
      origin: { x: 0.15 + Math.random() * 0.7, y: 0.2 + Math.random() * 0.4 },
      colors: ['#fbbf24', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#ffffff'],
    });
  }, 320);
  coinRain(2200);
}

/** Doppio spruzzo laterale (fine partita positiva) */
export function sideCannons() {
  const opts = { particleCount: 55, spread: 60, startVelocity: 45, zIndex: 9999, disableForReducedMotion: true };
  confetti({ ...opts, angle: 60, origin: { x: 0, y: 0.7 } });
  confetti({ ...opts, angle: 120, origin: { x: 1, y: 0.7 } });
}
