import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, Clock, CheckCircle2, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { startQuiz, submitQuiz, callableErrorMessage, type QuizQuestionPublic } from '@/lib/gameApi';
import { COINS } from '@/lib/economy';
import { CountUp } from '@/components/ui/CountUp';
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
          else if (r.correct >= 6) { sideCannons(); coinRain(1200); }
          else if (r.correct >= 3) coinRain(900);
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
      // Il server non invia più la risposta esatta insieme alle domande (per
      // evitare che un client possa leggerla prima di rispondere), quindi qui
      // si può solo confermare la scelta: correttezza e revisione arrivano
      // dal risultato di submitQuiz, mostrato nella schermata finale.
      vibrate([30, 20, 40]);
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
      }, 900);
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
  const pct = ((TIMER - timer) / TIMER) * 100;

  if (phase === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={40} className="text-primary-400 animate-spin" />
      </div>
    );
  }

  if (phase === 'done' && result) {
    const { correct, total, reward } = result;
    const grade = correct >= 9 ? 'LEGGENDA!' : correct >= 7 ? 'CAMPIONE!' : correct >= 5 ? 'Niente male!' : 'Ci riprovi domani?';
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="glass-card p-8 max-w-md w-full text-center space-y-5 animate-pop-in">
          <div className="text-7xl animate-heartbeat">{correct >= 9 ? '👑' : correct >= 7 ? '🏆' : correct >= 5 ? '⭐' : '😅'}</div>
          <h2 className="font-display font-black text-3xl text-white uppercase">{grade}</h2>

          {/* Barra risposte */}
          <div className="flex gap-1.5 justify-center">
            {Array.from({ length: total }).map((_, i) => (
              <div
                key={i}
                className={cn('w-4 h-4 rounded-full animate-pop-in', i < correct ? 'bg-primary-400' : 'bg-white/10')}
                style={{ animationDelay: `${i * 70}ms` }}
              />
            ))}
          </div>
          <p className="text-white/60 font-bold">{correct}/{total} risposte corrette</p>

          <div className="bg-gradient-to-r from-yellow-500/15 via-yellow-500/25 to-yellow-500/15 border border-yellow-500/30 rounded-2xl p-5">
            <p className="text-yellow-200/60 text-xs uppercase tracking-widest mb-1">Bottino</p>
            <p className="font-black text-5xl text-yellow-400 animate-coin-pop">
              +<CountUp to={reward} durationMs={1400} /> 🪙
            </p>
          </div>

          {/* Revisione risposte */}
          <div className="text-left space-y-2 max-h-56 overflow-y-auto pr-1">
            <p className="text-xs font-black text-white/80 uppercase tracking-widest mb-1">📋 Revisione risposte</p>
            {questions.map((rq, i) => {
              const userAnswer = answers[rq.id];
              const correctAnswer = result.corrections[rq.id];
              const wasCorrect = userAnswer === correctAnswer;
              return (
                <div key={rq.id} className="bg-white/5 rounded-lg p-2.5 text-xs">
                  <p className="text-white/70 font-medium mb-1">{i + 1}. {rq.question}</p>
                  <p className={wasCorrect ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                    {wasCorrect ? '✓' : '✗'} {rq.options[userAnswer] ?? 'Nessuna risposta'}
                  </p>
                  {!wasCorrect && (
                    <p className="text-green-400/80 mt-0.5">Corretta: {rq.options[correctAnswer]}</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Come usare i gettoni */}
          <div className="bg-white/5 rounded-xl p-4 text-left space-y-2">
            <p className="text-xs font-black text-white/80 uppercase tracking-widest mb-1">💡 Come usare i gettoni</p>
            <Link to="/schedina" className="flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors">
              <span className="text-primary-400">▸</span> Vai alla schedina e compra power-up
            </Link>
            <div className="flex items-center gap-2 text-sm text-white/60">
              <span className="text-primary-400">▸</span> 🃏 Jolly (200🪙) · 🛡️ Scudo (150🪙) · ⭐ Assicurazione (120🪙)
            </div>
          </div>

          <p className="text-xs text-white/40">Puoi giocare una volta al giorno. Torna domani!</p>
          <div className="flex gap-2">
            <Link to="/schedina" className="flex-1 btn-green text-xs font-black flex items-center justify-center gap-1.5 active:scale-95 transition-transform">
              🎫 USA I GETTONI
            </Link>
            <Link to="/minigiochi" className="flex items-center justify-center gap-2 btn-secondary text-xs">
              <ArrowLeft size={14} /> Sala giochi
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'intro') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="glass-card p-8 max-w-md w-full text-center space-y-5 animate-pop-in">
          <div className="text-7xl animate-float">🧠</div>
          <h1 className="font-display font-black text-3xl text-white uppercase">Quiz Calcio</h1>
          <p className="text-white/50 text-sm">
            {COINS.quizMaxQuestions} domande · {TIMER} secondi ciascuna
            <br />
            Guadagna fino a{' '}
            <span className="text-yellow-400 font-bold">
              {COINS.quizMaxQuestions * COINS.quizPerCorrect} gettoni 🪙
            </span>
          </p>
          <div className="bg-white/5 rounded-xl p-4 text-left space-y-2">
            {[
              `${COINS.quizMaxQuestions} domande sul calcio`,
              `${TIMER} secondi per rispondere`,
              `+${COINS.quizPerCorrect} gettoni per risposta corretta`,
              '1 partita al giorno',
            ].map(r => (
              <div key={r} className="flex items-center gap-2 text-sm text-white/70">
                <CheckCircle2 size={14} className="text-primary-400 flex-shrink-0" /> {r}
              </div>
            ))}
          </div>
          {error && <p className="text-sm text-red-400 animate-shake">{error}</p>}
          <button onClick={begin} className="btn-green w-full text-sm font-black animate-pulse-glow active:scale-95 transition-transform">
            ⚡ INIZIA IL QUIZ
          </button>
          <Link to="/minigiochi" className="block text-xs text-white/30 hover:text-white/60 transition-colors">← Torna ai minigiochi</Link>
        </div>
      </div>
    );
  }

  if (!q) return null;

  return (
    <div className="min-h-screen px-4 py-6">
      <div className="max-w-lg mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link to="/minigiochi" className="p-2 text-white/40 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div className="flex gap-1">
            {questions.map((_, i) => (
              <div key={i} className={cn('w-2 h-2 rounded-full transition-all',
                i < idx ? 'bg-primary-500' : i === idx ? 'bg-white' : 'bg-white/15')} />
            ))}
          </div>
          <div className={cn('flex items-center gap-1.5 text-sm font-bold px-2.5 py-1 rounded-lg transition-colors', timer <= 5 && 'bg-red-500/20 animate-heartbeat')}>
            <Clock size={14} className={timer <= 5 ? 'text-red-400' : 'text-white/40'} />
            <span className={timer <= 5 ? 'text-red-400 font-black' : 'text-white/60'}>{timer}s</span>
          </div>
        </div>

        {/* Timer bar */}
        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-1000', timer > 5 ? 'bg-primary-500' : 'bg-red-500')}
            style={{ width: `${100 - pct}%` }}
          />
        </div>

        {/* Question */}
        <div key={q.id} className="glass-card p-5 animate-slide-up">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] text-primary-400 uppercase tracking-widest font-bold">
              Domanda {idx + 1} / {questions.length}
            </p>
          </div>
          <p className="font-bold text-lg text-white leading-snug">{q.question}</p>
        </div>

        {/* Options: la scelta si blocca subito, il verdetto arriva solo a fine quiz */}
        <div className="grid grid-cols-1 gap-2.5">
          {q.options.map((opt, i) => {
            const isPicked = picked === i;
            const showFeedback = locked && picked !== null;
            return (
              <button
                key={`${q.id}-${i}`}
                onClick={() => commit(i)}
                disabled={locked}
                className={cn(
                  'w-full flex items-center gap-3 p-4 rounded-xl border text-left font-medium text-sm transition-all animate-slide-up',
                  !showFeedback && !locked && 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:border-white/25 hover:scale-[1.01] active:scale-[0.98]',
                  !showFeedback && locked && 'bg-white/5 border-white/10 text-white/80',
                  showFeedback && isPicked && 'bg-primary-500/30 border-primary-400 text-white scale-[1.02] shadow-lg shadow-primary-500/30',
                  showFeedback && !isPicked && 'bg-white/5 border-white/10 text-white/30'
                )}
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <span className={cn(
                  'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0',
                  showFeedback && isPicked && 'bg-primary-400 text-black',
                  !showFeedback && 'bg-white/10'
                )}>
                  {showFeedback && isPicked ? '✓' : String.fromCharCode(65 + i)}
                </span>
                <span className="flex-1">{opt}</span>
                {showFeedback && isPicked && <CheckCircle2 size={18} className="text-primary-400 flex-shrink-0" />}
              </button>
            );
          })}
        </div>

        {/* Feedback banner: conferma solo che la risposta è stata registrata */}
        {locked && picked !== null && (
          <div className="glass-card p-3 text-center animate-pop-in bg-primary-500/15 border-primary-500/30">
            <p className="font-black text-sm uppercase text-primary-300">
              {picked === -1 ? '⏱ Tempo scaduto' : '✓ Risposta registrata'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
