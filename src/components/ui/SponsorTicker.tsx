import { useEffect, useState } from 'react';
import { Megaphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';

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
    <div className="flex items-center gap-3 px-5 py-2.5 rounded-xl bg-surface/90 border border-white/10 hover:border-white/25 transition-all hover:scale-[1.03] shadow-lg">
      <span
        className="w-2.5 h-2.5 rounded-full flex-shrink-0 animate-pulse"
        style={{ backgroundColor: accent, boxShadow: `0 0 10px ${accent}` }}
      />
      <div className="leading-tight whitespace-nowrap">
        <p className="text-sm font-black uppercase tracking-wide" style={{ color: accent }}>
          {s.name}
        </p>
        {s.tagline && <p className="text-[10px] text-white/50 uppercase tracking-wider font-bold">{s.tagline}</p>}
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
      <div className="absolute left-0 top-0 bottom-0 w-12 z-10 bg-gradient-to-r from-background to-transparent pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-12 z-10 bg-gradient-to-l from-background to-transparent pointer-events-none" />
      <div className="flex w-max animate-marquee hover:[animation-play-state:paused] gap-4 py-1">
        {loop.map((s, i) => (
          <SponsorPill key={`${s.name}-${i}`} s={s} />
        ))}
      </div>
    </div>
  );
}

/**
 * SponsorBanner: fetches active sponsors from Firestore and renders
 * a prominent scrolling marquee bar. Auto-updates in realtime.
 */
export function SponsorBanner() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'sponsors'), where('active', '==', true));
    const unsub = onSnapshot(q, snap => {
      const list: Sponsor[] = snap.docs.map(d => {
        const data = d.data();
        return {
          name: data.name as string,
          tagline: data.tagline as string | undefined,
          accent: data.accent as string | undefined,
          href: data.href as string | undefined,
        };
      });
      setSponsors(list);
    });
    return () => unsub();
  }, []);

  if (sponsors.length === 0) return null;

  return (
    <div className="sticky top-14 z-20 bg-surface/95 backdrop-blur-md border-b border-white/8">
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="flex items-center gap-1.5 flex-shrink-0 pr-2 border-r border-white/8">
          <Megaphone size={16} className="text-primary-400 animate-wiggle" />
          <span className="text-[10px] font-black uppercase tracking-widest text-primary-400 hidden sm:block">Sponsor</span>
        </div>
        <SponsorTicker sponsors={sponsors} className="flex-1" />
      </div>
    </div>
  );
}
