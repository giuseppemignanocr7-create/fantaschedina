import { 
  FileText, 
  Scale, 
  Shield, 
  Users,
  AlertTriangle,
  Calculator,
  Target,
  Zap,
  Award,
  Lock,
  Gamepad2,
  Gift,
  CheckCircle2,
  XCircle,
  Sparkles,
  PlayCircle,
  type LucideIcon
} from 'lucide-react';

interface Section {
  id: string;
  title: string;
  icon: LucideIcon;
  intro?: string;
  content?: string[];
  warning?: string;
  highlight?: { label: string; value: string; }[];
  items?: { label: string; desc: string; }[];
}

const sections: Section[] = [
  {
    id: 'definizione',
    title: 'Definizione della Piattaforma',
    icon: PlayCircle,
    intro: 'Fantaschedina è una piattaforma digitale di intrattenimento sportivo, competizione social, prediction game calcistico, leghe fantasy e minigiochi sportivi basati su abilità.',
    content: [
      'Effettuare pronostici sportivi virtuali',
      'Partecipare a classifiche e competizioni',
      'Creare leghe private personalizzate',
      'Competere tramite minigiochi skill-based',
      'Ottenere punteggi e riconoscimenti virtuali',
    ],
  },
  {
    id: 'natura',
    title: 'Natura del Servizio',
    icon: Scale,
    warning: 'Fantaschedina NON è un bookmaker, NON raccoglie scommesse, NON accetta denaro per effettuare pronostici e NON gestisce gioco d\'azzardo.',
    intro: 'La piattaforma è progettata esclusivamente come gioco competitivo skill-based e social fantasy sport.',
  },
  {
    id: 'accesso',
    title: 'Accesso alla Piattaforma',
    icon: Lock,
    intro: 'L\'accesso alla piattaforma è gratuito, facoltativo e riservato agli utenti registrati.',
    highlight: [
      { label: 'Depositi', value: 'NON richiesti' },
      { label: 'Puntate reali', value: 'NON consentite' },
      { label: 'Crediti obbligatori', value: 'NON richiesti' },
      { label: 'Costo di accesso', value: 'GRATUITO' },
    ],
  },
  {
    id: 'pronostici',
    title: 'Pronostici Sportivi',
    icon: Target,
    intro: 'Gli utenti possono effettuare pronostici sulle partite di calcio:',
    items: [
      { label: '1X2', desc: 'Segno esito finale' },
      { label: 'Over/Under', desc: 'Totale gol' },
      { label: 'Goal/No Goal', desc: 'Entrambe segnano' },
      { label: 'Risultato esatto', desc: 'Score preciso' },
      { label: 'Marcatore', desc: 'Goal di un giocatore' },
    ],
    warning: 'I pronostici hanno esclusiva finalità ludica e servono unicamente per l\'assegnazione dei punti classifica.',
  },
  {
    id: 'quote',
    title: 'Sistema Quote',
    icon: Calculator,
    intro: 'Le quote visualizzate sono dati statistici e informativi utilizzati esclusivamente come coefficiente punti.',
    highlight: [
      { label: 'Quote offerte', value: 'SOLO informativi' },
      { label: 'Offerte di scommessa', value: 'NON presenti' },
      { label: 'Invito al gioco', value: 'NON costituisce' },
      { label: 'Vincite economiche', value: 'NON generate' },
    ],
    content: [
      'Quote medie di mercato dai principali provider sportivi',
      'Possibilità di selezionare quota media ufficiale o provider personalizzato',
      'La selezione influisce esclusivamente sul sistema punteggio',
    ],
  },
  {
    id: 'calcolo',
    title: 'Calcolo Punti',
    icon: Zap,
    intro: 'Formula ufficiale: le quote dei pronostici corretti si moltiplicano tra loro, come una schedina reale — non si sommano.',
    highlight: [
      { label: 'Formula', value: 'Punti = Quota₁ × Quota₂ × … (cap 5.00 a giocata)' },
    ],
    items: [
      { label: '3 corretti a quota 2.00', desc: '→ 8 punti (2×2×2)' },
      { label: '5 corretti a quota 2.00', desc: '→ 32 punti' },
      { label: '9-10 corretti su 10', desc: '→ bonus ×1.2 / ×1.5 sul totale' },
    ],
    warning: 'I punti non hanno valore economico e non sono convertibili in denaro.',
  },
  {
    id: 'leghe',
    title: 'Leghe Private',
    icon: Users,
    intro: 'Gli utenti possono creare leghe private personalizzate con:',
    items: [
      { label: 'Nome e logo', desc: 'Personalizzazione identità' },
      { label: 'Codice invito', desc: 'Accesso esclusivo' },
      { label: 'Classifiche dedicate', desc: 'Competizioni private' },
      { label: 'Provider quote', desc: 'Personalizzabili' },
      { label: 'Minigiochi dedicati', desc: 'Sfide interne' },
    ],
    warning: 'Le leghe hanno finalità esclusivamente ludica e competitiva.',
  },
  {
    id: 'minigiochi',
    title: 'Minigiochi',
    icon: Gamepad2,
    intro: 'La piattaforma include minigiochi sportivi competitivi basati su abilità:',
    items: [
      { label: 'Rigori PvP', desc: 'Tira i rigori contro il portiere' },
      { label: 'Beat The Crowd', desc: 'Vai contro la massa' },
      { label: 'Quiz Calcio', desc: 'Testa la tua conoscenza' },
      { label: 'Prediction Rush', desc: 'Velocità di pronostico' },
      { label: 'Crossbar Challenge', desc: 'Centra la traversa' },
    ],
    warning: 'I minigiochi non prevedono vincite economiche dirette.',
  },
  {
    id: 'premi',
    title: 'Premi e Riconoscimenti',
    icon: Award,
    intro: 'La piattaforma può assegnare:',
    items: [
      { label: 'Badge virtuali', desc: 'Traguardi sbloccabili' },
      { label: 'Trofei digitali', desc: 'Riconoscimenti speciali' },
      { label: 'Merchandising', desc: 'Gadget esclusivi' },
      { label: 'Gift card', desc: 'Premi dei partner' },
      { label: 'Premi sponsor', desc: 'Offerte speciali' },
    ],
    content: [
      'I premi vengono assegnati esclusivamente sulla base delle classifiche competitive',
      'Nessuna garanzia di vincita economica',
    ],
  },
  {
    id: 'pubblicita',
    title: 'Pubblicità e Monetizzazione',
    icon: Gift,
    intro: 'La piattaforma può mostrare:',
    items: [
      { label: 'Banner pubblicitari', desc: 'Display advertising' },
      { label: 'Sponsor ufficiali', desc: 'Partnership strategiche' },
      { label: 'Rewarded ads', desc: 'Video incentivati' },
      { label: 'Video promozionali', desc: 'Contenuti sponsorizzati' },
    ],
    content: [
      'Gli utenti possono ottenere XP o funzionalità bonus tramite visualizzazione volontaria delle pubblicità',
      'Nessun obbligo di visualizzazione per partecipare alle competizioni',
    ],
  },
  {
    id: 'adm',
    title: 'Assenza di Attività ADM',
    icon: Shield,
    warning: 'Fantaschedina è progettata esclusivamente come social sports skill game.',
    highlight: [
      { label: 'Concessionario ADM', value: 'NON opera come' },
      { label: 'Giocate raccolte', value: 'NON raccoglie' },
      { label: 'Schedine reali', value: 'NON emette' },
      { label: 'Denaro scommesse', value: 'NON gestisce' },
    ],
  },
  {
    id: 'accettazione',
    title: 'Accettazione del Regolamento',
    icon: CheckCircle2,
    intro: 'L\'utilizzo della piattaforma comporta lettura, comprensione e accettazione integrale del presente regolamento ufficiale.',
    warning: 'Proseguendo nella navigazione e nell\'utilizzo dei servizi, l\'utente dichiara di aver letto e accettato tutte le condizioni di questo regolamento.',
  },
];

