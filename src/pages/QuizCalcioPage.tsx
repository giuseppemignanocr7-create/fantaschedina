// ============================================
// QUIZ CALCIO — dieci domande, quindici secondi ciascuna, una partita al giorno
// Le domande arrivano senza la risposta esatta: correttezza e revisione le
// restituisce `submitQuiz` alla fine. La grafica segue la home (fascia scura
// in testa, card chiare sotto).
// ============================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, CheckCircle2, Loader2, Lock, Timer } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { startQuiz, submitQuiz, callableErrorMessage, type QuizQuestionPublic } from '@/lib/gameApi';
import { COINS } from '@/lib/economy';
import { CountUp } from '@/components/ui/CountUp';
import { SerieVinta } from '@/components/ui/SerieBadge';
import { sideCannons, jackpotCelebration, coinRain, vibrate } from '@/lib/juice';
import { useSilentProfileRefresh } from '@/hooks/useSilentProfileRefresh';

const TIMER = 15;

type Phase = 'intro' | 'loading' | 'playing' | 'done';

export function QuizCalcioPage() {
  const refreshProfileSilently = useSilentProfileRefresh('QuizCalcioPage');
  const [phase, setPhase] = useState<Phase>('intro');
  const [questions, setQuestions] = useState<QuizQuestionPublic[]>([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [timer, setTimer] = useState(TIMER);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [result, setResult] = useState<{
    correct: number;
    total: number;
    reward: number;
    corrections: Record<string, number>;
    serie?: { giorni: number; bonus: number };
    messaggio?: string;
  } | null>(null);
  const celebrated = useRef(false);

  const begin = async () => {
    setError(null);
    setPhase('loading');
    try {
      const { questions: qs } = await startQuiz();
      setQuestions(qs);
      setIdx(0);
      setAnswers({});
      setTimer(TIMER);
      setPhase('playing');
    } catch (e) {
      setError(callableErrorMessage(e));
      setPhase('intro');
    }
  };

  const finish = useCallback(
    async (finalAnswers: Record<string, number>) => {
      setPhase('loading');
      try {
        const r = await submitQuiz(finalAnswers);
        setResult(r);
        setPhase('done');
        refreshProfileSilently();
        if (!celebrated.current) {
          celebrated.current = true;
          if (r.correct >= 9) jackpotCelebration();
          else if (r.correct >= 6) {
            sideCannons();
            coinRain(1200);
          } else if (r.correct >= 3) coinRain(900);
        }
      } catch (e) {
        setError(callableErrorMessage(e));
        setPhase('intro');
      }
    },
    [refreshProfileSilently]
  );

  const commit = useCallback(
    (choice: number) => {
      if (phase !== 'playing' || locked) return;
      vibrate(20);
      setPicked(choice);
      setLocked(true);
      const q = questions[idx];
      // Il server non manda la risposta esatta insieme alle domande: qui si
      // conferma solo la scelta, il verdetto arriva con submitQuiz.
      const updated = { ...answers, [q.id]: choice };
      setAnswers(updated);
      setTimeout(() => {
        setPicked(null);
        setLocked(false);
        if (idx + 1 >= questions.length) {
          finish(updated);
        } else {
          setIdx(i => i + 1);
          setTimer(TIMER);
        }
      }, 700);
    },
    [phase, questions, idx, answers, finish, locked]
  );

  useEffect(() => {
    if (phase !== 'playing' || locked) return;
    if (timer === 0) {
      const t = setTimeout(() => commit(-1), 0);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setTimer(n => n - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, timer, commit, locked]);

  const q = questions[idx];

  if (phase === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <Loader2 size={36} className="text-primary-700 animate-spin" />
        <p className="text-sm text-slate-500 font-bold">Un attimo…</p>
      </div>
    );
  }

  if (phase === 'done' && result) {
    const { correct, total, reward } = result;
    const grade = correct >= 9 ? 'Leggenda!' : correct >= 7 ? 'Campione!' : correct >= 5 ? 'Niente male!' : 'Ci riprovi domani?';
    return (
      <div className="min-h-screen">
        <FasciaScura>
          <Testata titolo="Quiz Calcio" sotto="Risultato di oggi" chiara={false} />
          <div className="paper-card p-5 text-center space-y-3 animate-pop-in">
            <div className="text-6xl animate-heartbeat">{correct >= 9 ? '👑' : correct >= 7 ? '🏆' : correct >= 5 ? '⭐' : '😅'}</div>
            <h2 className="font-display font-black text-3xl text-slate-900 uppercase">{grade}</h2>
            <div className="flex gap-1.5 justify-center">
              {Array.from({ length: total }).map((_, i) => (
                <div
                  key={i}
                  className={cn('w-4 h-4 rounded-full animate-pop-in', i < correct ? 'bg-primary-500' : 'bg-slate-200')}
                  style={{ animationDelay: `${i * 70}ms` }}
                />
              ))}
            </div>
            <p className="text-slate-500 font-bold text-sm">
              {correct}/{total} risposte corrette
            </p>
            {result.messaggio && <p className="text-red-600 text-xs font-bold">{result.messaggio}</p>}
            <div className="bg-gradient-to-r from-yellow-500/15 via-yellow-500/25 to-yellow-500/15 border border-yellow-500/30 rounded-2xl p-4">
              <p className="text-yellow-800/80 text-[10px] uppercase tracking-widest mb-1 font-bold">Bottino</p>
              <p className="font-black text-5xl text-yellow-700 animate-coin-pop">
                +<CountUp to={reward} durationMs={1400} /> 🪙
              </p>
            </div>
            {result.serie && <SerieVinta giorni={result.serie.giorni} bonus={result.serie.bonus} />}
          </div>
        </FasciaScura>

        <div className="max-w-md mx-auto px-4 py-4 space-y-3">
          <div className="paper-card p-4 space-y-2">
            <p className="section-title-ink">📋 Revisione risposte</p>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {questions.map((rq, i) => {
                const userAnswer = answers[rq.id];
                const correctAnswer = result.corrections[rq.id];
                const wasCorrect = userAnswer === correctAnswer;
                return (
                  <div key={rq.id} className={cn('rounded-xl p-3 text-xs border', wasCorrect ? 'bg-primary-500/10 border-primary-500/30' : 'bg-red-50 border-red-200')}>
                    <p className="text-slate-700 font-semibold mb-1">
                      {i + 1}. {rq.question}
                    </p>
                    <p className={wasCorrect ? 'text-green-700 font-bold' : 'text-red-700 font-bold'}>
                      {wasCorrect ? '✓' : '✗'} {rq.options[userAnswer] ?? 'Nessuna risposta'}
                    </p>
                    {!wasCorrect && <p className="text-green-800 mt-0.5">Corretta: {rq.options[correctAnswer]}</p>}
                  </div>
                );
              })}
            </div>
          </div>

          <p className="text-xs text-slate-500 text-center">Una partita al giorno: torna domani con dieci domande nuove.</p>
          <div className="flex gap-2">
            <Link to="/negozio" className="flex-1 btn-green text-xs font-black flex items-center justify-center gap-1.5 py-3">
              🛍️ SPENDI I GETTONI
            </Link>
            <Link to="/minigiochi" className="flex items-center justify-center gap-2 flex-1 btn-secondary text-xs">
              <ArrowLeft size={14} /> Sala giochi
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'intro') {
    return (
      <div className="min-h-screen">
        <FasciaScura>
          <Testata titolo="Quiz Calcio" sotto={`${COINS.quizMaxQuestions} domande · ${TIMER} secondi ciascuna`} chiara={false} />
          <div className="paper-card p-6 text-center space-y-4 animate-pop-in">
            <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-primary-300 to-primary-600 flex items-center justify-center text-4xl shadow-lg shadow-primary-500/30">
              🧠
            </div>
            <p className="text-slate-600 text-sm">
              Sei un vero intenditore? Guadagna fino a{' '}
              <span className="text-yellow-700 font-black">{COINS.quizMaxQuestions * COINS.quizPerCorrect} gettoni 🪙</span>
            </p>
            <div className="grid grid-cols-2 gap-2 text-left">
              {[
                `${COINS.quizMaxQuestions} domande sul calcio`,
                `${TIMER} secondi a domanda`,
                `+${COINS.quizPerCorrect} gettoni a risposta esatta`,
                'Una partita al giorno',
              ].map(r => (
                <div key={r} className="flex items-center gap-2 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                  <CheckCircle2 size={14} className="text-primary-700 flex-shrink-0" /> {r}
                </div>
              ))}
            </div>
            {error && <p className="text-sm text-red-600 animate-shake">{error}</p>}
            <button onClick={begin} className="btn-green w-full text-sm font-black py-3.5 animate-pulse-glow active:scale-95 transition-transform">
              ⚡ INIZIA IL QUIZ
            </button>
          </div>
        </FasciaScura>
        <div className="max-w-md mx-auto px-4 py-4">
          <Link to="/minigiochi" className="block text-xs text-slate-500 hover:text-slate-900 text-center">
            ← Torna ai minigiochi
          </Link>
        </div>
      </div>
    );
  }

  if (!q) return null;

  const urgente = timer <= 5;

  return (
    <div className="min-h-screen">
      <FasciaScura>
        <header className="flex items-center justify-between">
          <Link to="/minigiochi" className="p-2 -ml-2 text-white/70 hover:text-white transition-colors" aria-label="Torna ai minigiochi">
            <ArrowLeft size={22} />
          </Link>
          <div className="text-center">
            <p className="font-display font-black text-sm text-white tracking-[0.2em]">
              DOMANDA {idx + 1} / {questions.length}
            </p>
            <div className="flex gap-1 justify-center mt-1">
              {questions.map((_, i) => (
                <div
                  key={i}
                  className={cn('h-1.5 rounded-full transition-all', i < idx ? 'w-3 bg-primary-500' : i === idx ? 'w-5 bg-white' : 'w-3 bg-white/20')}
                />
              ))}
            </div>
          </div>
          <div className="relative w-11 h-11 flex items-center justify-center" aria-live="polite">
            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="3" />
              <circle
                cx="18"
                cy="18"
                r="15.9"
                fill="none"
                stroke={urgente ? '#ef4444' : '#84d80c'}
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${(timer / TIMER) * 100}, 100`}
                style={{ transition: 'stroke-dasharray 1s linear' }}
              />
            </svg>
            <span className={cn('text-sm font-black', urgente ? 'text-red-400 animate-pulse' : 'text-white')}>{timer}</span>
          </div>
        </header>

        <div key={q.id} className="paper-card p-5 animate-slide-up">
          <p className="text-[9px] font-black text-blue-700 uppercase tracking-[0.2em] mb-2 flex items-center gap-1">
            <Timer size={10} /> {TIMER} secondi
          </p>
          <p className="font-bold text-lg text-slate-900 leading-snug">{q.question}</p>
        </div>
      </FasciaScura>

      <div className="max-w-md mx-auto px-4 py-4 space-y-2.5">
        {q.options.map((opt, i) => {
          const isPicked = picked === i;
          return (
            <button
              key={`${q.id}-${i}`}
              onClick={() => commit(i)}
              disabled={locked}
              className={cn(
                'w-full flex items-center gap-3 p-3.5 rounded-2xl border text-left font-semibold text-sm transition-all animate-slide-up',
                'bg-white border-slate-200 text-slate-800 shadow-[0_2px_10px_rgba(15,23,42,0.05)]',
                !locked && 'hover:border-primary-500 hover:shadow-md active:scale-[0.98]',
                locked && !isPicked && 'opacity-60',
                isPicked && 'border-primary-500 bg-primary-500/10 scale-[1.01]'
              )}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <span
                className={cn(
                  'w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black flex-shrink-0',
                  isPicked ? 'bg-primary-500 text-night' : 'bg-slate-100 text-slate-600'
                )}
              >
                {String.fromCharCode(65 + i)}
              </span>
              <span className="flex-1">{opt}</span>
              {isPicked && <Lock size={16} className="text-primary-700 flex-shrink-0" />}
            </button>
          );
        })}

        {locked && (
          <p className="text-center text-xs text-slate-500 font-bold animate-pop-in pt-1">
            {picked === -1 ? '⏱ Tempo scaduto' : '🔒 Risposta bloccata'} · le soluzioni a fine quiz
          </p>
        )}
      </div>
    </div>
  );
}

function FasciaScura({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative bg-night rounded-b-[28px] shadow-lg shadow-black/25">
      <div
        className="absolute inset-0 rounded-b-[28px] pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(ellipse 70% 90% at 50% -30%, rgba(132,216,12,0.14) 0%, transparent 70%)' }}
      />
      <div className="relative max-w-md mx-auto px-4 pt-3 pb-5 space-y-3">{children}</div>
    </div>
  );
}

function Testata({ titolo, sotto, chiara }: { titolo: string; sotto: string; chiara: boolean }) {
  return (
    <header className="flex items-center gap-3">
      <Link
        to="/minigiochi"
        className={cn('p-2 -ml-2 transition-colors', chiara ? 'text-slate-500 hover:text-slate-900' : 'text-white/70 hover:text-white')}
        aria-label="Torna ai minigiochi"
      >
        <ArrowLeft size={20} />
      </Link>
      <div>
        <h1 className={cn('font-display font-black text-xl uppercase tracking-wide', chiara ? 'text-slate-900' : 'text-white')}>{titolo}</h1>
        <p className={cn('text-[11px]', chiara ? 'text-slate-500' : 'text-white/60')}>{sotto}</p>
      </div>
    </header>
  );
}
