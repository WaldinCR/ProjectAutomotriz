// Servicio de Caja y Cierre Diario
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function resumenDia(fechaParam) {
  const hoy = fechaParam ? new Date(fechaParam) : new Date();
  hoy.setHours(0, 0, 0, 0);
  const manana = new Date(hoy);
  manana.setDate(manana.getDate() + 1);

  const ventas = await prisma.venta.findMany({
    where: {
      fecha:  { gte: hoy, lt: manana },
      estado: 'CONFIRMADA'
    }
  });

  const totalVentas = ventas.reduce((sum, v) => sum + v.total, 0);

  // Desglose por método de pago
  const porMetodo = ventas.reduce((acc, v) => {
    acc[v.metodoPago] = (acc[v.metodoPago] || 0) + v.total;
    return acc;
  }, {});

  return { totalVentas, porMetodo, cantidadVentas: ventas.length };
}

async function confirmarCierre({ usuarioId, efectivoContado, observaciones }) {
  if (!usuarioId) {
    throw new Error('El ID de usuario es requerido');
  }
  if (efectivoContado === undefined || efectivoContado === null || isNaN(Number(efectivoContado)) || Number(efectivoContado) < 0) {
    throw new Error('El monto de efectivo contado es requerido y debe ser un número válido mayor o igual a 0');
  }

  const resumen = await resumenDia();
  const diferencia = efectivoContado - resumen.totalVentas;

  // Registro INMUTABLE — nunca se borra ni modifica
  return prisma.$transaction(async (tx) => {
    const cierre = await tx.cierreCaja.create({
      data: {
        usuarioId,
        totalVentas:      resumen.totalVentas,
        efectivoEsperado: resumen.totalVentas,
        efectivoContado,
        diferencia,
        observaciones,
        confirmado: true,
      }
    });
    await tx.auditLog.create({
      data: {
        tabla: 'CierreCaja', accion: 'CONFIRMAR_CIERRE',
        registroId: cierre.id, usuarioId,
        datosNuevos: JSON.stringify(cierre),
      }
    });
    return cierre;
  });
}

module.exports = { resumenDia, confirmarCierre };
