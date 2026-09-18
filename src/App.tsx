import { useLocation, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, useEffect, type ReactElement } from 'react';
import { useAppStore } from '@/store';
import { useAuthContext } from '@/contexts/AuthContext';
import { LoginPage } from '@/pages/LoginPage';
import { Layout } from '@/components/layout';
import { riprendiPush } from '@/lib/push';

// Route lazy-loaded per code splitting
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const ClassificaPage = lazy(() => import('@/pages/ClassificaPage').then(m => ({ default: m.ClassificaPage })));
const GiocatorePage = lazy(() => import('@/pages/GiocatorePage').then(m => ({ default: m.GiocatorePage })));
const RegolamentoPage = lazy(() => import('@/pages/RegolamentoPage').then(m => ({ default: m.RegolamentoPage })));
const ProfiloPage = lazy(() => import('@/pages/ProfiloPage').then(m => ({ default: m.ProfiloPage })));
const FantaschedinePage = lazy(() => import('@/pages/FantaschedinePage').then(m => ({ default: m.FantaschedinePage })));
const LivePage = lazy(() => import('@/pages/LivePage').then(m => ({ default: m.LivePage })));
const LeghePage = lazy(() => import('@/pages/LeghePage').then(m => ({ default: m.LeghePage })));
const LegaPage = lazy(() => import('@/pages/LegaPage').then(m => ({ default: m.LegaPage })));
const PronosticiPage = lazy(() => import('@/pages/PronosticiPage').then(m => ({ default: m.PronosticiPage })));
const MatchPage = lazy(() => import('@/pages/MatchPage').then(m => ({ default: m.MatchPage })));
const MinigiochiPage = lazy(() => import('@/pages/MinigiochiPage').then(m => ({ default: m.MinigiochiPage })));
const MissioniPage = lazy(() => import('@/pages/MissioniPage').then(m => ({ default: m.MissioniPage })));
const PremiPage = lazy(() => import('@/pages/PremiPage').then(m => ({ default: m.PremiPage })));
const CalendarioPage = lazy(() => import('@/pages/CalendarioPage').then(m => ({ default: m.CalendarioPage })));
const StatistichePage = lazy(() => import('@/pages/StatistichePage').then(m => ({ default: m.StatistichePage })));
const CommunityPage = lazy(() => import('@/pages/CommunityPage').then(m => ({ default: m.CommunityPage })));
const AccountPage = lazy(() => import('@/pages/AccountPage').then(m => ({ default: m.AccountPage })));
const QuizCalcioPage = lazy(() => import('@/pages/QuizCalcioPage').then(m => ({ default: m.QuizCalcioPage })));
const RuotaGiornalieraPage = lazy(() => import('@/pages/RuotaGiornalieraPage').then(m => ({ default: m.RuotaGiornalieraPage })));
const RigoriDuelPage = lazy(() => import('@/pages/RigoriDuelPage').then(m => ({ default: m.RigoriDuelPage })));
const SfidePage = lazy(() => import('@/pages/SfidePage').then(m => ({ default: m.SfidePage })));
const MemoriaCalcioPage = lazy(() => import('@/pages/MemoriaCalcioPage').then(m => ({ default: m.MemoriaCalcioPage })));
const PrivacyPage = lazy(() => import('@/pages/PrivacyPage').then(m => ({ default: m.PrivacyPage })));
const NegozioPage = lazy(() => import('@/pages/NegozioPage').then(m => ({ default: m.NegozioPage })));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage').then(m => ({ default: m.NotFoundPage })));
const AdminPage = lazy(() => import('@/pages/AdminPage').then(m => ({ default: m.AdminPage })));

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-8 h-8 border-2 border-slate-300 border-t-primary-500 rounded-full animate-spin" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: ReactElement }) {
  const { isAuthenticated, loading } = useAuthContext();
  const location = useLocation();
  if (loading) return <Spinner />;
  if (isAuthenticated) return children;
  // Un link d'invito porta a /leghe?invito=CODICE. Senza ricordare dove si
  // stava andando, chi non e' ancora entrato finirebbe sulla home dopo
  // l'accesso e il codice andrebbe perso: l'invito si romperebbe proprio
  // per la persona nuova, che e' l'unica a cui serve (18/09/2026).
  return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
}

