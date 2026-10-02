// Servicio de Órdenes de Trabajo (RF-28 a RF-35)
// Flujo: PENDIENTE → EN_PROCESO → COMPLETADA → FACTURADA
//        PENDIENTE / EN_PROCESO → CANCELADA (devuelve los repuestos al inventario)
// El técnico solo ve y trabaja las órdenes que tiene asignadas.
const prisma = require('../core/prisma');
const auditService = require('../audit/audit.service');
const schemas = require('../core/validation');
const { AppError } = require('../core/errors');
const { ROLES } = require('../core/roles');
const { dinero, rangoDia } = require('../core/dates');
const { descontarStock, registrarVenta, VENTA_COMPLETA } = require('../pos/pos.service');

// Transiciones manuales permitidas. FACTURADA solo se alcanza con facturarOrden.
const TRANSICIONES = {
  PENDIENTE:  ['EN_PROCESO', 'CANCELADA'],
  EN_PROCESO: ['COMPLETADA', 'CANCELADA'],
  COMPLETADA: ['EN_PROCESO'],
  FACTURADA:  [],
  CANCELADA:  [],
};
const EDITABLES = ['PENDIENTE', 'EN_PROCESO'];

const ORDEN_COMPLETA = {
  detalles: { include: { producto: { select: { nombre: true, codigoInterno: true, exentoItbis: true } } }, orderBy: { id: 'asc' } },
  usuario: { select: { nombre: true } },
  tecnico: { select: { id: true, nombre: true } },
  venta: { select: { id: true, numeroFactura: true, ncf: true, metodoPago: true, estado: true } },
};

const esTecnico = (actor) => actor.rol === ROLES.TECNICO;

// Carga la orden y verifica que el actor pueda operar sobre ella
async function cargarOrden(tx, ordenId, actor) {
  const orden = await tx.ordenTrabajo.findUnique({ where: { id: ordenId }, include: { detalles: true } });
  if (!orden) throw new AppError('Orden de trabajo no encontrada', 'NO_ENCONTRADO');
  if (esTecnico(actor) && orden.tecnicoId !== actor.id) {
    throw new AppError('Esta orden no está asignada a usted', 'PROHIBIDO');
  }
  return orden;
}

async function validarTecnico(tx, tecnicoId) {
  if (!tecnicoId) return null;
  const t = await tx.usuario.findUnique({ where: { id: tecnicoId } });
  if (!t || t.rol !== ROLES.TECNICO || !t.activo) throw new AppError('El técnico seleccionado no es válido');
  return t.id;
}

// Convierte una línea de entrada en una línea de detalle con precio confiable
async function prepararLinea(tx, it, etiqueta) {
  if (it.productoId) {
    const p = await tx.producto.findUnique({ where: { id: it.productoId } });
    if (!p || !p.activo) throw new AppError(`${etiqueta}: el repuesto seleccionado no existe o está inactivo`, 'NO_ENCONTRADO');
    return {
      productoId: p.id,
      servicio: it.servicio || p.nombre,
      cantidad: it.cantidad,
      precioUnitario: p.precioVenta,
      subtotal: dinero(p.precioVenta * it.cantidad),
    };
  }
  if (!it.servicio) throw new AppError(`${etiqueta}: indique la descripción del servicio`);
  if (it.precioUnitario === undefined) throw new AppError(`${etiqueta}: indique el precio del servicio`);
  return {
    productoId: null,
    servicio: it.servicio,
    cantidad: it.cantidad,
    precioUnitario: dinero(it.precioUnitario),
    subtotal: dinero(it.precioUnitario * it.cantidad),
  };
}

// RF-31: los repuestos usados se descuentan del inventario
async function consumirRepuesto(tx, linea, ordenId, cliente, actor) {
  await descontarStock(tx, linea.productoId, linea.cantidad, linea.servicio);
  await tx.movimientoInventario.create({
    data: {
      productoId: linea.productoId, usuarioId: actor.id, tipo: 'SALIDA',
      cantidad: linea.cantidad, motivo: `OT #${ordenId} — ${cliente}`,
    },
  });
}

async function devolverRepuesto(tx, linea, motivo, actor) {
  await tx.producto.update({ where: { id: linea.productoId }, data: { stock: { increment: linea.cantidad } } });
  await tx.movimientoInventario.create({
    data: { productoId: linea.productoId, usuarioId: actor.id, tipo: 'ENTRADA', cantidad: linea.cantidad, motivo },
  });
}

