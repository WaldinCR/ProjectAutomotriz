// Servicio de Auditoría — Registro inmutable (RF-49 a RF-53)
// Este módulo solo expone creación y consulta: no existe forma de editar
// ni borrar registros desde la aplicación.
const prisma = require('../core/prisma');
const { rangoDia } = require('../core/dates');
const schemas = require('../core/validation');

// `db` permite registrar dentro de una transacción (tx) para que la acción
// y su auditoría se confirmen o reviertan juntas.
async function registrar({ tabla, accion, registroId, usuarioId, datosAnteriores, datosNuevos }, db = prisma) {
  return db.auditLog.create({
    data: {
      tabla,
      accion,
      registroId:      registroId ?? null,
      usuarioId:       usuarioId ?? null,
      datosAnteriores: datosAnteriores ? JSON.stringify(datosAnteriores) : null,
      datosNuevos:     datosNuevos     ? JSON.stringify(datosNuevos)     : null,
    }
  });
}

async function consultar(filtros) {
  const { usuarioId, accion, desde, hasta } = schemas.filtrosAudit.parse(filtros ?? {});
  const fecha = {};
  if (desde) fecha.gte = rangoDia(desde).inicio;
  if (hasta) fecha.lt = rangoDia(hasta).fin;

  return prisma.auditLog.findMany({
    where: {
      ...(usuarioId && { usuarioId }),
      ...(accion && { accion: { contains: accion } }),
      ...((desde || hasta) && { fecha }),
    },
    include: { usuario: { select: { id: true, nombre: true, usuario: true } } },
    orderBy: { fecha: 'desc' },
    take: 500,
  });
}

module.exports = { registrar, consultar };
