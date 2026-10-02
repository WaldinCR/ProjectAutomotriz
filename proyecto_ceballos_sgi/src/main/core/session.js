// Sesiones del proceso principal.
// La identidad del usuario vive AQUÍ, no en React: el renderer nunca envía
// su usuarioId ni su rol, por lo que no puede suplantar a otro usuario.
// Cada ventana (webContents) tiene como máximo una sesión.
const { AppError } = require('./errors');

const INACTIVIDAD_MS = 30 * 60 * 1000; // RNF-06: 30 minutos de inactividad

const sesiones = new Map(); // senderId -> { usuario, ultimaActividad }

function iniciar(senderId, usuario) {
  sesiones.set(senderId, {
    usuario: { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol, debeCambiarPassword: !!usuario.debeCambiarPassword },
    ultimaActividad: Date.now(),
  });
}

function cerrar(senderId) {
  sesiones.delete(senderId);
}

// Devuelve el usuario autenticado y renueva la actividad, o lanza error
function requerir(senderId, rolesPermitidos, opciones = {}) {
  const sesion = sesiones.get(senderId);
  if (!sesion) throw new AppError('Debe iniciar sesión para continuar', 'SESION_EXPIRADA');

  if (Date.now() - sesion.ultimaActividad > INACTIVIDAD_MS) {
    sesiones.delete(senderId);
    throw new AppError('La sesión expiró por inactividad. Inicie sesión nuevamente.', 'SESION_EXPIRADA');
  }
  // Con contraseña temporal solo se permite cambiarla (o consultar la sesión)
  if (sesion.usuario.debeCambiarPassword && !opciones.permitirTemporal) {
    throw new AppError('Debe cambiar su contraseña temporal antes de continuar', 'CAMBIAR_PASSWORD');
  }
  if (rolesPermitidos && !rolesPermitidos.includes(sesion.usuario.rol)) {
    throw new AppError('No tiene permisos para realizar esta acción', 'PROHIBIDO');
  }
  sesion.ultimaActividad = Date.now();
  return sesion.usuario;
}

function actualizar(senderId, usuario) {
  const sesion = sesiones.get(senderId);
  if (sesion) sesion.usuario = { ...sesion.usuario, ...usuario };
}

// Cierra las sesiones de un usuario (p. ej. al desactivarlo o cambiar su rol)
function cerrarDeUsuario(usuarioId) {
  for (const [senderId, sesion] of sesiones) {
    if (sesion.usuario.id === usuarioId) sesiones.delete(senderId);
  }
}

module.exports = { iniciar, cerrar, requerir, actualizar, cerrarDeUsuario, INACTIVIDAD_MS };