function App() {
  const { isAuthenticated, loading, profile, refreshProfile } = useAuthContext();
  const loadMatchday = useAppStore(s => s.loadMatchday);
  const loadRankings = useAppStore(s => s.loadRankings);
  const syncCurrentUser = useAppStore(s => s.syncCurrentUser);
  const loadUserSchedina = useAppStore(s => s.loadUserSchedina);

  useEffect(() => {
    if (!loading && isAuthenticated) loadMatchday();
  }, [isAuthenticated, loading, loadMatchday]);

  // Le due pagine che apre chiunque, home e schedina, si scaricano in
  // background appena si e' autenticati, quando il browser e' libero: al
  // primo tocco compaiono all'istante invece di aspettare un giro di rete.
  // Stessi specifier delle lazy() qui sopra, cosi' Vite riusa gli stessi chunk.
  useEffect(() => {
    if (loading || !isAuthenticated) return;
    const precarica = () => {
      void import('@/pages/DashboardPage');
      void import('@/pages/PronosticiPage');
    };
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(precarica, { timeout: 3000 });
      return () => window.cancelIdleCallback(id);
    }
    const t = setTimeout(precarica, 1500);
    return () => clearTimeout(t);
  }, [isAuthenticated, loading]);

  // La posizione in classifica sulla home viene dalla lista `rankings`, che
  // prima si caricava solo aprendo la Classifica: fino ad allora restava "—".
  // Punti e posizione cambiano anche mentre l'app e' aperta (il server
  // valuta le giornate): al ritorno in primo piano si rileggono entrambi.
  // loadRankings ha una cache di 60 s, quindi non costa letture inutili.
  useEffect(() => {
    if (loading || !isAuthenticated) return;
    void loadRankings();
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      void refreshProfile();
      void loadRankings();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [isAuthenticated, loading, loadRankings, refreshProfile]);

  useEffect(() => {
    syncCurrentUser(profile);
  }, [profile, syncCurrentUser]);

  useEffect(() => {
    if (profile?.id) void riprendiPush(profile.id);
  }, [profile?.id]);

  useEffect(() => {
    if (isAuthenticated) loadUserSchedina();
  }, [isAuthenticated, loadUserSchedina]);

  return (
    <Suspense fallback={<Spinner />}>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/pronostici" element={<PronosticiPage />} />
        {/* Esisteva una seconda pagina schedina raggiungibile solo da alcuni
            pulsanti: chi arrivava dal menu (/pronostici) non vedeva le stesse
            funzioni. Una sola pagina, un solo comportamento. */}
        <Route path="/schedina" element={<Navigate to="/pronostici" replace />} />
        <Route path="/leghe" element={<LeghePage />} />
        <Route path="/leghe/:leagueId" element={<LegaPage />} />
        <Route path="/classifica" element={<ClassificaPage />} />
        <Route path="/giocatore/:uid" element={<GiocatorePage />} />
        <Route path="/minigiochi" element={<MinigiochiPage />} />
        <Route path="/minigiochi/quiz" element={<QuizCalcioPage />} />
        <Route path="/minigiochi/ruota" element={<RuotaGiornalieraPage />} />
        <Route path="/minigiochi/rigori-duello" element={<RigoriDuelPage />} />
        <Route path="/minigiochi/rigori" element={<Navigate to="/minigiochi/rigori-duello" replace />} />
        <Route path="/minigiochi/sfide" element={<SfidePage />} />
        <Route path="/minigiochi/memoria" element={<MemoriaCalcioPage />} />
        <Route path="/missioni" element={<MissioniPage />} />
        <Route path="/premi" element={<PremiPage />} />
        <Route path="/negozio" element={<NegozioPage />} />
        <Route path="/calendario" element={<CalendarioPage />} />
        <Route path="/statistiche" element={<StatistichePage />} />
        <Route path="/match" element={<MatchPage />} />
        <Route path="/community" element={<CommunityPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/regolamento" element={<RegolamentoPage />} />
        <Route path="/profilo" element={<ProfiloPage />} />
        <Route path="/fantaschedine" element={<FantaschedinePage />} />
        <Route path="/storico" element={<Navigate to="/fantaschedine" replace />} />
        <Route path="/live" element={<LivePage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    </Suspense>
  );
}

export default App;
