import { Link } from 'react-router-dom';
import { ArrowLeft, ShoppingBag, Clock, Sparkles } from 'lucide-react';

/**
 * Negozio — anteprima, non operativo.
 *
 * La versione precedente mostrava prezzi in euro, un carrello e le diciture
 * "Spedizione 48h" e "Pagamento sicuro" su un checkout che non esisteva: nessun
 * pulsante era collegato a un flusso di pagamento. Erano affermazioni
 * commerciali non veritiere.
 *
 * Questa versione mostra solo cosa arrivera'. Finche' non ci sono un gestore
 * dei pagamenti, una politica di reso e i dati del venditore, qui non devono
 * comparire prezzi ne' azioni che somiglino a un acquisto.
 */

interface PreviewItem {
  emoji: string;
  name: string;
  desc: string;
}

const PREVIEW: { category: string; items: PreviewItem[] }[] = [
  {
    category: 'Magliette',
    items: [
      { emoji: '👕', name: 'Classic', desc: 'Cotone biologico, logo ricamato.' },
      { emoji: '👕', name: 'Gold Edition', desc: 'Edizione limitata con stampa dorata.' },
      { emoji: '👕', name: 'Away Kit', desc: 'Bianca con dettagli lime.' },
    ],
  },
  {
    category: 'Gadget',
    items: [
      { emoji: '☕', name: 'Tazza', desc: 'Ceramica 350ml, logo sui due lati.' },
      { emoji: '🧣', name: 'Sciarpa', desc: 'In pile, due colori.' },
      { emoji: '⚽', name: 'Pallone', desc: 'Riproduzione ufficiale, taglia 5.' },
    ],
  },
  {
    category: 'Accessori',
    items: [
      { emoji: '🧢', name: 'Cappellino', desc: 'Snapback regolabile, logo ricamato.' },
      { emoji: '🍶', name: 'Borraccia', desc: 'Acciaio inox 750ml.' },
      { emoji: '📱', name: 'Cover', desc: 'Rigida, iPhone e Samsung.' },
    ],
  },
];

export function NegozioPage() {
  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-5">

        <div className="flex items-center gap-2">
          <Link
            to="/"
            className="p-2 -ml-2 text-white/40 hover:text-white transition-colors"
            aria-label="Torna alla home"
          >
            <ArrowLeft size={20} />
          </Link>
          <h1 className="font-display font-black text-xl text-white tracking-tight">
            Negozio
          </h1>
        </div>

        <section className="relative overflow-hidden rounded-2xl border border-primary-500/25 bg-gradient-to-br from-[#0c2a14] via-[#0a2010] to-[#061508] px-5 py-8 text-center">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary-400/40 to-transparent" />

          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-500/15 ring-1 ring-primary-500/30">
            <ShoppingBag size={26} className="text-primary-400" strokeWidth={1.8} />
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary-500/30 bg-primary-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-primary-300">
            <Clock size={11} strokeWidth={2.5} />
            Prossimamente
          </span>

          <h2 className="mt-3 font-display text-2xl font-black tracking-tight text-white">
            Il merchandising ufficiale sta arrivando
          </h2>

          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-white/55">
            Stiamo preparando il catalogo e la spedizione. Il negozio non è
            ancora attivo: al momento non è possibile effettuare ordini.
          </p>
        </section>

        <section aria-labelledby="anteprima-titolo" className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles size={15} className="text-primary-400" strokeWidth={2} />
            <h3
              id="anteprima-titolo"
              className="text-[11px] font-black uppercase tracking-widest text-white/45"
            >
              Anteprima del catalogo
            </h3>
          </div>

          {PREVIEW.map(group => (
            <div key={group.category} className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">
                {group.category}
              </p>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {group.items.map(item => (
                  <li
                    key={item.name}
                    className="rounded-xl border border-white/8 bg-white/[0.03] p-3"
                  >
                    <div className="mb-1.5 text-2xl leading-none opacity-70" aria-hidden>
                      {item.emoji}
                    </div>
                    <p className="text-[13px] font-bold text-white/85">{item.name}</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-white/40">
                      {item.desc}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <p className="text-[11px] leading-relaxed text-white/35">
            Immagini e descrizioni sono indicative. Prezzi, disponibilità e
            modalità di consegna verranno pubblicati all'apertura del negozio.
          </p>
        </section>

        <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-center">
          <p className="text-sm text-white/60">
            Nel frattempo puoi usare i gettoni nella sezione premi.
          </p>
          <Link
            to="/premi"
            className="mt-3 inline-flex items-center justify-center rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-bold text-background transition-colors hover:bg-primary-400"
          >
            Vai ai Premi
          </Link>
        </section>

      </div>
    </div>
  );
}
