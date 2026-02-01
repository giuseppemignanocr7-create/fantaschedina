import { useState, useEffect } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CountdownTimerProps {
  deadline: Date;
  onExpire?: () => void;
  className?: string;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

export function CountdownTimer({ deadline, onExpire, className }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(calculateTimeLeft(deadline));

  function calculateTimeLeft(deadline: Date): TimeLeft {
    const now = new Date().getTime();
    const target = new Date(deadline).getTime();
    const difference = target - now;

    if (difference <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };
    }

    return {
      days: Math.floor(difference / (1000 * 60 * 60 * 24)),
      hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((difference / 1000 / 60) % 60),
      seconds: Math.floor((difference / 1000) % 60),
      total: difference,
    };
  }

  useEffect(() => {
    const timer = setInterval(() => {
      const newTimeLeft = calculateTimeLeft(deadline);
      setTimeLeft(newTimeLeft);
      
      if (newTimeLeft.total <= 0) {
        clearInterval(timer);
        onExpire?.();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [deadline, onExpire]);

  const isUrgent = timeLeft.total > 0 && timeLeft.total < 1000 * 60 * 60; // < 1 hour
  const isWarning = timeLeft.total > 0 && timeLeft.total < 1000 * 60 * 60 * 3; // < 3 hours
  const isExpired = timeLeft.total <= 0;

  if (isExpired) {
    return (
      <div className={cn('flex items-center gap-2 text-live font-bold uppercase tracking-wider text-xs', className)}>
        <AlertTriangle size={16} />
        <span>Deadline Scaduta</span>
      </div>
    );
  }

  return (
    <div className={cn(
      'flex items-center gap-3',
      isUrgent ? 'text-live animate-pulse' : isWarning ? 'text-accent-400' : 'text-white',
      className
    )}>
      <Clock size={18} />
      <div className="flex items-center gap-1 font-mono font-bold">
        {timeLeft.days > 0 && (
          <>
            <TimeBlock value={timeLeft.days} label="g" />
            <span className="opacity-50">:</span>
          </>
        )}
        <TimeBlock value={timeLeft.hours} label="h" />
        <span className="opacity-50">:</span>
        <TimeBlock value={timeLeft.minutes} label="m" />
        <span className="opacity-50">:</span>
        <TimeBlock value={timeLeft.seconds} label="s" highlight={isUrgent} />
      </div>
      {isUrgent && (
        <span className="text-[10px] bg-live/20 text-live px-2 py-0.5 rounded border border-live/30 font-bold uppercase tracking-wider">
          URGENT
        </span>
      )}
    </div>
  );
}

function TimeBlock({ value, label, highlight }: { value: number; label: string; highlight?: boolean }) {
  return (
    <div className={cn(
      'flex items-baseline gap-0.5',
      highlight && 'text-live'
    )}>
      <span className="text-xl tabular-nums tracking-tight">
        {value.toString().padStart(2, '0')}
      </span>
      <span className="text-[10px] opacity-70 uppercase">{label}</span>
    </div>
  );
}
