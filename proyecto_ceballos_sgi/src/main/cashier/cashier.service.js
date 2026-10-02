// Servicio de Caja y Cierre (RF-36 a RF-42)
// Un cierre cubre las ventas desde el cierre anterior del mismo día (o desde
// el inicio del día). Así se admiten varios turnos sin contar ventas dos veces
// y ninguna venta posterior a un cierre queda fuera de conciliación.
const prisma = require('../core/prisma');
const auditService = require('../audit/audit.service');
const schemas = require('../core/validation');
const { AppError } = require('../core/errors');
const { rangoDia, dinero } = require('../core/dates');

function resumirVentas(ventas) {
  const porMetodo = { EFECTIVO: 0, TARJETA: 0, TRANSFERENCIA: 0 };
  for (const v of ventas) porMetodo[v.metodoPago] = dinero((porMetodo[v.metodoPago] || 0) + v.total);
  return {
    totalVentas: dinero(ventas.reduce((s, v) => s + v.total, 0)),
    porMetodo,
    cantidadVentas: ventas.length,
  };
}

// Resumen de un día completo (reportes y API remota)
async function resumenDia(fecha) {
  const { inicio, fin } = rangoDia(fecha);
  const ventas = await prisma.venta.findMany({
    where: { fecha: { gte: inicio, lt: fin }, estado: 'CONFIRMADA' },
    select: { total: true, metodoPago: true },
  });
  return resumirVentas(ventas);
}

// Resumen del turno abierto: lo que se va a conciliar en el próximo cierre (RF-41)
async function resumenTurno(db = prisma) {
  const { inicio, fin } = rangoDia();
  const ultimoCierre = await db.cierreCaja.findFirst({
    where: { fecha: { gte: inicio, lt: fin } },
    orderBy: { fecha: 'desc' },
    include: { usuario: { select: { nombre: true } } },
  });
  const desde = ultimoCierre ? ultimoCierre.fecha : inicio;

  const ventas = await db.venta.findMany({
    where: {
      fecha: ultimoCierre ? { gt: desde, lt: fin } : { gte: desde, lt: fin },
      estado: 'CONFIRMADA',
    },
    select: { total: true, metodoPago: true },
  });
  const resumen = resumirVentas(ventas);
  return {
    ...resumen,
    // Solo el efectivo debe estar físicamente en la caja
    efectivoEsperado: resumen.porMetodo.EFECTIVO,
    desde,
    ultimoCierre: ultimoCierre && {
      id: ultimoCierre.id,
      fecha: ultimoCierre.fecha,
      usuario: ultimoCierre.usuario.nombre,
      diferencia: ultimoCierre.diferencia,
    },
  };
}

async function confirmarCierre(datos, actor) {
  const { efectivoContado, observaciones } = schemas.confirmarCierre.parse(datos);

  return prisma.$transaction(async (tx) => {
    // El resumen se recalcula dentro de la transacción: no se confía en el que vio la pantalla
    const resumen = await resumenTurno(tx);
    if (resumen.ultimoCierre && resumen.cantidadVentas === 0) {
      throw new AppError('Ya existe un cierre de caja y no hay ventas nuevas desde entonces');
    }

    const contado = dinero(efectivoContado);
    const diferencia = dinero(contado - resumen.efectivoEsperado);
    if (diferencia !== 0 && !observaciones) {
      throw new AppError('Hay una diferencia en caja: debe indicar la justificación en observaciones'); // RF-38
    }

    const cierre = await tx.cierreCaja.create({
      data: {
        usuarioId: actor.id,
        totalVentas: resumen.totalVentas,
        efectivoEsperado: resumen.efectivoEsperado,
        efectivoContado: contado,
        diferencia,
        observaciones,
        confirmado: true,
      },
    });
    await auditService.registrar({
      tabla: 'CierreCaja', accion: 'CONFIRMAR_CIERRE', registroId: cierre.id, usuarioId: actor.id,
      datosNuevos: { ...cierre, porMetodo: resumen.porMetodo, cantidadVentas: resumen.cantidadVentas },
    }, tx);
    return cierre;
  });
}

// RF-40: historial completo de cierres (solo administrador)
function listarCierres() {
  return prisma.cierreCaja.findMany({
    include: { usuario: { select: { nombre: true } } },
    orderBy: { fecha: 'desc' },
    take: 200,
  });
}

module.exports = { resumenDia, resumenTurno, confirmarCierre, listarCierres, resumirVentas };
