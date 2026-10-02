// Estado global de autenticación (Zustand)
// Solo refleja quién inició sesión para pintar la UI. La autorización real
// la hace el proceso principal en cada llamada.
import { create } from 'zustand';

export const ROLES = { ADMIN: 'ADMINISTRADOR', CAJERO: 'CAJERO', SUPERVISOR: 'SUPERVISOR', TECNICO: 'TECNICO' };

// Pantalla inicial según el rol
export function rutaInicial(rol) {
  if (rol === ROLES.SUPERVISOR) return '/reportes';
  if (rol === ROLES.TECNICO) return '/taller';
  return '/pos';
}

export const useAuthStore = create((set, get) => ({
  user: null,
  avisoSesion: '',

  setAuth: (user) => set({ user, avisoSesion: '' }),
  logout:  () => set({ user: null }),
  expirar: (mensaje) => set({ user: null, avisoSesion: mensaje }),
  tieneRol: (...roles) => roles.includes(get().user?.rol),
}));
