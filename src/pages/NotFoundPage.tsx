import { Link } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center space-y-5 max-w-sm animate-pop-in">
        <div className="text-8xl font-display font-black text-white/5 select-none leading-none">
          404
        </div>
        <div className="-mt-8">
          <p className="text-5xl mb-2 animate-bounce inline-block">⚽</p>
          <h1 className="font-display font-black text-2xl text-white uppercase italic mb-1">
            Fuori Campo!
          </h1>
          <p className="text-sm text-white/40">Questa pagina non esiste o è stata spostata.</p>
        </div>
        <div className="flex gap-3 justify-center">
          <Link
            to="/"
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-primary-500 text-white font-bold text-sm hover:bg-primary-400 transition-colors"
          >
            <Home size={16} /> Home
          </Link>
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white/5 border border-white/10 text-white/70 font-bold text-sm hover:bg-white/10 transition-colors"
          >
            <ArrowLeft size={16} /> Indietro
          </button>
        </div>
      </div>
    </div>
  );
}
