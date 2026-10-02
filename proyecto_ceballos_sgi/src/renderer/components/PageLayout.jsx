import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuthStore } from '../store/authStore';
import { logout as cerrarSesion } from '../services/authService';

export default function PageLayout({ children, title, subtitle, actions }) {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const { logout } = useAuthStore();

  async function handleLogout() {
    await cerrarSesion().catch(() => {});
    logout();
    navigate('/login');
  }

  return (
    <div className="app-screen">
      <Sidebar collapsed={collapsed} />
      <div className="app-main">
        <header className="topbar">
          <div className="topbar-left">
            <button
              id="collapse-sidebar"
              className="icon-btn"
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              title={collapsed ? "Expandir menú" : "Colapsar menú"}
            >
              <i className={`ti ${collapsed ? 'ti-layout-sidebar-left-expand' : 'ti-layout-sidebar-left-collapse'}`}></i>
            </button>
            <h1 id="page-heading">{title || 'Repuestos Ceballos'}</h1>
          </div>
          <button className="logout-btn" onClick={handleLogout} type="button">
            <i className="ti ti-logout"></i>
            <span>Cerrar sesión</span>
          </button>
        </header>

        <main className="view-area">
          <div className="view active">
            {(title || actions || subtitle) && (
              <div className="view-heading">
                <div>
                  <h2>{title}</h2>
                  {subtitle && <p>{subtitle}</p>}
                </div>
                {actions && <div className="toolbar">{actions}</div>}
              </div>
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
