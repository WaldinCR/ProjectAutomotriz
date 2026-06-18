import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const links = [
  { path: '/pos',        label: '🛒 Ventas',     roles: ['ADMINISTRADOR','CAJERO'] },
  { path: '/taller',     label: '🔧 Taller',     roles: ['ADMINISTRADOR','CAJERO'] },
  { path: '/inventario', label: '📦 Inventario', roles: ['ADMINISTRADOR','CAJERO'] },
  { path: '/caja',       label: '💰 Caja',       roles: ['ADMINISTRADOR','CAJERO'] },
  { path: '/reportes',   label: '📊 Reportes',   roles: ['ADMINISTRADOR'] },
  { path: '/admin',      label: '⚙️ Admin',      roles: ['ADMINISTRADOR'] },
];

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();

  function handleLogout() {
    window.api.auth.logout();
    logout();
    navigate('/login');
  }

  const visibles = links.filter(l => l.roles.includes(user?.rol));

  return (
    <nav className="bg-blue-900 text-white flex items-center justify-between px-6 py-3 shadow-lg">
      <div className="flex items-center gap-1">
        <span className="font-bold text-lg mr-4 text-blue-200">SGI</span>
        {visibles.map(l => (
          <button
            key={l.path}
            onClick={() => navigate(l.path)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              location.pathname === l.path ? 'bg-white text-blue-900' : 'hover:bg-blue-800'
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-blue-200">
          👤 {user?.nombre} <span className="text-xs opacity-60">({user?.rol})</span>
        </span>
        <button
          onClick={handleLogout}
          className="bg-red-600 hover:bg-red-500 px-3 py-1.5 rounded-lg text-sm font-medium transition"
        >
          Salir
        </button>
      </div>
    </nav>
  );
}
