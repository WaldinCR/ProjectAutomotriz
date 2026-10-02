// Servicio de Punto de Venta (RF-08 a RF-18)
// Los precios, el ITBIS y los totales SIEMPRE se calculan aquí a partir de la
// base de datos; del renderer solo se aceptan productoId, cantidad y descuentos.
const crypto = require('crypto');
const prisma = require('../core/prisma');
const auditService = require('../audit/audit.service');
const schemas = require('../core/validation');
const { AppError } = require('../core/errors');
const { dinero, rangoDia } = require('../core/dates');
const { calcularVenta: calcularImpuestos, validarComprobante, normalizarRnc, tomarNcf } = require('../core/fiscal');
const configService = require('../config/config.service');

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

// Datos que necesita la factura en pantalla, PDF y ticket
const VENTA_COMPLETA = {
  detalles: { include: { producto: { select: { nombre: true, codigoInterno: true } } } },
  usuario: { select: { nombre: true } },
  ordenTrabajo: { select: { id: true, vehiculo: true, placa: true, cliente: true } },
};

// Resuelve el comprobante fiscal según la configuración de la empresa
function resolverComprobante(datos, config) {
  if (config.emitirNcf) {
    return validarComprobante({ ...datos, tipoComprobante: datos.tipoComprobante || 'B02' });
  }
  // Sin NCF se guardan los datos del cliente si se indicaron, sin comprobante fiscal
  return {
    tipoComprobante: null,
    clienteNombre: datos.clienteNombre || null,
    clienteRnc: datos.clienteRnc ? normalizarRnc(datos.clienteRnc) : null,
  };
}

/**
 * Crea una venta completa dentro de una transacción: ITBIS, NCF, número de
 * factura correlativo y auditoría. La usan el POS y la facturación de OT.
 * lineas: [{ productoId, servicio, cantidad, precioUnitario, descuento, exento }]
 */
async function registrarVenta(tx, { actor, lineas, descuentoTotal = 0, metodoPago, comprobante, ordenId }) {
  const config = await configService.obtener(tx);
  const fiscal = resolverComprobante(comprobante || {}, config);
  const calculo = calcularImpuestos(
    lineas.map(l => ({ importe: dinero(l.precioUnitario * l.cantidad - (l.descuento || 0)), exento: !!l.exento })),
    descuentoTotal,
    config,
  );
  const ncf = fiscal.tipoComprobante ? await tomarNcf(tx, fiscal.tipoComprobante) : null;

  // Se crea con un número temporal y luego se asigna el correlativo por id
  const creada = await tx.venta.create({
    data: {
      numeroFactura: `TMP-${crypto.randomUUID()}`,
      usuarioId: actor.id,
      subtotal: calculo.subtotal,
      itbis: calculo.itbis,
      descuento: calculo.descuento,
      total: calculo.total,
      metodoPago,
      ...fiscal,
      ncf,
      detalles: {
        create: lineas.map((l, i) => ({
          productoId: l.productoId || null,
          servicio: l.servicio || null,
          cantidad: l.cantidad,
          precioUnitario: l.precioUnitario,
          descuento: dinero(l.descuento || 0),
          itbis: calculo.lineas[i].itbis,
          subtotal: dinero(l.precioUnitario * l.cantidad - (l.descuento || 0)),
        })),
      },
    },
  });
  const venta = await tx.venta.update({
    where: { id: creada.id },
    data: { numeroFactura: formatearFactura(creada.id) },
    include: VENTA_COMPLETA,
  });

  await auditService.registrar({
    tabla: 'Venta', accion: 'CONFIRMAR_VENTA', registroId: venta.id, usuarioId: actor.id,
    datosNuevos: {
      numeroFactura: venta.numeroFactura, ncf, total: venta.total, itbis: venta.itbis,
      metodoPago, descuento: venta.descuento, lineas: lineas.length, ...(ordenId && { ordenId }),
    },
  }, tx);
  return venta;
}

// Agrupa líneas repetidas del mismo producto y las completa con los datos de la BD
async function prepararLineas(tx, items) {
  const agrupados = new Map();
  for (const it of items) {
    const previo = agrupados.get(it.productoId);
    agrupados.set(it.productoId, {
      productoId: it.productoId,
      cantidad: (previo?.cantidad || 0) + it.cantidad,
      descuento: (previo?.descuento || 0) + it.descuento,
    });
  }
  const productos = await tx.producto.findMany({ where: { id: { in: [...agrupados.keys()] } } });
  const porId = new Map(productos.map(p => [p.id, p]));

  return [...agrupados.values()].map((it) => {
    const p = porId.get(it.productoId);
    if (!p || !p.activo) throw new AppError(`El producto #${it.productoId} no existe o está inactivo`, 'NO_ENCONTRADO');
    const bruto = dinero(p.precioVenta * it.cantidad);
    if (it.descuento > bruto) throw new AppError(`El descuento de "${p.nombre}" supera su importe`);
    return {
      productoId: p.id, nombre: p.nombre, cantidad: it.cantidad, stock: p.stock,
      precioUnitario: p.precioVenta, descuento: dinero(it.descuento), exento: p.exentoItbis,
    };
  });
}

// Vista previa de totales e ITBIS para la pantalla del POS (no guarda nada)
async function calcularVenta(datos) {
  const { items, descuentoTotal } = schemas.calcularVenta.parse(datos);
  const lineas = await prepararLineas(prisma, items);
  const config = await configService.obtener();
  const calculo = calcularImpuestos(
    lineas.map(l => ({ importe: dinero(l.precioUnitario * l.cantidad - l.descuento), exento: l.exento })),
    descuentoTotal,
    config,
  );
  return { ...calculo, lineas: undefined, preciosIncluyenItbis: config.preciosIncluyenItbis, tasaItbis: config.tasaItbis };
}

async function confirmarVenta(datos, actor) {
  const { items, metodoPago, descuentoTotal, tipoComprobante, clienteNombre, clienteRnc } = schemas.confirmarVenta.parse(datos);

  return prisma.$transaction(async (tx) => {
    const lineas = await prepararLineas(tx, items);
    for (const l of lineas) await descontarStock(tx, l.productoId, l.cantidad, l.nombre);

    const venta = await registrarVenta(tx, {
      actor, lineas, descuentoTotal, metodoPago,
      comprobante: { tipoComprobante, clienteNombre, clienteRnc },
    });

    await tx.movimientoInventario.createMany({
      data: lineas.map(l => ({
        productoId: l.productoId, usuarioId: actor.id, tipo: 'SALIDA', cantidad: l.cantidad, motivo: `Venta ${venta.numeroFactura}`,
      })),
    });
    return venta;
  });
}

async function obtenerVenta(ventaId) {
  const id = schemas.id('La venta').parse(ventaId);
  const venta = await prisma.venta.findUnique({ where: { id }, include: VENTA_COMPLETA });
  if (!venta) throw new AppError('Venta no encontrada', 'NO_ENCONTRADO');
  return venta;
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
    include: VENTA_COMPLETA,
    orderBy: { fecha: 'desc' },
  });
}

module.exports = {
  buscarProducto, calcularVenta, confirmarVenta, anularVenta, listarVentas, obtenerVenta,
  registrarVenta, descontarStock, formatearFactura, VENTA_COMPLETA,
};
