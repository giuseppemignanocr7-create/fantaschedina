import { Link } from 'react-router-dom';
import { ArrowLeft, ShoppingBag, Clock, Sparkles, Shirt } from 'lucide-react';

import magliaGara from '@/assets/store/maglia-gara.jpg';
import tshirtTraining from '@/assets/store/tshirt-training.jpg';
import felpaCappuccio from '@/assets/store/felpa-cappuccio.jpg';
import tutaCompleta from '@/assets/store/tuta-completa.jpg';
import cappellinoSnapback from '@/assets/store/cappellino-snapback.jpg';
import cappellinoBaseball from '@/assets/store/cappellino-baseball.jpg';
import cuffiaInvernale from '@/assets/store/cuffia-invernale.jpg';
import sciarpa from '@/assets/store/sciarpa.jpg';
import borsone from '@/assets/store/borsone.jpg';
import zaino from '@/assets/store/zaino.jpg';
import sacca from '@/assets/store/sacca.jpg';
import borraccia from '@/assets/store/borraccia.jpg';
import tazza from '@/assets/store/tazza.jpg';

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
  img: string;
  name: string;
  desc: string;
  alt: string;
}

const PREVIEW: { category: string; items: PreviewItem[] }[] = [
  {
    category: 'Abbigliamento',
    items: [
      {
        img: tshirtTraining,
        name: 'T-shirt Training',
        desc: 'Girocollo tecnica, grafica a pennellate.',
        alt: 'T-shirt da allenamento nera con grafica verde lime e logo FS',
      },
      {
        img: felpaCappuccio,
        name: 'Felpa con Cappuccio',
        desc: 'Cappuccio foderato lime e tasca a marsupio.',
        alt: 'Felpa nera con cappuccio, logo FS e scritta Fantaschedina',
      },
      {
        img: tutaCompleta,
        name: 'Tuta Completa',
        desc: 'Giacca full zip e pantalone coordinato.',
        alt: 'Tuta sportiva nera composta da giacca e pantaloni con dettagli verdi',
      },
    ],
  },
  {
    category: 'Cappelli',
    items: [
      {
        img: cappellinoSnapback,
        name: 'Snapback',
        desc: 'Visiera piatta lime, chiusura regolabile.',
        alt: 'Cappellino snapback nero con visiera piatta verde e logo FS',
      },
      {
        img: cappellinoBaseball,
        name: 'Baseball',
        desc: 'Visiera curva, grafica laterale.',
        alt: 'Cappellino da baseball nero con visiera curva e grafica verde',
      },
      {
        img: cuffiaInvernale,
        name: 'Cuffia Invernale',
        desc: 'Berretto a maglia con pon-pon.',
        alt: 'Cuffia invernale nera con pon-pon verde e logo FS',
      },
    ],
  },
  {
    category: 'Borse',
    items: [
      {
        img: borsone,
        name: 'Borsone',
        desc: 'Manici e tracolla removibile.',
        alt: 'Borsone sportivo nero con manici verdi e scritta Fantaschedina',
      },
      {
        img: zaino,
        name: 'Zaino',
        desc: 'Scomparto imbottito e tasca frontale.',
        alt: 'Zaino nero con grafica verde e logo FS',
      },
      {
        img: sacca,
        name: 'Sacca',
        desc: 'Sacca a coulisse, leggera.',
        alt: 'Sacca a coulisse nera con logo FS e scritta Fantaschedina',
      },
    ],
  },
  {
    category: 'Accessori',
    items: [
      {
        img: sciarpa,
        name: 'Sciarpa',
        desc: 'Doppio lato, con frange.',
        alt: 'Sciarpa da stadio nera e verde con scritta Fantaschedina',
      },
      {
        img: borraccia,
        name: 'Borraccia',
        desc: 'Tappo a pressione, uso sportivo.',
        alt: 'Borraccia sportiva nera con logo FS',
      },
      {
        img: tazza,
        name: 'Tazza',
        desc: 'Ceramica, logo su entrambi i lati.',
        alt: 'Tazza in ceramica nera con logo FS e braccialetto abbinato',
      },
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

        <section
          aria-labelledby="maglia-titolo"
          className="overflow-hidden rounded-2xl border border-white/8 bg-white/[0.03]"
        >
          <div className="bg-white p-3">
            <img
              src={magliaGara}
              alt="Maglia da gara nera e verde, fronte con logo Fantaschedina e retro personalizzabile con nome e numero"
              className="mx-auto h-auto w-full max-w-md object-contain"
              width={699}
              height={568}
              loading="lazy"
              decoding="async"
            />
          </div>
          <div className="flex items-start gap-3 p-4">
            <Shirt size={18} className="mt-0.5 flex-shrink-0 text-primary-400" strokeWidth={2} />
            <div>
              <h3 id="maglia-titolo" className="font-display text-base font-black text-white">
                Maglia da Gara
              </h3>
              <p className="mt-1 text-[13px] leading-relaxed text-white/55">
                Il pezzo principale della collezione. Sul retro potrai far
                stampare il tuo nome e il tuo numero.
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby="anteprima-titolo" className="space-y-5">
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
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {group.items.map(item => (
                  <li
                    key={item.name}
                    className="overflow-hidden rounded-xl border border-white/8 bg-white/[0.03]"
                  >
                    {/* Le foto prodotto hanno sfondo bianco: su fondo scuro
                        sembrerebbero riquadri sbagliati. La tile chiara le
                        rende una scelta grafica invece che un difetto. */}
                    <div className="flex aspect-square items-center justify-center bg-white p-2">
                      <img
                        src={item.img}
                        alt={item.alt}
                        className="max-h-full max-w-full object-contain"
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                    <div className="p-2.5">
                      <p className="text-[12px] font-bold leading-tight text-white/85">
                        {item.name}
                      </p>
                      <p className="mt-0.5 text-[10px] leading-snug text-white/40">
                        {item.desc}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <p className="text-[11px] leading-relaxed text-white/35">
            Le immagini sono rendering di anteprima e il prodotto finale può
            differire. Prezzi, taglie disponibili e modalità di consegna
            verranno pubblicati all'apertura del negozio.
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
