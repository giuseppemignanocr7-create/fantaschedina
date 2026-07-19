import { memo, useState } from 'react';
import { cn } from '@/lib/utils';

interface TeamLogoProps {
  src?: string;
  name: string;
  size?: number;
  className?: string;
}

export const TeamLogo = memo(function TeamLogo({
  src,
  name,
  size = 24,
  className,
}: TeamLogoProps) {
  const [errored, setErrored] = useState(false);

  if (!src || errored) {
    return (
      <span
        className={cn('inline-flex items-center justify-center font-bold text-white/50', className)}
        style={{ width: size, height: size, fontSize: size * 0.4 }}
        aria-hidden
      >
        {name.slice(0, 2).toUpperCase()}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={`Logo ${name}`}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={() => setErrored(true)}
      className={cn('object-contain', className)}
      style={{ width: size, height: size }}
    />
  );
});
