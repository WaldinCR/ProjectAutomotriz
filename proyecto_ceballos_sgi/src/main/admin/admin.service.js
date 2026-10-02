// Servicio de Administración de usuarios (RF-03, RF-04, RF-07)
const bcrypt = require('bcrypt');
const prisma = require('../core/prisma');
const auditService = require('../audit/audit.service');
const sesiones = require('../core/session');
const schemas = require('../core/validation');
const { AppError } = require('../core/errors');
const { ROLES } = require('../core/roles');

const SALT_ROUNDS = 12;

// Nunca se envía passwordHash fuera del proceso principal
const CAMPOS_PUBLICOS = {
  id: true, nombre: true, usuario: true, rol: true, activo: true,
  ultimoAcceso: true, bloqueadoHasta: true, createdAt: true,
};

function listarUsuarios() {
  return prisma.usuario.findMany({ select: CAMPOS_PUBLICOS, orderBy: { nombre: 'asc' } });
}

async function crearUsuario(datos, actor) {
  const data = schemas.crearUsuario.parse(datos);

  const existente = await prisma.usuario.findUnique({ where: { usuario: data.usuario } });
  if (existente) throw new AppError('El nombre de usuario ya se encuentra registrado', 'DUPLICADO');

  const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
  return prisma.$transaction(async (tx) => {
    const creado = await tx.usuario.create({
      data: { nombre: data.nombre, usuario: data.usuario, rol: data.rol, passwordHash, activo: true },
      select: CAMPOS_PUBLICOS,
    });
    await auditService.registrar({
      tabla: 'Usuario', accion: 'CREAR_USUARIO', registroId: creado.id, usuarioId: actor.id, datosNuevos: creado,
    }, tx);
    return creado;
  });
}

async function editarUsuario(datos, actor) {
  const { id, ...cambios } = schemas.editarUsuario.parse(datos);

  const original = await prisma.usuario.findUnique({ where: { id }, select: CAMPOS_PUBLICOS });
  if (!original) throw new AppError('Usuario no encontrado', 'NO_ENCONTRADO');

  const pierdeAdmin = original.rol === ROLES.ADMIN &&
    ((cambios.rol && cambios.rol !== ROLES.ADMIN) || cambios.activo === false);

  if (id === actor.id && pierdeAdmin) {
    throw new AppError('No puede quitarse a sí mismo el rol de administrador ni desactivarse');
  }
  if (pierdeAdmin) {
    const adminsActivos = await prisma.usuario.count({ where: { rol: ROLES.ADMIN, activo: true } });
    if (adminsActivos <= 1) throw new AppError('Debe existir al menos un administrador activo');
  }

  const actualizado = await prisma.$transaction(async (tx) => {
    const u = await tx.usuario.update({
      where: { id },
      // Reactivar un usuario también lo desbloquea
      data: { ...cambios, ...(cambios.activo === true && { intentosFallidos: 0, bloqueadoHasta: null }) },
      select: CAMPOS_PUBLICOS,
    });
    await auditService.registrar({
      tabla: 'Usuario', accion: 'EDITAR_USUARIO', registroId: id, usuarioId: actor.id,
      datosAnteriores: original, datosNuevos: u,
    }, tx);
    return u;
  });

  // Un cambio de rol o una desactivación invalida las sesiones abiertas
  if ((cambios.rol !== undefined && cambios.rol !== original.rol) || cambios.activo === false) {
    sesiones.cerrarDeUsuario(id);
  }
  return actualizado;
}

async function restablecerPassword(datos, actor) {
  const { id, password } = schemas.restablecerPassword.parse(datos);
  const usuario = await prisma.usuario.findUnique({ where: { id } });
  if (!usuario) throw new AppError('Usuario no encontrado', 'NO_ENCONTRADO');

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  await prisma.$transaction(async (tx) => {
    await tx.usuario.update({
      where: { id },
      data: { passwordHash, intentosFallidos: 0, bloqueadoHasta: null },
    });
    await auditService.registrar({
      tabla: 'Usuario', accion: 'RESTABLECER_PASSWORD', registroId: id, usuarioId: actor.id,
    }, tx);
  });
  if (id !== actor.id) sesiones.cerrarDeUsuario(id);
  return { success: true };
}

function consultarAuditLog(filtros) {
  return auditService.consultar(filtros);
}

module.exports = {
  listarUsuarios,
  crearUsuario,
  editarUsuario,
  restablecerPassword,
  consultarAuditLog,
};
