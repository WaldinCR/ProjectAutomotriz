// Punto de entrada React — Rutas principales
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage    from './pages/LoginPage';
import POSPage      from './pages/POSPage';
import InventoryPage from './pages/InventoryPage';
import WorkshopPage from './pages/WorkshopPage';
import CashierPage  from './pages/CashierPage';
import ReportsPage  from './pages/ReportsPage';
import AdminPage    from './pages/AdminPage';
import { useAuthStore } from './store/authStore';

function PrivateRoute({ children, roles }) {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" />;
  if (roles && !roles.includes(user.rol)) return <Navigate to="/pos" />;
  return children;
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/pos" element={<PrivateRoute><POSPage /></PrivateRoute>} />
        <Route path="/inventario" element={<PrivateRoute><InventoryPage /></PrivateRoute>} />
        <Route path="/taller" element={<PrivateRoute><WorkshopPage /></PrivateRoute>} />
        <Route path="/caja" element={<PrivateRoute><CashierPage /></PrivateRoute>} />
        <Route path="/reportes" element={<PrivateRoute roles={['ADMINISTRADOR']}><ReportsPage /></PrivateRoute>} />
        <Route path="/admin" element={<PrivateRoute roles={['ADMINISTRADOR']}><AdminPage /></PrivateRoute>} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </HashRouter>
  );
}
