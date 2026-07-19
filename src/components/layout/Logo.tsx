import { cn } from '@/lib/utils';

interface LogoProps {
  /** Mostra il badge quadrato "FS" a sinistra del wordmark. */
  badge?: boolean;
  /** Mostra il claim "PREDICI. SFIDA. VINCI." sotto il wordmark. */
  tagline?: boolean;
  /** Dimensione del wordmark. */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const WORD_SIZE: Record<NonNullable<LogoProps['size']>, string> = {
  sm: 'text-[15px]',
  md: 'text-xl',
  lg: 'text-3xl',
};

const BADGE_SIZE: Record<NonNullable<LogoProps['size']>, string> = {
  sm: 'w-8 h-8 text-[13px] rounded-lg',
  md: 'w-10 h-10 text-base rounded-xl',
  lg: 'w-14 h-14 text-2xl rounded-2xl',
};

/**
 * Logo ufficiale FantaSchedina.
 * "F" bianca + "S" lime nel badge; wordmark FANTA bianco + SCHEDINA lime.
 */
export function Logo({ badge = true, tagline = false, size = 'sm', className }: LogoProps) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      {badge && (
        <div
          className={cn(
            'flex items-center justify-center flex-shrink-0 bg-background border border-primary-500/40 font-display font-black italic tracking-tighter shadow-lg shadow-primary-500/20',
            BADGE_SIZE[size]
          )}
        >
          <span className="text-white">F</span>
          <span className="text-primary-500">S</span>
        </div>
      )}
      <div className="leading-tight">
        <h1 className={cn('font-display font-black tracking-widest uppercase leading-none', WORD_SIZE[size])}>
          <span className="text-white">FANTA</span>
          <span className="text-primary-500">SCHEDINA</span>
        </h1>
        {tagline && (
          <p className="text-[7px] text-white/35 tracking-[0.25em] uppercase mt-0.5">
            PREDICI. SFIDA. VINCI.
          </p>
        )}
      </div>
    </div>
  );
}
