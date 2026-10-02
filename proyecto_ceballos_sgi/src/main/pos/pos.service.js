// Servicio de Punto de Venta (RF-08 a RF-18)
// Los precios y totales SIEMPRE se calculan aquí a partir de la base de datos;
// del renderer solo se aceptan productoId, cantidad y descuentos.
const crypto = require('crypto');
const prisma = require('../core/prisma');
const auditService = require('../audit/audit.service');
const schemas = require('../core/validation');
const { AppError } = require('../core/errors');
const { dinero, rangoDia } = require('../core/dates');

// Búsqueda exacta por código de barras o código interno (lector USB)
function buscarProducto(codigo) {
  const q = schemas.busqueda.parse(codigo);
  return prisma.producto.findFirst({
    where: { activo: true, OR: [{ codigoBarras: q }, { codigoInterno: q }] },
  });
}

// Número de factura correlativo derivado del id: FAC-00000001
function formatearFactura(id, prefijo = 'FAC') {
  return `${prefijo}-${String(id).padStart(8, '0')}`;
}

// Descuenta stock de forma atómica: la condición stock >= cantidad se evalúa
// en la misma sentencia UPDATE, por lo que nunca queda stock negativo.
async function descontarStock(tx, productoId, cantidad, nombre) {
  const r = await tx.producto.updateMany({
    where: { id: productoId, stock: { gte: cantidad } },
    data: { stock: { decrement: cantidad } },
  });
  if (r.count !== 1) {
    const p = await tx.producto.findUnique({ where: { id: productoId }, select: { stock: true } });
    throw new AppError(`Stock insuficiente para "${nombre}". Disponible: ${p?.stock ?? 0}, solicitado: ${cantidad}`, 'STOCK');
  }
}

async function confirmarVenta(datos, actor) {
  const { items, metodoPago, descuentoTotal } = schemas.confirmarVenta.parse(datos);

  // Agrupa líneas repetidas del mismo producto para validar el stock total
  const agrupados = new Map();
  for (const it of items) {
    const previo = agrupados.get(it.productoId);
    agrupados.set(it.productoId, {
      productoId: it.productoId,
      cantidad: (previo?.cantidad || 0) + it.cantidad,
      descuento: (previo?.descuento || 0) + it.descuento,
    });
  }

  return prisma.$transaction(async (tx) => {
    const productos = await tx.producto.findMany({ where: { id: { in: [...agrupados.keys()] } } });
    const porId = new Map(productos.map(p => [p.id, p]));

    const detalles = [];
    for (const it of agrupados.values()) {
      const p = porId.get(it.productoId);
      if (!p || !p.activo) throw new AppError(`El producto #${it.productoId} no existe o está inactivo`, 'NO_ENCONTRADO');

      const bruto = dinero(p.precioVenta * it.cantidad);
      if (it.descuento > bruto) throw new AppError(`El descuento de "${p.nombre}" supera su importe`);
      detalles.push({
        productoId: p.id,
        nombre: p.nombre,
        cantidad: it.cantidad,
        precioUnitario: p.precioVenta,
        descuento: dinero(it.descuento),
        subtotal: dinero(bruto - it.descuento),
      });
    }

    const subtotal = dinero(detalles.reduce((s, d) => s + d.subtotal, 0));
    if (descuentoTotal > subtotal) throw new AppError('El descuento no puede ser mayor que el total de la venta');
    const total = dinero(subtotal - descuentoTotal);

    for (const d of detalles) await descontarStock(tx, d.productoId, d.cantidad, d.nombre);

    // Se crea con un número temporal y luego se asigna el correlativo por id
    const creada = await tx.venta.create({
      data: {
        numeroFactura: `TMP-${crypto.randomUUID()}`,
        usuarioId: actor.id,
        descuento: dinero(descuentoTotal),
        total,
        metodoPago,
        detalles: {
          create: detalles.map(({ nombre, ...d }) => d),
        },
      },
    });
    const numeroFactura = formatearFactura(creada.id);
    const venta = await tx.venta.update({
      where: { id: creada.id },
      data: { numeroFactura },
      include: {
        detalles: { include: { producto: { select: { nombre: true, codigoInterno: true } } } },
        usuario: { select: { nombre: true } },
      },
    });

    await tx.movimientoInventario.createMany({
      data: detalles.map(d => ({
        productoId: d.productoId, usuarioId: actor.id, tipo: 'SALIDA', cantidad: d.cantidad, motivo: `Venta ${numeroFactura}`,
      })),
    });
    await auditService.registrar({
      tabla: 'Venta', accion: 'CONFIRMAR_VENTA', registroId: venta.id, usuarioId: actor.id,
      datosNuevos: { numeroFactura, total, metodoPago, descuento: descuentoTotal, items: detalles.length },
    }, tx);

    return venta;
  });
}

