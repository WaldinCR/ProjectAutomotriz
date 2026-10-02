import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const links = [
  { path: '/pos',        label: 'Ventas',      roles: ['ADMINISTRADOR','CAJERO'] },
  { path: '/taller',     label: 'Taller',      roles: ['ADMINISTRADOR','CAJERO'] },
  { path: '/inventario', label: 'Inventario',  roles: ['ADMINISTRADOR','CAJERO'] },
  { path: '/caja',       label: 'Caja',        roles: ['ADMINISTRADOR','CAJERO'] },
  { path: '/reportes',   label: 'Reportes',    roles: ['ADMINISTRADOR'] },
  { path: '/admin',      label: 'Admin',       roles: ['ADMINISTRADOR'] },
];

export default function Navbar() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user, logout } = useAuthStore();

  function handleLogout() {
    window.api.auth.logout();
    logout();
    navigate('/login');
  }

  const visibles = links.filter(l => l.roles.includes(user?.rol));

  return (
    <header className="bg-[#0f172a] sticky top-0 z-50 h-[44px] flex items-center">
      <div className="flex items-center justify-between px-6 w-full max-w-screen-xl mx-auto">

        {/* Logo */}
        <div className="flex items-center gap-8">
          <span className="text-white font-medium text-sm tracking-wide">
            SGI <span className="text-[#60a5fa] font-normal">Automotriz</span>
          </span>

          {/* Nav links */}
          <nav className="flex items-center gap-2">
            {visibles.map(l => {
              const active = location.pathname === l.path;
              return (
                <button
                  key={l.path}
                  onClick={() => navigate(l.path)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150
                    ${active
                      ? 'bg-white border-transparent text-[#0f172a]'
                      : 'border-transparent bg-transparent text-[#94a3b8] hover:text-[#f8fafc] hover:bg-[#1e293b]'
                    }`}
                >
                  {l.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User info + logout */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs font-medium text-[#f8fafc] leading-none">{user?.nombre}</p>
            <p className="text-[10px] text-[#64748b] mt-1">{user?.rol === 'ADMINISTRADOR' ? 'Administrador' : user?.rol === 'SUPERVISOR' ? 'Supervisor' : 'Cajero'}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-[11px] text-[#94a3b8] hover:text-[#f8fafc] border border-[#334155] hover:border-[#475569] px-2.5 py-1 rounded-[10px] transition-colors bg-transparent"
          >
            Salir
          </button>
        </div>

      </div>
    </header>
  );
}
