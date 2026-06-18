// Servicio de Punto de Venta
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function buscarProducto(codigo) {
  // Busca por código de barras O por código interno
  return prisma.producto.findFirst({
    where: {
      activo: true,
      OR: [
        { codigoBarras: codigo },
        { codigoInterno: codigo },
      ]
    }
  });
}

async function confirmarVenta({ usuarioId, items, metodoPago, descuentoTotal = 0 }) {
  if (!usuarioId) {
    throw new Error('El ID del cajero/usuario es requerido');
  }
  if (!items || items.length === 0) {
    throw new Error('El carrito de compras no puede estar vacío');
  }
  if (!metodoPago) {
    throw new Error('El método de pago es requerido');
  }

  // Genera número de factura único
  const numeroFactura = `FAC-${Date.now()}`;

  // Transacción atómica: todo o nada
  return prisma.$transaction(async (tx) => {
    // 1. Verificar stock de todos los items
    for (const item of items) {
      const producto = await tx.producto.findUnique({ where: { id: item.productoId } });
      if (!producto || producto.stock < item.cantidad) {
        throw new Error(`Stock insuficiente para: ${producto?.nombre || item.productoId}`);
      }
    }

    // 2. Calcular total
    const total = items.reduce((sum, item) => sum + item.subtotal, 0) - descuentoTotal;

    // 3. Crear la venta
    const venta = await tx.venta.create({
      data: {
        numeroFactura,
        usuarioId,
        total,
        metodoPago,
        detalles: {
          create: items.map(item => ({
            productoId:     item.productoId,
            cantidad:       item.cantidad,
            precioUnitario: item.precioUnitario,
            descuento:      item.descuento || 0,
            subtotal:       item.subtotal,
          }))
        }
      },
      include: { detalles: true }
    });

    // 4. Descontar stock de cada producto
    for (const item of items) {
      await tx.producto.update({
        where: { id: item.productoId },
        data:  { stock: { decrement: item.cantidad } }
      });

      // 5. Registrar movimiento de inventario
      await tx.movimientoInventario.create({
        data: {
          productoId: item.productoId,
          usuarioId,
          tipo:       'SALIDA',
          cantidad:   item.cantidad,
          motivo:     `Venta #${numeroFactura}`,
        }
      });
    }

    // 6. Registrar en AuditLog
    await tx.auditLog.create({
      data: {
        tabla:      'Venta',
        accion:     'CONFIRMAR_VENTA',
        registroId: venta.id,
        usuarioId,
        datosNuevos: JSON.stringify(venta),
      }
    });

    return venta;
  });
}

async function anularVenta({ ventaId, usuarioId, motivoAnulacion }) {
  return prisma.$transaction(async (tx) => {
    // 1. Obtener la venta
    const venta = await tx.venta.findUnique({
      where: { id: ventaId },
      include: { detalles: true }
    });

    if (!venta) throw new Error('Venta no encontrada');
    if (venta.estado === 'ANULADA') throw new Error('La venta ya se encuentra anulada');

    // 2. Cambiar estado a ANULADA
    const ventaAnulada = await tx.venta.update({
      where: { id: ventaId },
      data: {
        estado: 'ANULADA',
        motivoAnulacion
      },
      include: { detalles: true }
    });

    // 3. Revertir stock y registrar movimientos de inventario
    for (const detalle of venta.detalles) {
      if (detalle.productoId) {
        await tx.producto.update({
          where: { id: detalle.productoId },
          data: { stock: { increment: detalle.cantidad } }
        });

        await tx.movimientoInventario.create({
          data: {
            productoId: detalle.productoId,
            usuarioId,
            tipo: 'ENTRADA',
            cantidad: detalle.cantidad,
            motivo: `Anulación de venta #${venta.numeroFactura}`,
          }
        });
      }
    }

    // 4. Registrar en AuditLog
    await tx.auditLog.create({
      data: {
        tabla: 'Venta',
        accion: 'ANULAR_VENTA',
        registroId: venta.id,
        usuarioId,
        datosAnteriores: JSON.stringify(venta),
        datosNuevos: JSON.stringify(ventaAnulada),
      }
    });

    return ventaAnulada;
  });
}

module.exports = { buscarProducto, confirmarVenta, anularVenta };
