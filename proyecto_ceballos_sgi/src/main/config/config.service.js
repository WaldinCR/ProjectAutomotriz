// Configuración de la empresa, parámetros fiscales e impresora
const prisma = require('../core/prisma');
const auditService = require('../audit/audit.service');
const schemas = require('../core/validation');
const { normalizarRnc, TIPOS_NCF, formatearNcf } = require('../core/fiscal');
const { parsearFechaLocal } = require('../core/dates');
const { AppError } = require('../core/errors');

// La fila id = 1 la crea la migración; upsert cubre bases creadas con db push
async function obtener(db = prisma) {
  return db.configuracion.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}

async function actualizar(datos, actor) {
  const cambios = schemas.actualizarConfig.parse(datos);
  if (cambios.rnc) cambios.rnc = normalizarRnc(cambios.rnc);

  return prisma.$transaction(async (tx) => {
    const original = await obtener(tx);
    const config = await tx.configuracion.update({ where: { id: 1 }, data: cambios });
    await auditService.registrar({
      tabla: 'Configuracion', accion: 'EDITAR_CONFIGURACION', registroId: 1, usuarioId: actor.id,
      datosAnteriores: original, datosNuevos: config,
    }, tx);
    return config;
  });
}

async function listarSecuencias() {
  const secuencias = await prisma.secuenciaNcf.findMany({ orderBy: { tipo: 'asc' } });
  return secuencias.map(s => ({
    ...s,
    nombre: TIPOS_NCF[s.tipo]?.nombre,
    proximo: formatearNcf(s.tipo, s.siguiente),
    disponibles: Math.max(0, s.hasta - s.siguiente + 1),
    vencida: !!s.vencimiento && s.vencimiento < new Date(),
  }));
}

// La secuencia es válida hasta el final del día de vencimiento
function finDelDia(fechaStr) {
  const f = parsearFechaLocal(fechaStr);
  f.setHours(23, 59, 59, 999);
  return f;
}

// Crea o reemplaza la secuencia autorizada de un tipo de comprobante
async function guardarSecuencia(datos, actor) {
  const s = schemas.guardarSecuencia.parse(datos);
  const data = {
    descripcion: TIPOS_NCF[s.tipo].nombre,
    siguiente: s.siguiente,
    hasta: s.hasta,
    vencimiento: s.vencimiento ? finDelDia(s.vencimiento) : null,
    activo: s.activo,
  };

  return prisma.$transaction(async (tx) => {
    const original = await tx.secuenciaNcf.findUnique({ where: { tipo: s.tipo } });
    // No se permite retroceder la numeración: generaría NCF duplicados
    const usado = await tx.venta.findFirst({
      where: { ncf: { startsWith: s.tipo } },
      orderBy: { ncf: 'desc' },
      select: { ncf: true },
    });
    if (usado && Number(usado.ncf.slice(3)) >= s.siguiente) {
      throw new AppError(`El número inicial debe ser mayor al último NCF emitido (${usado.ncf})`);
    }
    const secuencia = await tx.secuenciaNcf.upsert({
      where: { tipo: s.tipo },
      update: data,
      create: { tipo: s.tipo, ...data },
    });
    await auditService.registrar({
      tabla: 'SecuenciaNcf', accion: 'GUARDAR_SECUENCIA_NCF', registroId: secuencia.id, usuarioId: actor.id,
      datosAnteriores: original, datosNuevos: secuencia,
    }, tx);
    return secuencia;
  });
}

module.exports = { obtener, actualizar, listarSecuencias, guardarSecuencia };
