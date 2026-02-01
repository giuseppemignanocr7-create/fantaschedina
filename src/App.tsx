import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components/layout';
import { AuthProvider, useAuthContext } from '@/contexts/AuthContext';
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
  const { isAuthenticated, loading } = useAuthContext();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated, loading } = useAuthContext();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

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

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;
