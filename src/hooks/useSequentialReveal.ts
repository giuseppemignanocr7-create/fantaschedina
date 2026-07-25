import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';

/**
 * Rivela uno alla volta gli elementi di una sequenza (es. gli esiti dei tiri
 * in Rigori/Sfide1v1), con un ritardo fisso tra un elemento e l'altro e un
 * ritardo finale prima di considerare la rivelazione conclusa.
 *
 * Lo stato `revealed`/`setRevealed` resta di proprietà del chiamante (che lo
 * azzera quando parte una nuova sequenza): l'hook incapsula solo il loop
 * setTimeout+setState condiviso da più minigiochi, non lo stato stesso, così
 * il reset sincrono di `revealed` all'avvio di una nuova sequenza (nello
 * stesso render in cui si impostano i nuovi `items`) resta invariato.
 */
export function useSequentialReveal<T>(
  items: T[],
  revealed: number,
  setRevealed: Dispatch<SetStateAction<number>>,
  active: boolean,
  stepDelayMs: number,
  finalDelayMs: number,
  onStep: (item: T, index: number) => void,
  onComplete: () => void
): void {
  const onStepRef = useRef(onStep);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onStepRef.current = onStep;
    onCompleteRef.current = onComplete;
  });

  useEffect(() => {
    if (!active) return;
    if (revealed >= items.length) {
      const t = setTimeout(() => onCompleteRef.current(), finalDelayMs);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setRevealed(n => {
        onStepRef.current(items[n], n);
        return n + 1;
      });
    }, stepDelayMs);
    return () => clearTimeout(t);
  }, [active, revealed, items, setRevealed, stepDelayMs, finalDelayMs]);
}
