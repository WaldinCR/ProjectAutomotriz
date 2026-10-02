import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { NAVEGACION, NOMBRE_ROL } from '../lib/navigation';

export default function Sidebar({ collapsed = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();

  const visibles = NAVEGACION.filter(item => item.roles.includes(user?.rol));
  const initials = user?.nombre
    ? user.nombre.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : '—';

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-top">
        <div className="brand">
          <svg className="brand-mark" viewBox="0 0 64 64" aria-hidden="true">
            <path
              d="M17 29l-4-3 4-7 5 2 4-4-2-5 8-3 3 5h6l3-5 8 3-2 5 4 4 5-2 4 7-4 3v6l4 3-4 7-5-2-4 4 2 5-8 3-3-5h-6l-3 5-8-3 2-5-4-4-5 2-4-7 4-3z"
              fill="none"
              stroke="#8ad0f1"
              strokeWidth="3"
              strokeLinejoin="round"
            />
            <path
              d="M20 37h25l-3-8-5-3h-9l-4 4h-4zM25 38a3 3 0 100 6 3 3 0 000-6zm15 0a3 3 0 100 6 3 3 0 000-6z"
              fill="#f58220"
              stroke="#f58220"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
          <div className="brand-copy">
            <div className="brand-name">CEBALLOS</div>
            <div className="brand-sub">REPUESTOS</div>
          </div>
        </div>
      </div>

      <nav className="nav-list" aria-label="Navegación principal">
        {visibles.map(item => {
          const active = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`nav-link ${active ? 'active' : ''}`}
              title={collapsed ? item.label : undefined}
            >
              <i className={`ti ${item.icon}`}></i>
              <span className="nav-copy">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="role-block">
        <div className="avatar">{initials}</div>
        <div className="role-copy">
          <div className="role-title">{user?.nombre || 'Usuario'}</div>
          <div className="role-text">{NOMBRE_ROL[user?.rol] || 'Sin sesión'}</div>
        </div>
      </div>
    </aside>
  );
}
