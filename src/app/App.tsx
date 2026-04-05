import { RouterProvider } from 'react-router';
import { router } from './routes';
import { StockProvider } from '../context/StockContext';

export default function App() {
  return (
    <StockProvider>
      <RouterProvider router={router} />
    </StockProvider>
  );
}