import { 
  FileText, 
  Trophy, 
  Calculator, 
  Euro, 
  Gift, 
  Users,
  AlertTriangle,
  Clock,
  Target,
  Zap,
  Star
} from 'lucide-react';

const sections = [
  {
    id: 'struttura',
    title: 'Struttura del Torneo',
    icon: Trophy,
    content: [
      'Si gioca ogni settimana con 10 partite di Serie A.',
      'Ogni partecipante sceglie liberamente l\'esito/segno della partita.',
      'La schedina deve essere inviata almeno 1 ora prima del primo evento della giornata.',
      'Le schedine verranno rese pubbliche nel gruppo/bacheca solo dopo che tutti avranno giocato.',
      'Le schedine compilate verranno mantenute dall\'organizzatore.',
      'Gli aggiornamenti dei punteggi e delle classifiche saranno pubblicati entro 48 ore dall\'ultimo evento giocato.',
    ],
    warning: 'Possono partecipare solo i maggiori di 18 anni.',
  },
  {
    id: 'quote',
    title: 'Quote e Validità Giocate',
    icon: Calculator,
    content: [
      { label: 'Quota minima valida', value: '1.30' },
      { label: 'Quota massima valida', value: 'Nessun limite, ma il punteggio massimo assegnabile è 3.5 punti' },
      { label: 'Esempio', value: 'Quota 5.00 presa = 3.5 punti (cappata)' },
      { label: 'Quote inferiori a 1.25', value: 'La giocata è valida ma vale solo 0.5 punti' },
      { label: 'Quote tra 1.25 e 1.29', value: 'Ogni 3 giocate di questo tipo durante il campionato → -1.5 punti di penalità in classifica' },
    ],
  },
  {
    id: 'punteggio',
    title: 'Punteggio',
    icon: Target,
    content: [
      'Il punteggio corrisponde alla quota presa (esempio: quota 1.50 vinta = 1.50 punti).',
      'Massimo punteggio ottenibile per una singola quota = 3.5 punti.',
    ],
    bonus: [
      { condition: '9 esiti corretti su 10', points: '+2 punti extra' },
      { condition: '10 esiti corretti su 10', points: '+5 punti extra' },
    ],
    note: 'In caso un partecipante non giochi la schedina, riceverà i punti della schedina peggiore della giornata -1 punto di penalità, purché paghi la quota settimanale.',
  },
  {
    id: 'ingresso',
    title: 'Ingresso in Corso',
    icon: Users,
    content: [
      'È possibile iscriversi fino alla 10ª giornata di campionato.',
      'Chi entra dopo l\'inizio dovrà pagare:',
    ],
    fees: [
      { label: 'Quota di partecipazione', value: '20€' },
      { label: 'Per ogni giornata già passata', value: '+5€ (destinati al montepremi finale)' },
    ],
    note: 'Il punteggio di partenza sarà uguale a quello più basso presente in classifica al momento dell\'ingresso.',
  },
  {
    id: 'montepremi',
    title: 'Quote e Montepremi',
    icon: Euro,
    content: [
      { label: 'Quota partecipazione campionato', value: '20€ (va al montepremi finale)' },
      { label: 'Quota Fantaschedina settimanale', value: '10€ (5€ destinati al montepremi, 5€ alla Fantaschedina)' },
    ],
    distribution: [
      { label: '40%', desc: 'Al vincitore della schedina settimanale' },
      { label: '40%', desc: 'Diviso in parti uguali tra tutti i partecipanti (incluso il vincitore)' },
      { label: '20%', desc: 'Al montepremi finale' },
    ],
  },
  {
    id: 'premi',
    title: 'Premi',
    icon: Gift,
    content: [
      '500€ garantiti dagli sponsor in caso di almeno 30 iscritti.',
    ],
    prizes: [
      { position: '1° Classificato', amount: '300€', desc: 'Montepremi finale' },
      { position: '1° Girone Andata', amount: '200€', desc: 'Primo classificato del girone di andata' },
    ],
  },
  {
    id: 'premi-extra',
    title: 'Premi Extra',
    icon: Zap,
    extras: [
      {
        name: 'Quota Vincente Più Alta (10€)',
        rules: [
          'La singola quota vincente più alta di ogni giornata avrà un ulteriore premio di 10€.',
          'Pagato al vincitore alla termine di ogni giornata.',
          'La quota deve essere maggiore di 2.00.',
        ],
      },
      {
        name: 'Quota Poker (20€)',
        rules: [
          'Per avere diritto al premio, all\'interno della propria schedina devono essere presenti 4 quote vincenti superiori a 2.00.',
          'In caso nessuno acceda a questa quota, il premio si accumulerà ad ogni giornata finché qualcuno non vi riesca ad accedere.',
          'In caso di più vincite nella stessa giornata, vincerà il poker più alto.',
        ],
        example: 'Quota poker n.1 (2.20+2.47+2.60+2.02=9.29) vs Quota poker n.2 (2.68+2.87+2.42+2.28=10.25) → Vincente: Quota poker n.2',
      },
    ],
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
            Stagione 2025-2026
          </div>
          <h1 className="text-3xl sm:text-5xl font-display font-black uppercase italic tracking-tight text-white mb-4">
            Regolamento <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-primary-600">Fantaschedina</span>
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto font-medium">
            Leggi attentamente il regolamento prima di partecipare. 
            Il torneo è pensato per divertirsi tra amici: fino all'ultima partita tutto può succedere!
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-12">
          <div className="glass-card p-4 text-center border-t-2 border-accent-500 bg-surface/50">
            <p className="text-3xl font-mono font-bold text-accent-400">10</p>
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Partite/Settimana</p>
          </div>
          <div className="glass-card p-4 text-center border-t-2 border-white/20 bg-surface/50">
            <p className="text-3xl font-mono font-bold text-white">20€</p>
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Iscrizione</p>
          </div>
          <div className="glass-card p-4 text-center border-t-2 border-white/20 bg-surface/50">
            <p className="text-3xl font-mono font-bold text-white">10€</p>
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Quota Settimanale</p>
          </div>
          <div className="glass-card p-4 text-center border-t-2 border-green-500 bg-surface/50">
            <p className="text-3xl font-mono font-bold text-green-400">500€</p>
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Premio Garantito</p>
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
                  {'warning' in section && section.warning && (
                    <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 shadow-lg shadow-red-500/5">
                      <AlertTriangle className="text-red-400 shrink-0 mt-0.5" size={20} />
                      <p className="text-red-400 font-bold text-sm uppercase tracking-wide">{section.warning}</p>
                    </div>
                  )}

                  {/* Content List */}
                  {Array.isArray(section.content) && section.content.length > 0 && (
                    <ul className="space-y-3">
                      {section.content.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-3 text-slate-300">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary-500 mt-2 shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                          {typeof item === 'string' ? (
                            <span className="leading-relaxed">{item}</span>
                          ) : (
                            <span className="leading-relaxed">
                              <strong className="text-white font-bold uppercase text-xs tracking-wider mr-2">{item.label}:</strong> 
                              {item.value}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Bonus */}
                  {'bonus' in section && section.bonus && (
                    <div className="p-5 rounded-xl bg-green-500/5 border border-green-500/20">
                      <h4 className="font-bold text-green-400 mb-4 flex items-center gap-2 uppercase tracking-wider text-sm">
                        <Star size={16} className="fill-green-400" />
                        Bonus Extra
                      </h4>
                      <div className="grid sm:grid-cols-2 gap-3">
                        {section.bonus.map((b, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-surface border border-white/5">
                            <span className="text-slate-400 text-xs font-medium uppercase">{b.condition}</span>
                            <span className="font-bold text-green-400">{b.points}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Fees */}
                  {'fees' in section && section.fees && (
                    <div className="grid sm:grid-cols-2 gap-3">
                      {section.fees.map((fee, idx) => (
                        <div key={idx} className="flex items-center justify-between p-4 rounded-xl bg-surface border border-white/5">
                          <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">{fee.label}</span>
                          <span className="font-mono font-bold text-primary-400 text-lg">{fee.value}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Distribution */}
                  {'distribution' in section && section.distribution && (
                    <div>
                      <h4 className="font-bold text-white mb-4 text-sm uppercase tracking-wider">Ripartizione vincita settimanale</h4>
                      <div className="grid sm:grid-cols-3 gap-3">
                        {section.distribution.map((d, idx) => (
                          <div key={idx} className="p-4 rounded-xl bg-surface border border-white/5 text-center group hover:border-primary-500/30 transition-colors">
                            <p className="text-3xl font-mono font-bold gradient-text mb-1">{d.label}</p>
                            <p className="text-[10px] text-slate-500 font-medium uppercase leading-tight">{d.desc}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Prizes */}
                  {'prizes' in section && section.prizes && (
                    <div className="grid sm:grid-cols-2 gap-4">
                      {section.prizes.map((prize, idx) => (
                        <div key={idx} className="p-5 rounded-xl bg-gradient-to-br from-surface to-white/5 border border-white/10 relative overflow-hidden">
                          <div className="absolute top-0 right-0 p-3 opacity-5">
                            <Trophy size={64} />
                          </div>
                          <div className="flex items-center gap-3 mb-3 relative z-10">
                            <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                              <Trophy className="text-yellow-400" size={16} />
                            </div>
                            <span className="font-bold text-white text-sm uppercase tracking-wide">{prize.position}</span>
                          </div>
                          <p className="text-3xl font-mono font-bold text-yellow-400 mb-1 relative z-10">{prize.amount}</p>
                          <p className="text-xs text-slate-500 font-medium uppercase relative z-10">{prize.desc}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Extras */}
                  {'extras' in section && section.extras && (
                    <div className="space-y-4">
                      {section.extras.map((extra, idx) => (
                        <div key={idx} className="p-5 rounded-xl bg-surface border border-white/5">
                          <h4 className="font-bold text-primary-400 mb-4 flex items-center gap-2 uppercase tracking-wider text-sm">
                            <Zap size={16} />
                            {extra.name}
                          </h4>
                          <ul className="space-y-2 mb-4">
                            {extra.rules.map((rule, rIdx) => (
                              <li key={rIdx} className="flex items-start gap-2 text-sm text-slate-300">
                                <div className="w-1 h-1 rounded-full bg-slate-500 mt-2 shrink-0" />
                                {rule}
                              </li>
                            ))}
                          </ul>
                          {'example' in extra && extra.example && (
                            <div className="p-3 rounded-lg bg-accent-500/5 border border-accent-500/10">
                              <p className="text-xs text-accent-400 font-medium">
                                <strong className="uppercase mr-1">Esempio:</strong> {extra.example}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Note */}
                  {'note' in section && section.note && (
                    <div className="flex items-start gap-3 p-4 rounded-xl bg-yellow-500/5 border border-yellow-500/10">
                      <Clock className="text-yellow-500 shrink-0 mt-0.5" size={18} />
                      <p className="text-sm text-yellow-200/80 font-medium">{section.note}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Final Note */}
        <div className="mt-12 glass-card p-8 text-center border-t-4 border-t-primary-500 bg-surface/50">
          <h3 className="font-display font-bold text-2xl text-white mb-2 uppercase italic tracking-wide">Nota Finale</h3>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Il torneo è pensato per divertirsi tra amici della bolletta: 
            fino all'ultima partita tutto può succedere… tra bravura e fortuna!
          </p>
        </div>
      </div>
    </div>
  );
}
