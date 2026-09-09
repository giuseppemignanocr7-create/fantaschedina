import { useEffect, useState } from 'react';
import { ChevronRight, Megaphone } from 'lucide-react';
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

// Sponsor demo mostrati SOLO come segnaposto quando non ci sono ancora
// sponsor reali attivi su Firestore (collezione `sponsors`, gestita da
// AdminPage). Non linkano da nessuna parte: nessun href, quindi nessun
// link morto. Da rimuovere quando arrivano i primi sponsor veri.
const DEMO_SPONSORS: Sponsor[] = [
  { name: 'GoalZone', tagline: 'Abbigliamento sportivo', accent: '#3b82f6' },
  { name: 'MaxEnergy', tagline: 'Energy drink ufficiale', accent: '#f59e0b' },
];

/**
 * Card sponsor: badge colorato con l'iniziale del brand, nome in tinta e
 * claim sotto. `fill` la fa espandere nella griglia statica, altrimenti
 * resta a larghezza fissa per scorrere nel marquee.
 */
function SponsorCard({ s, fill = false }: { s: Sponsor; fill?: boolean }) {
  const accent = s.accent ?? '#84d80c';
  const content = (
    <div
      className={cn(
        'flex items-center gap-2 px-2.5 py-2 rounded-xl bg-night-surface border transition-all hover:brightness-125',
        fill ? 'w-full' : 'w-[230px] flex-shrink-0'
      )}
      style={{ borderColor: `${accent}33`, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.04)` }}
    >
      <span
        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 font-display font-black italic text-[13px]"
        style={{ backgroundColor: `${accent}22`, color: accent, boxShadow: `0 0 12px ${accent}33` }}
        aria-hidden
      >
        {s.name.slice(0, 1).toUpperCase()}
      </span>
      <div className="leading-tight min-w-0 flex-1">
        <p
          className="text-[11px] font-display font-black italic uppercase tracking-tight truncate"
          style={{ color: accent }}
        >
          {s.name}
        </p>
        {s.tagline && (
          <p className="text-[7px] text-white/45 uppercase tracking-tight font-semibold truncate">{s.tagline}</p>
        )}
      </div>
      {s.href && <ChevronRight size={12} className="text-white/25 flex-shrink-0" />}
    </div>
  );
  if (s.href) {
    return (
      <a href={s.href} target="_blank" rel="noopener noreferrer" className={fill ? 'block w-full' : undefined}>
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
      <div className="absolute left-0 top-0 bottom-0 w-12 z-10 bg-gradient-to-r from-night to-transparent pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-12 z-10 bg-gradient-to-l from-night to-transparent pointer-events-none" />
      <div className="flex w-max animate-marquee hover:[animation-play-state:paused] gap-3 py-1">
        {loop.map((s, i) => (
          <SponsorCard key={`${s.name}-${i}`} s={s} />
        ))}
      </div>
    </div>
  );
}

/**
 * SponsorBanner: legge gli sponsor attivi da Firestore e li mostra sotto
 * l'header. Fino a due stanno affiancati e fermi (come da mockup); da tre in
 * su tornano a scorrere, altrimenti non ci starebbero.
 */
export function SponsorBanner() {
  const [sponsors, setSponsors] = useState<Sponsor[]>(DEMO_SPONSORS);

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
      // Finché non ci sono sponsor reali attivi, resta il placeholder demo.
      setSponsors(list.length > 0 ? list : DEMO_SPONSORS);
    });
    return () => unsub();
  }, []);

  if (sponsors.length === 0) return null;

  return (
    <div className="sticky top-14 z-20 bg-night/95 backdrop-blur-md border-b border-white/5">
      {sponsors.length <= 2 ? (
        <div className="max-w-2xl mx-auto grid grid-cols-2 gap-2.5 px-4 py-2.5">
          {sponsors.map(s => (
            <SponsorCard key={s.name} s={s} fill />
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2">
          <div className="flex items-center gap-1.5 flex-shrink-0 pr-2 border-r border-white/10">
            <Megaphone size={16} className="text-primary-400 animate-wiggle" />
            <span className="text-[10px] font-black uppercase tracking-widest text-primary-400 hidden sm:block">Sponsor</span>
          </div>
          <SponsorTicker sponsors={sponsors} className="flex-1" />
        </div>
      )}
    </div>
  );
}
