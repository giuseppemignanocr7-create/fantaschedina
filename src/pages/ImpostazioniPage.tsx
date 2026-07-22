import { Settings, Bell, Globe, Moon, Volume2 } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      onClick={() => onChange(!value)}
      role="switch"
      aria-checked={value}
      aria-label={label}
      className={cn(
        'w-11 h-6 rounded-full transition-colors relative flex-shrink-0',
        value ? 'bg-primary-500' : 'bg-white/20'
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
          value ? 'translate-x-5' : 'translate-x-0.5'
        )}
      />
    </button>
  );
}

export function ImpostazioniPage() {
  const [notifications, setNotifications] = useState(true);
  const [matchAlerts, setMatchAlerts] = useState(true);
  const [sounds, setSounds] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [language, setLanguage] = useState('Italiano');

  const sections = [
    {
      title: 'Notifiche',
      items: [
        { icon: Bell, label: 'Notifiche Push', desc: 'Ricevi notifiche in tempo reale', value: notifications, onChange: setNotifications },
        { icon: Bell, label: 'Alert Match', desc: 'Notifiche prima dei match', value: matchAlerts, onChange: setMatchAlerts },
        { icon: Volume2, label: 'Suoni', desc: 'Suoni di gioco', value: sounds, onChange: setSounds },
      ],
    },
    {
      title: 'Aspetto',
      items: [
        { icon: Moon, label: 'Tema Scuro', desc: 'Interfaccia dark', value: darkMode, onChange: setDarkMode },
      ],
    },
  ];

  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-3 py-3 space-y-3">

        <div className="flex items-center gap-2 mb-1">
          <Settings size={20} className="text-primary-400" />
          <h1 className="page-title">IMPOSTAZIONI</h1>
        </div>

        {sections.map((section) => (
          <div key={section.title}>
            <p className="section-title mb-2">{section.title}</p>
            <div className="glass-card overflow-hidden divide-y divide-white/5">
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="flex items-center gap-3 px-4 py-3.5">
                    <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
                      <Icon size={17} className="text-primary-400" strokeWidth={1.8} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-white">{item.label}</p>
                      <p className="text-[10px] text-white/40">{item.desc}</p>
                    </div>
                    <Toggle value={item.value} onChange={item.onChange} label={item.label} />
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Language */}
        <div>
          <p className="section-title mb-2">Lingua</p>
          <div className="glass-card p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
              <Globe size={17} className="text-primary-400" strokeWidth={1.8} />
            </div>
            <div className="flex-1">
              <label htmlFor="appLanguage" className="text-sm font-bold text-white block">Lingua App</label>
              <p className="text-[10px] text-white/40">Seleziona la tua lingua</p>
            </div>
            <select
              id="appLanguage"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="bg-transparent text-sm text-white/60 focus:outline-none cursor-pointer"
            >
              <option>Italiano</option>
              <option>English</option>
              <option>Español</option>
            </select>
          </div>
        </div>

        <p className="text-center text-[10px] text-white/20 pb-2">
          FantaSchedina v1.0.0
        </p>

      </div>
    </div>
  );
}