export function RegolamentoPage() {
  return (
    <div className="min-h-screen py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-400 text-sm font-bold uppercase tracking-wider mb-4">
            <FileText size={16} />
            DOSSIER UFFICIALE
          </div>
          <h1 className="text-3xl sm:text-5xl font-display font-black uppercase italic tracking-tight text-white mb-4">
            Regolamento <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-primary-600">Fantaschedina</span>
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto font-medium">
            Piattaforma digitale di intrattenimento sportivo, competizione social e prediction game skill-based. 
            Gioco fantasy gratuito senza finalità di scommessa.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-12">
          <div className="glass-card p-4 text-center border-t-2 border-green-500 bg-surface/50">
            <p className="text-3xl font-mono font-bold text-green-400">100%</p>
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Gratuito</p>
          </div>
          <div className="glass-card p-4 text-center border-t-2 border-red-500 bg-surface/50">
            <p className="text-3xl font-mono font-bold text-red-400"><XCircle size={28} className="inline" /></p>
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">No Scommesse</p>
          </div>
          <div className="glass-card p-4 text-center border-t-2 border-accent-500 bg-surface/50">
            <p className="text-3xl font-mono font-bold text-accent-400">Combo</p>
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Formula Punti</p>
          </div>
          <div className="glass-card p-4 text-center border-t-2 border-primary-500 bg-surface/50">
            <p className="text-3xl font-mono font-bold text-primary-400">Skill</p>
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Based Game</p>
          </div>
        </div>

        {/* Important Notice */}
        <div className="glass-card overflow-hidden border-l-4 border-l-red-500 mb-8">
          <div className="p-6 bg-red-500/5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center shrink-0">
                <Scale size={24} className="text-red-400" />
              </div>
              <div>
                <h2 className="font-display font-bold text-lg uppercase italic tracking-wide text-white mb-2">
                  Dichiarazione di Non-Scommessa
                </h2>
                <p className="text-slate-300 leading-relaxed">
                  Fantaschedina <strong className="text-white">NON è un bookmaker</strong>, <strong className="text-white">NON raccoglie scommesse</strong>, 
                  <strong className="text-white">NON accetta denaro</strong> per effettuare pronostici e <strong className="text-white">NON gestisce gioco d'azzardo</strong>.
                  La piattaforma è progettata esclusivamente come gioco competitivo skill-based e social fantasy sport.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-6">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <div key={section.id} className="glass-card overflow-hidden border border-white/5">
                {/* Section Header */}
                <div className="px-6 py-4 bg-surface border-b border-white/5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center shrink-0">
                    <Icon size={24} className="text-primary-400" />
                  </div>
                  <h2 className="font-display font-bold text-xl uppercase italic tracking-wide text-white">
                    {section.title}
                  </h2>
                </div>

                {/* Section Content */}
                <div className="p-6 space-y-6 bg-surface/30">
                  {/* Warning */}
                  {section.warning && (
                    <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 shadow-lg shadow-red-500/5">
                      <AlertTriangle className="text-red-400 shrink-0 mt-0.5" size={20} />
                      <p className="text-red-400 font-bold text-sm uppercase tracking-wide">{section.warning}</p>
                    </div>
                  )}

                  {/* Intro */}
                  {section.intro && (
                    <p className="text-slate-300 leading-relaxed font-medium">{section.intro}</p>
                  )}

                  {/* Highlight Grid */}
                  {section.highlight && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {section.highlight.map((h, idx) => (
                        <div key={idx} className="p-4 rounded-xl bg-surface border border-white/10 text-center">
                          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">{h.label}</p>
                          <p className="text-sm font-black text-primary-400">{h.value}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Items List */}
                  {section.items && (
                    <div className="grid sm:grid-cols-2 gap-3">
                      {section.items.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-3 p-4 rounded-xl bg-surface border border-white/5">
                          <CheckCircle2 size={18} className="text-primary-400 shrink-0" />
                          <div>
                            <p className="font-bold text-white text-sm">{item.label}</p>
                            <p className="text-xs text-slate-400">{item.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Content List */}
                  {section.content && section.content.length > 0 && (
                    <ul className="space-y-3">
                      {section.content.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-3 text-slate-300">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary-500 mt-2 shrink-0 shadow-[0_0_8px_rgba(132,216,12,0.55)]" />
                          <span className="leading-relaxed">{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Final Note */}
        <div className="mt-12 glass-card p-8 text-center border-t-4 border-t-primary-500 bg-surface/50">
          <div className="w-16 h-16 rounded-2xl bg-primary-500/20 flex items-center justify-center mx-auto mb-4">
            <Sparkles size={32} className="text-primary-400" />
          </div>
          <h3 className="font-display font-bold text-2xl text-white mb-4 uppercase italic tracking-wide">
            Accettazione del Regolamento
          </h3>
          <p className="text-slate-400 max-w-2xl mx-auto mb-6">
            L'utilizzo della piattaforma comporta lettura, comprensione e accettazione integrale 
            del presente regolamento ufficiale.
          </p>
          <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-green-500/10 border border-green-500/20">
            <CheckCircle2 size={18} className="text-green-400" />
            <span className="text-green-400 font-bold text-sm uppercase tracking-wide">
              Regolamento Ufficiale Fantaschedina
            </span>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-8 text-center">
          <p className="text-xs text-slate-500">
            © 2025 Fantaschedina - Tutti i diritti riservati. Piattaforma skill-based di intrattenimento sportivo.
          </p>
        </div>
      </div>
    </div>
  );
}
