import { Routes, Route } from 'react-router-dom';
import { StockProvider } from '../context/StockContext';
import { OrcamentoPage } from '../components/OrcamentoPage';
import { AdminLayout } from '../components/admin/AdminLayout';
import { AdminDashboard } from '../components/admin/AdminDashboard';
import { EstoquePage } from '../components/admin/EstoquePage';

export default function App() {
  return (
    <StockProvider>
      <Routes>
        <Route path="/" element={<OrcamentoPage />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="estoque" element={<EstoquePage />} />
        </Route>
      </Routes>
    </StockProvider>
  );
}