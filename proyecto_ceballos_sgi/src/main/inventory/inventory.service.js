// Servicio de Inventario (RF-19 a RF-27)
// Regla: el stock SOLO cambia mediante movimientos registrados (venta, OT,
// entrada o ajuste). Nunca se edita directamente.
const prisma = require('../core/prisma');
const auditService = require('../audit/audit.service');
const schemas = require('../core/validation');
const { AppError } = require('../core/errors');
const { dinero } = require('../core/dates');

function listarProductos({ incluirInactivos = false } = {}) {
  return prisma.producto.findMany({
    where: incluirInactivos ? {} : { activo: true },
    orderBy: { nombre: 'asc' },
  });
}

// RF-10: búsqueda por nombre, categoría o código
function buscarProductos(termino) {
  const q = schemas.busqueda.parse(termino);
  return prisma.producto.findMany({
    where: {
      activo: true,
      OR: [
        { nombre: { contains: q } },
        { categoria: { contains: q } },
        { codigoInterno: { contains: q } },
        { codigoBarras: { contains: q } },
      ],
    },
    orderBy: { nombre: 'asc' },
    take: 20,
  });
}

function productosStockBajo() {
  return prisma.producto.findMany({
    where: { activo: true, stock: { lte: prisma.producto.fields.stockMinimo } },
    orderBy: { stock: 'asc' },
  });
}

async function generarCodigoInterno(tx) {
  const ultimo = await tx.producto.findFirst({ orderBy: { id: 'desc' }, select: { id: true } });
  let n = (ultimo?.id || 0) + 1;
  // Garantiza unicidad aunque existan códigos manuales con el mismo formato
  while (await tx.producto.findUnique({ where: { codigoInterno: `INT-${String(n).padStart(6, '0')}` } })) n++;
  return `INT-${String(n).padStart(6, '0')}`;
}

async function crearProducto(datos, actor) {
  const data = schemas.crearProducto.parse(datos);

  return prisma.$transaction(async (tx) => {
    const codigoInterno = data.codigoInterno || await generarCodigoInterno(tx); // RF-27
    const producto = await tx.producto.create({
      data: {
        nombre: data.nombre,
        categoria: data.categoria,
        codigoBarras: data.codigoBarras,
        codigoInterno,
        precioCompra: dinero(data.precioCompra),
        precioVenta: dinero(data.precioVenta),
        stock: data.stock,
        stockMinimo: data.stockMinimo,
      },
    });

    if (data.stock > 0) {
      await tx.movimientoInventario.create({
        data: { productoId: producto.id, usuarioId: actor.id, tipo: 'ENTRADA', cantidad: data.stock, motivo: 'Stock inicial' },
      });
    }
    await auditService.registrar({
      tabla: 'Producto', accion: 'CREAR_PRODUCTO', registroId: producto.id, usuarioId: actor.id, datosNuevos: producto,
    }, tx);
    return producto;
  });
}

async function editarProducto(datos, actor) {
  const { id, ...cambios } = schemas.editarProducto.parse(datos);
  if (cambios.precioCompra !== undefined) cambios.precioCompra = dinero(cambios.precioCompra);
  if (cambios.precioVenta !== undefined) cambios.precioVenta = dinero(cambios.precioVenta);

  return prisma.$transaction(async (tx) => {
    const original = await tx.producto.findUnique({ where: { id } });
    if (!original) throw new AppError('Producto no encontrado', 'NO_ENCONTRADO');

    const compra = cambios.precioCompra ?? original.precioCompra;
    const venta = cambios.precioVenta ?? original.precioVenta;
    if (venta < compra) throw new AppError('El precio de venta no puede ser menor que el precio de compra');

    const actualizado = await tx.producto.update({ where: { id }, data: cambios });

    // RF-50: los cambios de precio se registran con una acción propia
    const cambioPrecio = original.precioVenta !== actualizado.precioVenta || original.precioCompra !== actualizado.precioCompra;
    await auditService.registrar({
      tabla: 'Producto',
      accion: cambioPrecio ? 'CAMBIO_PRECIO' : 'EDITAR_PRODUCTO',
      registroId: id, usuarioId: actor.id,
      datosAnteriores: original, datosNuevos: actualizado,
    }, tx);
    return actualizado;
  });
}

// RF-21: entrada de mercancía (compras, devoluciones)
async function registrarEntrada(datos, actor) {
  const { productoId, cantidad, motivo } = schemas.entradaInventario.parse(datos);

  return prisma.$transaction(async (tx) => {
    const existe = await tx.producto.findUnique({ where: { id: productoId } });
    if (!existe) throw new AppError('Producto no encontrado', 'NO_ENCONTRADO');

    const producto = await tx.producto.update({
      where: { id: productoId },
      data: { stock: { increment: cantidad } },
    });
    await tx.movimientoInventario.create({
      data: { productoId, usuarioId: actor.id, tipo: 'ENTRADA', cantidad, motivo },
    });
    await auditService.registrar({
      tabla: 'Producto', accion: 'ENTRADA_INVENTARIO', registroId: productoId, usuarioId: actor.id,
      datosAnteriores: { stock: existe.stock }, datosNuevos: { stock: producto.stock, cantidad, motivo },
    }, tx);
    return producto;
  });
}

// RF-22: ajuste manual (positivo o negativo) con motivo obligatorio
async function registrarAjuste(datos, actor) {
  const { productoId, cantidad, motivo } = schemas.ajusteInventario.parse(datos);

  return prisma.$transaction(async (tx) => {
    const existe = await tx.producto.findUnique({ where: { id: productoId } });
    if (!existe) throw new AppError('Producto no encontrado', 'NO_ENCONTRADO');
    if (existe.stock + cantidad < 0) {
      throw new AppError(`El ajuste dejaría el stock en negativo (stock actual: ${existe.stock})`);
    }

    const producto = await tx.producto.update({
      where: { id: productoId },
      data: { stock: { increment: cantidad } },
    });
    await tx.movimientoInventario.create({
      data: { productoId, usuarioId: actor.id, tipo: 'AJUSTE', cantidad, motivo },
    });
    await auditService.registrar({
      tabla: 'Producto', accion: 'AJUSTE_INVENTARIO', registroId: productoId, usuarioId: actor.id,
      datosAnteriores: { stock: existe.stock }, datosNuevos: { stock: producto.stock, cantidad, motivo },
    }, tx);
    return producto;
  });
}

// RF-24: historial de movimientos por producto
function historialMovimientos(productoId) {
  const id = schemas.id('El producto').parse(productoId);
  return prisma.movimientoInventario.findMany({
    where: { productoId: id },
    include: { usuario: { select: { nombre: true } } },
    orderBy: { fecha: 'desc' },
    take: 200,
  });
}

module.exports = {
  listarProductos,
  buscarProductos,
  productosStockBajo,
  crearProducto,
  editarProducto,
  registrarEntrada,
  registrarAjuste,
  historialMovimientos,
};
