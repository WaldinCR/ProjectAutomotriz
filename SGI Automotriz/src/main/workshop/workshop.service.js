// Servicio de Órdenes de Trabajo
// El cajero crea la OT cuando el cliente solicita un servicio en caja.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function crearOrden({ usuarioId, vehiculo, cliente, telefono, descripcion, items }) {
  return prisma.$transaction(async (tx) => {
    // 1. Calcular total
    const total = items.reduce((sum, i) => sum + i.subtotal, 0);

    // 2. Crear la orden
    const orden = await tx.ordenTrabajo.create({
      data: {
        vehiculo, cliente, telefono, descripcion, usuarioId, total,
        detalles: {
          create: items.map(i => ({
            productoId:     i.productoId || null,
            servicio:       i.servicio,
            cantidad:       i.cantidad,
            precioUnitario: i.precioUnitario,
            subtotal:       i.subtotal,
          }))
        }
      },
      include: { detalles: true }
    });

    // 3. Descontar stock de repuestos usados
    for (const item of items.filter(i => i.productoId)) {
      await tx.producto.update({
        where: { id: item.productoId },
        data:  { stock: { decrement: item.cantidad } }
      });
      await tx.movimientoInventario.create({
        data: {
          productoId: item.productoId,
          usuarioId,
          tipo:    'SALIDA',
          cantidad: item.cantidad,
          motivo:  `OT #${orden.id} — ${cliente}`,
        }
      });
    }

    // 4. Audit log
    await tx.auditLog.create({
      data: {
        tabla: 'OrdenTrabajo', accion: 'CREAR_OT',
        registroId: orden.id, usuarioId,
        datosNuevos: JSON.stringify(orden),
      }
    });

    return orden;
  });
}

function listarOrdenes() {
  return prisma.ordenTrabajo.findMany({
    include: { detalles: { include: { producto: true } }, usuario: true },
    orderBy: { fechaCreacion: 'desc' }
  });
}

async function cambiarEstado({ ordenId, estado, usuarioId }) {
  if (estado === 'FACTURADA') {
    return facturarOrden({ ordenId, usuarioId });
  }

  const orden = await prisma.ordenTrabajo.update({
    where: { id: ordenId },
    data:  { estado }
  });
  await prisma.auditLog.create({
    data: {
      tabla: 'OrdenTrabajo', accion: `CAMBIAR_ESTADO_${estado}`,
      registroId: ordenId, usuarioId,
      datosNuevos: JSON.stringify({ estado }),
    }
  });
  return orden;
}

async function facturarOrden({ ordenId, usuarioId, metodoPago = 'EFECTIVO' }) {
  return prisma.$transaction(async (tx) => {
    // 1. Obtener la orden con detalles
    const orden = await tx.ordenTrabajo.findUnique({
      where: { id: ordenId },
      include: { detalles: true }
    });

    if (!orden) throw new Error('Orden de trabajo no encontrada');
    if (orden.estado === 'FACTURADA') throw new Error('La orden ya se encuentra facturada');

    // 2. Generar número de factura único
    const numeroFactura = `FAC-OT-${ordenId}-${Date.now()}`;

    // 3. Crear la Venta
    const venta = await tx.venta.create({
      data: {
        numeroFactura,
        usuarioId,
        total: orden.total,
        metodoPago,
        detalles: {
          create: orden.detalles.map(item => ({
            productoId:     item.productoId || null,
            servicio:       item.servicio,
            cantidad:       item.cantidad,
            precioUnitario: item.precioUnitario,
            descuento:      0,
            subtotal:       item.subtotal,
          }))
        }
      },
      include: { detalles: true }
    });

    // 4. Vincular la orden a la venta y actualizar estado a FACTURADA
    const ordenActualizada = await tx.ordenTrabajo.update({
      where: { id: ordenId },
      data: {
        estado: 'FACTURADA',
        ventaId: venta.id
      }
    });

    // 5. Registrar en AuditLog
    await tx.auditLog.create({
      data: {
        tabla: 'OrdenTrabajo',
        accion: 'FACTURAR_OT',
        registroId: ordenId,
        usuarioId,
        datosAnteriores: JSON.stringify(orden),
        datosNuevos: JSON.stringify(ordenActualizada)
      }
    });

    await tx.auditLog.create({
      data: {
        tabla: 'Venta',
        accion: 'CONFIRMAR_VENTA',
        registroId: venta.id,
        usuarioId,
        datosNuevos: JSON.stringify(venta)
      }
    });

    return venta;
  });
}

module.exports = { crearOrden, listarOrdenes, cambiarEstado, facturarOrden };
