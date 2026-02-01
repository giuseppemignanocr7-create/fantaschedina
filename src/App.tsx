import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components/layout';
import { useAppStore } from '@/store';
import { 
  HomePage, 
  DashboardPage,
  SchedinaPage, 
  ClassificaPage, 
  RegolamentoPage, 
  LoginPage,
  ProfiloPage,
  StoricoPage,
  LivePage
} from '@/pages';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAppStore();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function App() {
  const { isAuthenticated } = useAppStore();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<Layout />}>
        {/* Home: se loggato vai a Dashboard, altrimenti HomePage */}
        <Route path="/" element={isAuthenticated ? <DashboardPage /> : <HomePage />} />
        <Route path="/dashboard" element={
          <ProtectedRoute><DashboardPage /></ProtectedRoute>
        } />
        <Route path="/schedina" element={<SchedinaPage />} />
        <Route path="/classifica" element={<ClassificaPage />} />
        <Route path="/regolamento" element={<RegolamentoPage />} />
        <Route path="/profilo" element={
          <ProtectedRoute><ProfiloPage /></ProtectedRoute>
        } />
        <Route path="/storico" element={
          <ProtectedRoute><StoricoPage /></ProtectedRoute>
        } />
        <Route path="/live" element={<LivePage />} />
      </Route>
    </Routes>
  );
}

export default App;