async function recalcularTotal(tx, ordenId) {
  const detalles = await tx.ordenTrabajo.findUnique({ where: { id: ordenId }, select: { detalles: { select: { subtotal: true } } } });
  const total = dinero(detalles.detalles.reduce((s, d) => s + d.subtotal, 0));
  return tx.ordenTrabajo.update({ where: { id: ordenId }, data: { total }, include: ORDEN_COMPLETA });
}

async function crearOrden(datos, actor) {
  const data = schemas.crearOrden.parse(datos);

  return prisma.$transaction(async (tx) => {
    const tecnicoId = await validarTecnico(tx, data.tecnicoId);
    const detalles = [];
    for (const [i, it] of data.items.entries()) detalles.push(await prepararLinea(tx, it, `Línea ${i + 1}`));

    const orden = await tx.ordenTrabajo.create({
      data: {
        vehiculo: data.vehiculo,
        placa: data.placa,
        cliente: data.cliente,
        telefono: data.telefono,
        descripcion: data.descripcion,
        usuarioId: actor.id,
        tecnicoId,
        total: dinero(detalles.reduce((s, d) => s + d.subtotal, 0)),
        detalles: { create: detalles },
      },
      include: ORDEN_COMPLETA,
    });

    for (const d of detalles.filter(d => d.productoId)) await consumirRepuesto(tx, d, orden.id, data.cliente, actor);

    await auditService.registrar({
      tabla: 'OrdenTrabajo', accion: 'CREAR_OT', registroId: orden.id, usuarioId: actor.id, datosNuevos: orden,
    }, tx);
    return orden;
  });
}

// RF-35: historial por técnico, estado y fecha. El técnico solo ve sus órdenes.
function listarOrdenes(filtros, actor) {
  const f = schemas.filtrosOrdenes.parse(filtros ?? {});
  const fecha = {};
  if (f.desde) fecha.gte = rangoDia(f.desde).inicio;
  if (f.hasta) fecha.lt = rangoDia(f.hasta).fin;

  return prisma.ordenTrabajo.findMany({
    where: {
      ...(f.estado && { estado: f.estado }),
      ...((f.desde || f.hasta) && { fechaCreacion: fecha }),
      ...(esTecnico(actor) ? { tecnicoId: actor.id } : f.tecnicoId && { tecnicoId: f.tecnicoId }),
    },
    include: ORDEN_COMPLETA,
    orderBy: { fechaCreacion: 'desc' },
  });
}

function listarTecnicos() {
  return prisma.usuario.findMany({
    where: { rol: ROLES.TECNICO, activo: true },
    select: { id: true, nombre: true },
    orderBy: { nombre: 'asc' },
  });
}

async function asignarTecnico(datos, actor) {
  const { ordenId, tecnicoId } = schemas.asignarTecnico.parse(datos);
  return prisma.$transaction(async (tx) => {
    const orden = await cargarOrden(tx, ordenId, actor);
    if (!EDITABLES.includes(orden.estado) && orden.estado !== 'COMPLETADA') {
      throw new AppError(`No se puede reasignar una orden ${orden.estado}`);
    }
    const id = await validarTecnico(tx, tecnicoId);
    const actualizada = await tx.ordenTrabajo.update({ where: { id: ordenId }, data: { tecnicoId: id }, include: ORDEN_COMPLETA });
    await auditService.registrar({
      tabla: 'OrdenTrabajo', accion: 'ASIGNAR_TECNICO', registroId: ordenId, usuarioId: actor.id,
      datosAnteriores: { tecnicoId: orden.tecnicoId }, datosNuevos: { tecnicoId: id },
    }, tx);
    return actualizada;
  });
}

// RF-30: el técnico (o caja) registra repuestos/servicios en una orden abierta
async function agregarItem(datos, actor) {
  const { ordenId, item } = schemas.agregarItemOrden.parse(datos);
  return prisma.$transaction(async (tx) => {
    const orden = await cargarOrden(tx, ordenId, actor);
    if (!EDITABLES.includes(orden.estado)) throw new AppError(`No se pueden agregar líneas a una orden ${orden.estado}`);

    const linea = await prepararLinea(tx, item, 'Línea');
    await tx.detalleOrden.create({ data: { ...linea, ordenId } });
    if (linea.productoId) await consumirRepuesto(tx, linea, ordenId, orden.cliente, actor);

    await auditService.registrar({
      tabla: 'OrdenTrabajo', accion: 'AGREGAR_LINEA_OT', registroId: ordenId, usuarioId: actor.id, datosNuevos: linea,
    }, tx);
    return recalcularTotal(tx, ordenId);
  });
}