// RF-16 / RF-17: anulación con justificación; la venta se conserva en el historial
async function anularVenta(datos, actor) {
  const { ventaId, motivoAnulacion } = schemas.anularVenta.parse(datos);

  return prisma.$transaction(async (tx) => {
    const venta = await tx.venta.findUnique({
      where: { id: ventaId },
      include: { detalles: true, ordenTrabajo: true },
    });

    if (!venta) throw new AppError('Venta no encontrada', 'NO_ENCONTRADO');
    if (venta.estado === 'ANULADA') throw new AppError('La venta ya se encuentra anulada');

    // No se puede anular una venta de un día que ya tiene cierre de caja
    const { inicio, fin } = rangoDia();
    const ultimoCierre = await tx.cierreCaja.findFirst({
      where: { fecha: { gte: inicio, lt: fin } },
      orderBy: { fecha: 'desc' },
    });
    if (venta.fecha < inicio || (ultimoCierre && venta.fecha <= ultimoCierre.fecha)) {
      throw new AppError('Solo se pueden anular ventas del día que aún no estén incluidas en un cierre de caja');
    }

    const ventaAnulada = await tx.venta.update({
      where: { id: ventaId },
      data: { estado: 'ANULADA', motivoAnulacion },
    });

    // Si la venta provenía de una OT, la orden vuelve a COMPLETADA para refacturarla
    if (venta.ordenTrabajo) {
      await tx.ordenTrabajo.update({
        where: { id: venta.ordenTrabajo.id },
        data: { estado: 'COMPLETADA', ventaId: null },
      });
    }

    // Los repuestos de una OT se devuelven al cancelar la orden, no al anular su factura
    if (!venta.ordenTrabajo) {
      for (const d of venta.detalles.filter(d => d.productoId)) {
        await tx.producto.update({
          where: { id: d.productoId },
          data: { stock: { increment: d.cantidad } },
        });
        await tx.movimientoInventario.create({
          data: {
            productoId: d.productoId, usuarioId: actor.id, tipo: 'ENTRADA',
            cantidad: d.cantidad, motivo: `Anulación de venta ${venta.numeroFactura}`,
          },
        });
      }
    }

    await auditService.registrar({
      tabla: 'Venta', accion: 'ANULAR_VENTA', registroId: venta.id, usuarioId: actor.id,
      datosAnteriores: { estado: venta.estado, total: venta.total },
      datosNuevos: { estado: 'ANULADA', motivoAnulacion },
    }, tx);

    return ventaAnulada;
  });
}

// Ventas del día (confirmadas y anuladas) para consulta y anulación
function listarVentas(filtros) {
  const { fecha } = schemas.listarVentas.parse(filtros ?? {});
  const { inicio, fin } = rangoDia(fecha);
  return prisma.venta.findMany({
    where: { fecha: { gte: inicio, lt: fin } },
    include: {
      usuario: { select: { nombre: true } },
      detalles: { include: { producto: { select: { nombre: true } } } },
    },
    orderBy: { fecha: 'desc' },
  });
}

module.exports = { buscarProducto, confirmarVenta, anularVenta, listarVentas, descontarStock, formatearFactura };
