// Servicio de Autenticación (RF-01 a RF-06)
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../core/prisma');
const auditService = require('../audit/audit.service');
const schemas = require('../core/validation');
const { AppError } = require('../core/errors');

const MAX_INTENTOS = 5;
const BLOQUEO_MS = 15 * 60 * 1000;
const MENSAJE_CREDENCIALES = 'Usuario o contraseña incorrectos';

// Hash de relleno para comparar cuando el usuario no existe: el tiempo de
// respuesta es el mismo y no se revela qué usuarios están registrados.
let hashRelleno = null;
function obtenerHashRelleno() {
  hashRelleno ??= bcrypt.hash('relleno-no-valido', 12);
  return hashRelleno;
}

async function login(datos) {
  const { usuario, password } = schemas.login.parse(datos);
  // Los usuarios nuevos se guardan en minúsculas; se mantiene compatibilidad
  // con usuarios creados antes con mayúsculas.
  const user = await prisma.usuario.findFirst({ where: { usuario: { in: [usuario.toLowerCase(), usuario] } } });

  if (!user) {
    await bcrypt.compare(password, await obtenerHashRelleno());
    throw new AppError(MENSAJE_CREDENCIALES, 'CREDENCIALES');
  }
  if (!user.activo) {
    throw new AppError('El usuario está desactivado. Contacte al administrador.', 'CREDENCIALES');
  }
  if (user.bloqueadoHasta && user.bloqueadoHasta > new Date()) {
    const minutos = Math.ceil((user.bloqueadoHasta - new Date()) / 60000);
    throw new AppError(`Cuenta bloqueada por intentos fallidos. Intente en ${minutos} minuto(s).`, 'BLOQUEADO');
  }

  const valido = await bcrypt.compare(password, user.passwordHash);
  if (!valido) {
    const intentos = user.intentosFallidos + 1;
    const bloquear = intentos >= MAX_INTENTOS;
    await prisma.usuario.update({
      where: { id: user.id },
      data: {
        intentosFallidos: bloquear ? 0 : intentos,
        bloqueadoHasta: bloquear ? new Date(Date.now() + BLOQUEO_MS) : null,
      },
    });
    await auditService.registrar({
      tabla: 'Usuario', accion: bloquear ? 'BLOQUEO_CUENTA' : 'LOGIN_FALLIDO',
      registroId: user.id, usuarioId: user.id,
    });
    if (bloquear) throw new AppError('Demasiados intentos fallidos. La cuenta quedó bloqueada 15 minutos.', 'BLOQUEADO');
    throw new AppError(MENSAJE_CREDENCIALES, 'CREDENCIALES');
  }

  await prisma.usuario.update({
    where: { id: user.id },
    data: { intentosFallidos: 0, bloqueadoHasta: null, ultimoAcceso: new Date() },
  });
  await auditService.registrar({ tabla: 'Usuario', accion: 'LOGIN', registroId: user.id, usuarioId: user.id });

  return { id: user.id, nombre: user.nombre, rol: user.rol };
}

// Token para la API remota del supervisor
function emitirToken(usuario) {
  return jwt.sign({ id: usuario.id, rol: usuario.rol, nombre: usuario.nombre }, process.env.JWT_SECRET, { expiresIn: '30m' });
}

function verificarToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = { login, emitirToken, verificarToken, MAX_INTENTOS };
