import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Menu, 
  X, 
  Trophy, 
  FileText, 
  Home, 
  User,
  ClipboardList,
  Play,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navLinks = [
  { to: '/', label: 'Dashboard', icon: Home },
  { to: '/schedina', label: 'Schedina', icon: ClipboardList },
  { to: '/live', label: 'Live', icon: Play },
  { to: '/classifica', label: 'Classifica', icon: Trophy },
  { to: '/storico', label: 'Storico', icon: Clock },
  { to: '/regolamento', label: 'Regolamento', icon: FileText },
];

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-600 to-primary-500 flex items-center justify-center shadow-lg shadow-primary-500/20 group-hover:shadow-primary-500/40 transition-shadow border border-white/10">
              <span className="text-white font-bold text-lg font-display italic">FS</span>
            </div>
            <div className="hidden sm:block">
              <h1 className="font-display font-bold text-xl tracking-tight text-white">
                FANTA<span className="text-primary-500">SCHEDINA</span>
              </h1>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = location.pathname === link.to;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-all duration-200 uppercase tracking-wide',
                    isActive
                      ? 'bg-white/5 text-primary-400 border-b-2 border-primary-500'
                      : 'text-slate-400 hover:text-white hover:bg-white/5 border-b-2 border-transparent'
                  )}
                >
                  <Icon size={16} />
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* Profile Link */}
          <div className="hidden md:flex items-center gap-3">
            <Link 
              to="/profilo" 
              className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors"
            >
              <User size={16} className="text-primary-400" />
              <span className="text-sm font-medium">Profilo</span>
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/5 transition-colors"
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div
        className={cn(
          'md:hidden overflow-hidden transition-all duration-300',
          isOpen ? 'max-h-96' : 'max-h-0'
        )}
      >
        <div className="px-4 py-4 space-y-2 bg-dark-800/50 border-t border-white/5">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setIsOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all',
                  isActive
                    ? 'bg-gradient-to-r from-primary-500/20 to-accent-500/20 text-white border border-primary-500/30'
                    : 'text-white/70 hover:text-white hover:bg-white/5'
                )}
              >
                <Icon size={20} />
                {link.label}
              </Link>
            );
          })}
          
          <div className="pt-2 border-t border-white/10">
            <Link
              to="/profilo"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2 px-4 py-3 text-white/70 hover:bg-white/5 rounded-xl"
            >
              <User size={20} className="text-primary-400" />
              <span>Profilo</span>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
