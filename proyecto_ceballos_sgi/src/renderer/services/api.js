// Llamada única al proceso principal.
// El main responde { ok, data } o { ok: false, error: { code, message } }.
// Aquí se desenvuelve la respuesta y, si la sesión expiró, se cierra en la UI.
import { useAuthStore } from '../store/authStore';

export async function call(fn, datos) {
  const r = await fn(datos);
  if (r?.ok) return r.data;

  const error = new Error(r?.error?.message || 'Ocurrió un error inesperado');
  error.code = r?.error?.code;
  // Solo se avisa si había una sesión abierta en pantalla (no al arrancar la app)
  if (error.code === 'SESION_EXPIRADA' && useAuthStore.getState().user) {
    useAuthStore.getState().expirar(error.message);
  }
  throw error;
}
