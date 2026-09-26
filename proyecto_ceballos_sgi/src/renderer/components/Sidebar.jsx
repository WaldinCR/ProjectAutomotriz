import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const navItems = [
  { path: '/pos',        label: 'Ventas',     icon: 'ti-shopping-cart', roles: ['ADMINISTRADOR','CAJERO'] },
  { path: '/taller',     label: 'Taller',     icon: 'ti-tool',          roles: ['ADMINISTRADOR','CAJERO'] },
  { path: '/inventario', label: 'Inventario', icon: 'ti-package',       roles: ['ADMINISTRADOR','CAJERO'] },
  { path: '/caja',       label: 'Caja',       icon: 'ti-cash-register', roles: ['ADMINISTRADOR','CAJERO'] },
  { path: '/reportes',   label: 'Reportes',   icon: 'ti-chart-bar',     roles: ['ADMINISTRADOR'] },
  { path: '/admin',      label: 'Admin',      icon: 'ti-shield-check',  roles: ['ADMINISTRADOR'] },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();

  function handleLogout() {
    if (window.api && window.api.auth) {
      window.api.auth.logout();
    }
    logout();
    navigate('/login');
  }

  const visibles = navItems.filter(item => item.roles.includes(user?.rol));
  const initials = user?.nombre
    ? user.nombre.split(' ').map(n => n[0]).slice(0, 2).join('')
    : 'US';

  return (
    <aside className="sidebar">
      <div className="sb-brand">
        <div className="sb-logo-icon">
          <i className="ti ti-settings-2"></i>
        </div>
        <div>
          <div className="sb-brand-name">Repuestos<br />Ceballos</div>
          <div className="sb-brand-sub">SGI Automotriz</div>
        </div>
      </div>

      <nav className="sb-nav">
        {visibles.map(item => {
          const active = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`sb-item ${active ? 'active' : ''}`}
            >
              <i className={`ti ${item.icon}`}></i>
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="sb-footer">
        <div className="sb-user">
          <div className="sb-avatar">{initials}</div>
          <div>
            <div className="sb-uname">{user?.nombre || 'Usuario'}</div>
            <div className="sb-urole">{user?.rol || 'CAJERO'}</div>
          </div>
        </div>
        <button className="sb-logout" onClick={handleLogout}>
          <i className="ti ti-logout"></i>
          Salir
        </button>
      </div>
    </aside>
  );
}
