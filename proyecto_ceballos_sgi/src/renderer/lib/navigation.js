// Pantallas, menú y roles permitidos. Única fuente para App (rutas) y Sidebar (menú).
// Deben coincidir con los permisos del proceso principal (src/main/ipcHandlers.js).
import { ROLES } from '../store/authStore';

const { ADMIN, CAJERO, SUPERVISOR } = ROLES;

export const NAVEGACION = [
  { path: '/pos',        label: 'Punto de Venta', icon: 'ti-shopping-cart', roles: [ADMIN, CAJERO] },
  { path: '/taller',     label: 'Taller',         icon: 'ti-tool',          roles: [ADMIN, CAJERO, SUPERVISOR] },
  { path: '/inventario', label: 'Inventario',     icon: 'ti-package',       roles: [ADMIN, CAJERO, SUPERVISOR] },
  { path: '/caja',       label: 'Caja',           icon: 'ti-wallet',        roles: [ADMIN, CAJERO, SUPERVISOR] },
  { path: '/reportes',   label: 'Reportes',       icon: 'ti-chart-bar',     roles: [ADMIN, SUPERVISOR] },
  { path: '/admin',      label: 'Admin',          icon: 'ti-settings-2',    roles: [ADMIN] },
];

export const NOMBRE_ROL = { [ADMIN]: 'Administrador', [CAJERO]: 'Cajero', [SUPERVISOR]: 'Supervisor' };
