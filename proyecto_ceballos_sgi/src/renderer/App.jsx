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
import CambiarPassword from './components/CambiarPassword';
import { logout as cerrarSesion } from './services/authService';
import { useAuthStore, rutaInicial } from './store/authStore';
import { NAVEGACION } from './lib/navigation';
import { sesion } from './services/authService';
import { useConfigStore } from './store/configStore';

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

  // Datos de la empresa (nombre, ITBIS, NCF, impresora) para toda la interfaz
  const cargarConfig = useConfigStore(s => s.cargar);
  useEffect(() => {
    if (user) cargarConfig(true).catch(() => {});
  }, [user, cargarConfig]);

  if (restaurando) return <Spinner text="Iniciando..." />;

  // Contraseña temporal: no se accede a ninguna pantalla hasta cambiarla
  if (user?.debeCambiarPassword) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--mist)' }}>
        <div className="card" style={{ width: '420px', padding: '28px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--navy)', marginBottom: '4px' }}>Hola, {user.nombre}</h2>
          <CambiarPassword
            obligatorio
            onCancelar={() => cerrarSesion().catch(() => {}).finally(() => useAuthStore.getState().logout())}
          />
        </div>
      </div>
    );
  }

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
