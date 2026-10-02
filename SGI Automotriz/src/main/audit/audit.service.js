// Servicio de Auditoría — Registro inmutable
// Usar este servicio para registrar cualquier acción importante.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function registrar({ tabla, accion, registroId, usuarioId, datosAnteriores, datosNuevos }) {
  return prisma.auditLog.create({
    data: {
      tabla,
      accion,
      registroId:      registroId || null,
      usuarioId:       usuarioId  || null,
      datosAnteriores: datosAnteriores ? JSON.stringify(datosAnteriores) : null,
      datosNuevos:     datosNuevos     ? JSON.stringify(datosNuevos)     : null,
    }
  });
}

async function consultar({ usuarioId, accion, desde, hasta }) {
  return prisma.auditLog.findMany({
    where: {
      ...(usuarioId && { usuarioId }),
      ...(accion    && { accion: { contains: accion } }),
      ...(desde     && { fecha: { gte: new Date(desde) } }),
      ...(hasta     && { fecha: { lte: new Date(hasta) } }),
    },
    include: { usuario: true },
    orderBy: { fecha: 'desc' }
  });
}

module.exports = { registrar, consultar };
