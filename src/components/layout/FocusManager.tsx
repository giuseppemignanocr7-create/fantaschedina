import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

export function FocusManager() {
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mainRef.current?.focus();
    window.scrollTo(0, 0);
  }, [pathname]);

  return <div ref={mainRef} tabIndex={-1} className="sr-only" aria-hidden />;
}
