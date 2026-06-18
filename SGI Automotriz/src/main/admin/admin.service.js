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
