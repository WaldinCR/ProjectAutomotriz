// Punto de entrada React — Rutas principales
import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage     from './pages/LoginPage';
import POSPage       from './pages/POSPage';
import InventoryPage from './pages/InventoryPage';
import WorkshopPage  from './pages/WorkshopPage';
import CashierPage   from './pages/CashierPage';
import ReportsPage   from './pages/ReportsPage';
import AdminPage     from './pages/AdminPage';
import Spinner       from './components/Spinner';
import { useAuthStore, rutaInicial } from './store/authStore';
import { NAVEGACION } from './lib/navigation';
import { sesion } from './services/authService';

const PANTALLAS = {
  '/pos':        <POSPage />,
  '/taller':     <WorkshopPage />,
  '/inventario': <InventoryPage />,
  '/caja':       <CashierPage />,
  '/reportes':   <ReportsPage />,
  '/admin':      <AdminPage />,
};

function PrivateRoute({ children, roles }) {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.rol)) return <Navigate to={rutaInicial(user.rol)} replace />;
  return children;
}

export default function App() {
  const { user, setAuth } = useAuthStore();
  const [restaurando, setRestaurando] = useState(true);

  // Si la ventana se recarga, recupera la sesión que sigue viva en el proceso principal
  useEffect(() => {
    sesion()
      .then(setAuth)
      .catch(() => {})
      .finally(() => setRestaurando(false));
  }, [setAuth]);

  if (restaurando) return <Spinner text="Iniciando..." />;

  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={user ? <Navigate to={rutaInicial(user.rol)} replace /> : <LoginPage />} />
        {NAVEGACION.map(r => (
          <Route key={r.path} path={r.path} element={<PrivateRoute roles={r.roles}>{PANTALLAS[r.path]}</PrivateRoute>} />
        ))}
        <Route path="*" element={<Navigate to={user ? rutaInicial(user.rol) : '/login'} replace />} />
      </Routes>
    </HashRouter>
  );
}
