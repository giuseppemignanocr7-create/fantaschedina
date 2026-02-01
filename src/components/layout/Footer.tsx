import { Link } from 'react-router-dom';
import { Trophy, FileText, Shield, Mail } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-dark-800/50 border-t border-white/5 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-xl">FS</span>
              </div>
              <div>
                <h3 className="font-display font-bold text-xl gradient-text">
                  FANTA SCHEDINA
                </h3>
                <p className="text-xs text-white/50">2025-2026</p>
              </div>
            </div>
            <p className="text-white/60 text-sm leading-relaxed max-w-md">
              Il primo gioco di schedine collettivo in Italia. 
              Sfida i tuoi avversari nella schedina per ottenere premi. 
              Se un concorrente vince, vincono tutti!
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs text-white/40">
              <Shield size={14} />
              <span>Solo maggiori di 18 anni</span>
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-semibold text-white mb-4">Navigazione</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/schedina" className="text-white/60 hover:text-primary-400 transition-colors text-sm flex items-center gap-2">
                  <Trophy size={14} />
                  Gioca Schedina
                </Link>
              </li>
              <li>
                <Link to="/classifica" className="text-white/60 hover:text-primary-400 transition-colors text-sm flex items-center gap-2">
                  <Trophy size={14} />
                  Classifica
                </Link>
              </li>
              <li>
                <Link to="/regolamento" className="text-white/60 hover:text-primary-400 transition-colors text-sm flex items-center gap-2">
                  <FileText size={14} />
                  Regolamento
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold text-white mb-4">Contatti</h4>
            <ul className="space-y-2">
              <li>
                <a 
                  href="mailto:info@fantaschedina.it" 
                  className="text-white/60 hover:text-primary-400 transition-colors text-sm flex items-center gap-2"
                >
                  <Mail size={14} />
                  info@fantaschedina.it
                </a>
              </li>
            </ul>
            <div className="mt-6">
              <p className="text-xs text-white/40">
                Montepremi garantito con almeno 30 iscritti
              </p>
              <p className="text-2xl font-bold gradient-text mt-1">€500</p>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-12 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-white/40">
            © 2025-2026 Fanta Schedina. Tutti i diritti riservati.
          </p>
          <p className="text-xs text-white/40">
            Il torneo è pensato per divertirsi tra amici: fino all'ultima partita tutto può succedere!
          </p>
        </div>
      </div>
    </footer>
  );
}
