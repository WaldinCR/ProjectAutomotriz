// Servicio de Administración
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const auditService = require('../audit/audit.service');

const prisma = new PrismaClient();
const SALT_ROUNDS = 12;

async function listarUsuarios() {
  return prisma.usuario.findMany({
    orderBy: { nombre: 'asc' }
  });
}

async function crearUsuario({ nombre, usuario, password, rol }) {
  if (!nombre || nombre.trim() === '') {
    throw new Error('El nombre del usuario es requerido');
  }
  if (!usuario || usuario.trim() === '') {
    throw new Error('El nombre de usuario (username) es requerido');
  }
  if (!password || password.trim() === '') {
    throw new Error('La contraseña es requerida');
  }

  const existing = await prisma.usuario.findUnique({ where: { usuario } });
  if (existing) {
    throw new Error('El nombre de usuario ya se encuentra registrado');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  return prisma.usuario.create({
    data: {
      nombre,
      usuario,
      passwordHash,
      rol,
      activo: true
    }
  });
}

async function consultarAuditLog(filtros = {}) {
  return auditService.consultar(filtros);
}

module.exports = {
  listarUsuarios,
  crearUsuario,
  consultarAuditLog
};
