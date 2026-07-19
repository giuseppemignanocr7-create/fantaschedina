import { cn } from '@/lib/utils';

export interface Sponsor {
  name: string;
  tagline?: string;
  /** Colore accento del brand (hex). */
  accent?: string;
  /** Link esterno opzionale. */
  href?: string;
}

interface SponsorTickerProps {
  sponsors?: Sponsor[];
  className?: string;
}

// Nessun sponsor fittizio: la striscia viene renderizzata solo se
// il consumer passa un array di sponsor reali.
const DEFAULT_SPONSORS: Sponsor[] = [];

function SponsorPill({ s }: { s: Sponsor }) {
  const accent = s.accent ?? '#84d80c';
  const content = (
    <div className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-surface/80 border border-white/8 hover:border-white/15 transition-colors">
      <span
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: accent, boxShadow: `0 0 8px ${accent}80` }}
      />
      <div className="leading-tight whitespace-nowrap">
        <p className="text-[11px] font-black uppercase tracking-wide" style={{ color: accent }}>
          {s.name}
        </p>
        {s.tagline && <p className="text-[8px] text-white/40 uppercase tracking-wider">{s.tagline}</p>}
      </div>
    </div>
  );
  if (s.href) {
    return (
      <a href={s.href} target="_blank" rel="noopener noreferrer">
        {content}
      </a>
    );
  }
  return content;
}

/**
 * Striscia sponsor scorrevole (marquee) infinita e seamless.
 * Il contenuto è duplicato: l'animazione trasla del -50% per un loop senza stacco.
 * Si mette in pausa al passaggio del mouse.
 */
export function SponsorTicker({ sponsors = DEFAULT_SPONSORS, className }: SponsorTickerProps) {
  if (sponsors.length === 0) return null;
  const loop = [...sponsors, ...sponsors];
  return (
    <div className={cn('relative overflow-hidden', className)}>
      {/* Fade laterali */}
      <div className="absolute left-0 top-0 bottom-0 w-10 z-10 bg-gradient-to-r from-background to-transparent pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-10 z-10 bg-gradient-to-l from-background to-transparent pointer-events-none" />
      <div className="flex w-max animate-marquee hover:[animation-play-state:paused] gap-3">
        {loop.map((s, i) => (
          <SponsorPill key={`${s.name}-${i}`} s={s} />
        ))}
      </div>
    </div>
  );
}
