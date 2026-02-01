import { Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/layout';
import { 
  DashboardPage,
  SchedinaPage, 
  ClassificaPage, 
  RegolamentoPage, 
  ProfiloPage,
  StoricoPage,
  LivePage
} from '@/pages';

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/schedina" element={<SchedinaPage />} />
        <Route path="/classifica" element={<ClassificaPage />} />
        <Route path="/regolamento" element={<RegolamentoPage />} />
        <Route path="/profilo" element={<ProfiloPage />} />
        <Route path="/storico" element={<StoricoPage />} />
        <Route path="/live" element={<LivePage />} />
      </Route>
    </Routes>
  );
}

export default App;