async function quitarItem(datos, actor) {
  const { ordenId, detalleId } = schemas.quitarItemOrden.parse(datos);
  return prisma.$transaction(async (tx) => {
    const orden = await cargarOrden(tx, ordenId, actor);
    if (!EDITABLES.includes(orden.estado)) throw new AppError(`No se pueden quitar líneas de una orden ${orden.estado}`);
    const linea = orden.detalles.find(d => d.id === detalleId);
    if (!linea) throw new AppError('La línea no pertenece a esta orden', 'NO_ENCONTRADO');
    if (orden.detalles.length === 1) throw new AppError('La orden debe conservar al menos una línea');

    await tx.detalleOrden.delete({ where: { id: detalleId } });
    if (linea.productoId) await devolverRepuesto(tx, linea, `Línea retirada de OT #${ordenId}`, actor);

    await auditService.registrar({
      tabla: 'OrdenTrabajo', accion: 'QUITAR_LINEA_OT', registroId: ordenId, usuarioId: actor.id, datosAnteriores: linea,
    }, tx);
    return recalcularTotal(tx, ordenId);
  });
}

async function cambiarEstado(datos, actor) {
  const { ordenId, estado, motivo } = schemas.cambiarEstado.parse(datos);
  if (estado === 'FACTURADA') {
    throw new AppError('Para facturar una orden use la opción "Facturar" e indique el método de pago');
  }
  if (esTecnico(actor) && estado === 'CANCELADA') {
    throw new AppError('Solo caja o administración pueden cancelar una orden', 'PROHIBIDO');
  }

  return prisma.$transaction(async (tx) => {
    const orden = await cargarOrden(tx, ordenId, actor);
    if (!TRANSICIONES[orden.estado]?.includes(estado)) {
      throw new AppError(`No se puede cambiar una orden ${orden.estado} a ${estado}`);
    }

    if (estado === 'CANCELADA') {
      if (!motivo) throw new AppError('Indique el motivo de la cancelación');
      for (const d of orden.detalles.filter(d => d.productoId)) {
        await devolverRepuesto(tx, d, `Cancelación OT #${orden.id}`, actor);
      }
    }

    const actualizada = await tx.ordenTrabajo.update({ where: { id: ordenId }, data: { estado }, include: ORDEN_COMPLETA });
    await auditService.registrar({
      tabla: 'OrdenTrabajo', accion: `CAMBIAR_ESTADO_${estado}`, registroId: ordenId, usuarioId: actor.id,
      datosAnteriores: { estado: orden.estado }, datosNuevos: { estado, ...(motivo && { motivo }) },
    }, tx);
    return actualizada;
  });
}

// RF-33 / RF-34: solo una OT COMPLETADA se factura, y la factura queda vinculada
async function facturarOrden(datos, actor) {
  const { ordenId, metodoPago, tipoComprobante, clienteNombre, clienteRnc } = schemas.facturarOrden.parse(datos);

  return prisma.$transaction(async (tx) => {
    const orden = await tx.ordenTrabajo.findUnique({
      where: { id: ordenId },
      include: { detalles: { include: { producto: { select: { exentoItbis: true } } } } },
    });
    if (!orden) throw new AppError('Orden de trabajo no encontrada', 'NO_ENCONTRADO');
    if (orden.estado === 'FACTURADA') throw new AppError('La orden ya se encuentra facturada');
    if (orden.estado !== 'COMPLETADA') throw new AppError('Solo se pueden facturar órdenes en estado COMPLETADA');

    const venta = await registrarVenta(tx, {
      actor,
      metodoPago,
      ordenId,
      comprobante: { tipoComprobante, clienteNombre: clienteNombre || orden.cliente, clienteRnc },
      lineas: orden.detalles.map(d => ({
        productoId: d.productoId,
        servicio: d.servicio,
        cantidad: d.cantidad,
        precioUnitario: d.precioUnitario,
        exento: !!d.producto?.exentoItbis,
      })),
    });

    await tx.ordenTrabajo.update({ where: { id: ordenId }, data: { estado: 'FACTURADA', ventaId: venta.id } });
    await auditService.registrar({
      tabla: 'OrdenTrabajo', accion: 'FACTURAR_OT', registroId: ordenId, usuarioId: actor.id,
      datosAnteriores: { estado: orden.estado }, datosNuevos: { estado: 'FACTURADA', numeroFactura: venta.numeroFactura, ncf: venta.ncf },
    }, tx);

    // Se devuelve con la OT vinculada para mostrar la factura completa
    return tx.venta.findUnique({ where: { id: venta.id }, include: VENTA_COMPLETA });
  });
}

module.exports = {
  crearOrden, listarOrdenes, listarTecnicos, asignarTecnico, agregarItem, quitarItem,
  cambiarEstado, facturarOrden, TRANSICIONES,
};
