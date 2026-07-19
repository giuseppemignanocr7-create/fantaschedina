import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';

interface EmptyStateProps {
  icon?: string;
  title: string;
  message: string;
  ctaLabel?: string;
  ctaTo?: string;
  onCtaClick?: () => void;
}

export function EmptyState({ icon = '📭', title, message, ctaLabel, ctaTo, onCtaClick }: EmptyStateProps) {
  return (
    <div className="text-center py-16 px-4 animate-pop-in" role="status">
      <p className="text-5xl mb-4 animate-float inline-block">{icon}</p>
      <h3 className="font-bold text-white text-lg mb-2">{title}</h3>
      <p className="text-sm text-white/40 mb-6 max-w-sm mx-auto">{message}</p>
      {ctaLabel && ctaTo && (
        <Link
          to={ctaTo}
          className="btn-primary inline-block"
        >
          {ctaLabel}
        </Link>
      )}
      {ctaLabel && onCtaClick && !ctaTo && (
        <button onClick={onCtaClick} className="btn-primary">
          {ctaLabel}
        </button>
      )}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ title = 'Qualcosa è andato storto', message, onRetry }: ErrorStateProps) {
  return (
    <div className="text-center py-16 px-4" role="alert">
      <p className="text-5xl mb-4">⚠️</p>
      <h3 className="font-bold text-white text-lg mb-2">{title}</h3>
      <p className="text-sm text-white/40 mb-6 max-w-sm mx-auto">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="btn-secondary inline-flex items-center gap-2"
          aria-label="Riprova il caricamento"
        >
          <RefreshCw size={16} />
          Riprova
        </button>
      )}
    </div>
  );
}
