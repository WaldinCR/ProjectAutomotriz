// Servicio de Órdenes de Trabajo (RF-28 a RF-35)
// Flujo: PENDIENTE → EN_PROCESO → COMPLETADA → FACTURADA
//        PENDIENTE / EN_PROCESO → CANCELADA (devuelve los repuestos al inventario)
const crypto = require('crypto');
const prisma = require('../core/prisma');
const auditService = require('../audit/audit.service');
const schemas = require('../core/validation');
const { AppError } = require('../core/errors');
const { dinero } = require('../core/dates');
const { descontarStock, formatearFactura } = require('../pos/pos.service');

// Transiciones manuales permitidas. FACTURADA solo se alcanza con facturarOrden.
const TRANSICIONES = {
  PENDIENTE:  ['EN_PROCESO', 'CANCELADA'],
  EN_PROCESO: ['COMPLETADA', 'CANCELADA'],
  COMPLETADA: ['EN_PROCESO'],
  FACTURADA:  [],
  CANCELADA:  [],
};

async function crearOrden(datos, actor) {
  const data = schemas.crearOrden.parse(datos);

  return prisma.$transaction(async (tx) => {
    const ids = data.items.filter(i => i.productoId).map(i => i.productoId);
    const productos = await tx.producto.findMany({ where: { id: { in: ids } } });
    const porId = new Map(productos.map(p => [p.id, p]));

    // Cada línea es un repuesto del inventario (precio de la BD) o un servicio/mano de obra
    const detalles = data.items.map((it, idx) => {
      const linea = `Línea ${idx + 1}`;
      if (it.productoId) {
        const p = porId.get(it.productoId);
        if (!p || !p.activo) throw new AppError(`${linea}: el repuesto seleccionado no existe o está inactivo`, 'NO_ENCONTRADO');
        return {
          productoId: p.id,
          servicio: it.servicio || p.nombre,
          cantidad: it.cantidad,
          precioUnitario: p.precioVenta,
          subtotal: dinero(p.precioVenta * it.cantidad),
        };
      }
      if (!it.servicio) throw new AppError(`${linea}: indique la descripción del servicio`);
      if (it.precioUnitario === undefined) throw new AppError(`${linea}: indique el precio del servicio`);
      return {
        productoId: null,
        servicio: it.servicio,
        cantidad: it.cantidad,
        precioUnitario: dinero(it.precioUnitario),
        subtotal: dinero(it.precioUnitario * it.cantidad),
      };
    });

    const total = dinero(detalles.reduce((s, d) => s + d.subtotal, 0));

    const orden = await tx.ordenTrabajo.create({
      data: {
        vehiculo: data.vehiculo,
        placa: data.placa,
        cliente: data.cliente,
        telefono: data.telefono,
        descripcion: data.descripcion,
        usuarioId: actor.id,
        total,
        detalles: { create: detalles },
      },
      include: { detalles: true },
    });

    // RF-31: los repuestos usados se descuentan del inventario al crear la OT
    for (const d of detalles.filter(d => d.productoId)) {
      await descontarStock(tx, d.productoId, d.cantidad, d.servicio);
      await tx.movimientoInventario.create({
        data: {
          productoId: d.productoId, usuarioId: actor.id, tipo: 'SALIDA',
          cantidad: d.cantidad, motivo: `OT #${orden.id} — ${data.cliente}`,
        },
      });
    }

    await auditService.registrar({
      tabla: 'OrdenTrabajo', accion: 'CREAR_OT', registroId: orden.id, usuarioId: actor.id, datosNuevos: orden,
    }, tx);
    return orden;
  });
}

function listarOrdenes() {
  return prisma.ordenTrabajo.findMany({
    include: {
      detalles: { include: { producto: { select: { nombre: true, codigoInterno: true } } } },
      usuario: { select: { nombre: true } },
      venta: { select: { numeroFactura: true, metodoPago: true, estado: true } },
    },
    orderBy: { fechaCreacion: 'desc' },
  });
}

