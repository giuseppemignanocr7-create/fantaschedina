// ============================================
// FANTA SCHEDINA - PRIMO ACCESSO
//
// Chi arriva vede nove tile colorate e deve indovinare cosa fa il gioco: il
// regolamento c'e', ma nessuno lo apre prima di aver capito se gli interessa.
// Tre schermate, saltabili, che dicono le uniche tre cose che servono per
// giocare la prima giornata (18/09/2026).
//
// Compare da sola solo a chi non ha ancora giocato nessuna giornata; resta
// riapribile dal menu con `/?guida=1`.
// ============================================

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthContext } from '@/contexts/AuthContext';

/** Cambiare la chiave fa rivedere la guida a tutti: solo se cambia il gioco. */
const CHIAVE = 'fs_guida_v1';

interface Schermata {
  emoji: string;
  titolo: string;
  testo: string;
  c1: string;
  c2: string;
}

const SCHERMATE: Schermata[] = [
  {
    emoji: '🎯',
    titolo: 'Dieci pronostici',
    testo:
      'Ogni giornata scegli il risultato di dieci partite. Un pronostico indovinato vale la sua quota moltiplicata per dieci. Sbagliare non toglie punti: si rischia solo di non farne.',
    c1: '#b9e08d',
    c2: '#8cc85a',
  },
  {
    emoji: '⏰',
    titolo: 'Si chiude due ore prima',
    testo:
      'La schedina si chiude due ore prima del primo fischio della giornata. Da lì si guarda: i risultati arrivano dal vivo e pochi minuti dopo l’ultima partita i punti sono già in classifica.',
    c1: '#e04340',
    c2: '#b01d1a',
  },
  {
    emoji: '🏆',
    titolo: 'Cosa si vince',
    testo:
      'Premi veri a ogni giornata, la classifica generale e quella delle tue leghe. Con i minigiochi guadagni gettoni, e con i gettoni compri power-up e biglietti dell’estrazione.',
    c1: '#f5ac36',
    c2: '#df8a0d',
  },
];

function giaVista(): boolean {
  try {
    return localStorage.getItem(CHIAVE) === '1';
  } catch {
    // Navigazione privata o cookie bloccati: meglio non mostrarla che
    // mostrarla a ogni apertura.
    return true;
  }
}

function segnaVista(): void {
  try {
    localStorage.setItem(CHIAVE, '1');
  } catch {
    /* niente da fare: si ripresentera' la prossima volta */
  }
}

export function Onboarding() {
  const { profile, loading } = useAuthContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const richiestaDalMenu = searchParams.get('guida') === '1';

  // Letto una volta sola all'avvio: se lo si rileggesse a ogni render, la
  // guida sparirebbe a meta' lettura nell'istante in cui si segna come vista.
  const [giaVistaPrima] = useState(giaVista);
  const [chiusa, setChiusa] = useState(false);
  const [indice, setIndice] = useState(0);

  // Riaprirla dal menu e' un cambio di richiesta: lo stato si riallinea
  // durante il render, che e' il modo previsto da React per lo stato
  // derivato da una prop (un effetto qui provocherebbe render a cascata).
  const [richiestaPrecedente, setRichiestaPrecedente] = useState(richiestaDalMenu);
  if (richiestaDalMenu !== richiestaPrecedente) {
    setRichiestaPrecedente(richiestaDalMenu);
    if (richiestaDalMenu) {
      setChiusa(false);
      setIndice(0);
    }
  }

  // Da sola solo a chi non ha ancora giocato: a chi e' dentro da giornate non
  // si spiega come si gioca senza che l'abbia chiesto.
  const primaVolta = !loading && !!profile && profile.matchdaysPlayed === 0 && !giaVistaPrima;
  const aperta = !chiusa && (richiestaDalMenu || primaVolta);

  if (!aperta) return null;

  const chiudi = (vai?: string) => {
    segnaVista();
    setChiusa(true);
    if (richiestaDalMenu) {
      searchParams.delete('guida');
      setSearchParams(searchParams, { replace: true });
    }
    if (vai) navigate(vai);
  };

  const schermata = SCHERMATE[indice];
  const ultima = indice === SCHERMATE.length - 1;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-night/80 backdrop-blur-sm p-3"
      role="dialog"
      aria-modal="true"
      aria-label="Come si gioca a Fantaschedina"
    >
      <div className="paper-card w-full max-w-sm overflow-hidden animate-slide-up">
        <div
          className="relative px-5 pt-8 pb-6 text-center"
          style={{ backgroundImage: `linear-gradient(180deg, ${schermata.c1} 0%, ${schermata.c2} 100%)` }}
        >
          <button
            type="button"
            onClick={() => chiudi()}
            className="absolute top-2 right-2 p-2 rounded-lg text-night/60 hover:text-night hover:bg-white/30 transition-colors"
            aria-label="Salta la guida"
          >
            <X size={18} />
          </button>
          <span className="text-[64px] leading-none drop-shadow-[0_3px_5px_rgba(0,0,0,0.25)]" aria-hidden>
            {schermata.emoji}
          </span>
        </div>

        <div className="p-5 space-y-3">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
            Come si gioca · {indice + 1} di {SCHERMATE.length}
          </p>
          <h2 className="font-display font-black text-2xl text-slate-900 uppercase leading-tight">
            {schermata.titolo}
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">{schermata.testo}</p>

          <div className="flex items-center justify-center gap-1.5 pt-1">
            {SCHERMATE.map((s, i) => (
              <span
                key={s.titolo}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  i === indice ? 'w-5 bg-primary-500' : 'w-1.5 bg-slate-300'
                )}
              />
            ))}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => chiudi()}
              className="px-3 py-3 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors"
            >
              Salta
            </button>
            <button
              type="button"
              onClick={() => (ultima ? chiudi('/pronostici') : setIndice(i => i + 1))}
              className="flex-1 btn-green py-3 text-sm font-black flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
            >
              {ultima ? '🎫 GIOCA LA PRIMA SCHEDINA' : <>AVANTI <ChevronRight size={16} /></>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
