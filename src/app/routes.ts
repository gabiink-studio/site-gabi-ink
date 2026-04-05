import { createBrowserRouter } from 'react-router';
import { OrcamentoPage } from '../components/OrcamentoPage';
import { AdminLayout } from '../components/admin/AdminLayout';
import { AdminDashboard } from '../components/admin/AdminDashboard';
import { EstoquePage } from '../components/admin/EstoquePage';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: OrcamentoPage,
  },
  {
    path: '/admin',
    Component: AdminLayout,
    children: [
      { index: true, Component: AdminDashboard },
      { path: 'estoque', Component: EstoquePage },
    ],
  },
]);