async function cambiarEstado(datos, actor) {
  const { ordenId, estado, motivo } = schemas.cambiarEstado.parse(datos);
  if (estado === 'FACTURADA') {
    throw new AppError('Para facturar una orden use la opción "Facturar" e indique el método de pago');
  }

  return prisma.$transaction(async (tx) => {
    const orden = await tx.ordenTrabajo.findUnique({ where: { id: ordenId }, include: { detalles: true } });
    if (!orden) throw new AppError('Orden de trabajo no encontrada', 'NO_ENCONTRADO');

    if (!TRANSICIONES[orden.estado]?.includes(estado)) {
      throw new AppError(`No se puede cambiar una orden ${orden.estado} a ${estado}`);
    }

    if (estado === 'CANCELADA') {
      if (!motivo) throw new AppError('Indique el motivo de la cancelación');
      for (const d of orden.detalles.filter(d => d.productoId)) {
        await tx.producto.update({ where: { id: d.productoId }, data: { stock: { increment: d.cantidad } } });
        await tx.movimientoInventario.create({
          data: {
            productoId: d.productoId, usuarioId: actor.id, tipo: 'ENTRADA',
            cantidad: d.cantidad, motivo: `Cancelación OT #${orden.id}`,
          },
        });
      }
    }

    const actualizada = await tx.ordenTrabajo.update({ where: { id: ordenId }, data: { estado } });
    await auditService.registrar({
      tabla: 'OrdenTrabajo', accion: `CAMBIAR_ESTADO_${estado}`, registroId: ordenId, usuarioId: actor.id,
      datosAnteriores: { estado: orden.estado }, datosNuevos: { estado, ...(motivo && { motivo }) },
    }, tx);
    return actualizada;
  });
}

// RF-33 / RF-34: solo una OT COMPLETADA se factura, y la factura queda vinculada
async function facturarOrden(datos, actor) {
  const { ordenId, metodoPago } = schemas.facturarOrden.parse(datos);

  return prisma.$transaction(async (tx) => {
    const orden = await tx.ordenTrabajo.findUnique({ where: { id: ordenId }, include: { detalles: true } });
    if (!orden) throw new AppError('Orden de trabajo no encontrada', 'NO_ENCONTRADO');
    if (orden.estado === 'FACTURADA') throw new AppError('La orden ya se encuentra facturada');
    if (orden.estado !== 'COMPLETADA') throw new AppError('Solo se pueden facturar órdenes en estado COMPLETADA');

    const creada = await tx.venta.create({
      data: {
        numeroFactura: `TMP-${crypto.randomUUID()}`,
        usuarioId: actor.id,
        total: orden.total,
        metodoPago,
        detalles: {
          create: orden.detalles.map(d => ({
            productoId: d.productoId,
            servicio: d.servicio,
            cantidad: d.cantidad,
            precioUnitario: d.precioUnitario,
            descuento: 0,
            subtotal: d.subtotal,
          })),
        },
      },
    });
    const venta = await tx.venta.update({
      where: { id: creada.id },
      data: { numeroFactura: formatearFactura(creada.id) },
      include: { detalles: true, usuario: { select: { nombre: true } } },
    });

    await tx.ordenTrabajo.update({ where: { id: ordenId }, data: { estado: 'FACTURADA', ventaId: venta.id } });

    await auditService.registrar({
      tabla: 'OrdenTrabajo', accion: 'FACTURAR_OT', registroId: ordenId, usuarioId: actor.id,
      datosAnteriores: { estado: orden.estado }, datosNuevos: { estado: 'FACTURADA', numeroFactura: venta.numeroFactura },
    }, tx);
    await auditService.registrar({
      tabla: 'Venta', accion: 'CONFIRMAR_VENTA', registroId: venta.id, usuarioId: actor.id,
      datosNuevos: { numeroFactura: venta.numeroFactura, total: venta.total, metodoPago, ordenId },
    }, tx);

    return venta;
  });
}

module.exports = { crearOrden, listarOrdenes, cambiarEstado, facturarOrden, TRANSICIONES };
