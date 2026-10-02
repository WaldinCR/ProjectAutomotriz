// Servicio de Inventario
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function listarProductos() {
  return prisma.producto.findMany({
    where: { activo: true },
    orderBy: { nombre: 'asc' }
  });
}

async function crearProducto(data) {
  if (!data.nombre || data.nombre.trim() === '') {
    throw new Error('El nombre del producto es requerido');
  }
  if (!data.categoria || data.categoria.trim() === '') {
    throw new Error('La categoría del producto es requerida');
  }
  if (data.precioCompra === undefined || data.precioCompra === null || isNaN(Number(data.precioCompra)) || Number(data.precioCompra) < 0) {
    throw new Error('El precio de compra es requerido y debe ser un número válido');
  }
  if (data.precioVenta === undefined || data.precioVenta === null || isNaN(Number(data.precioVenta)) || Number(data.precioVenta) < 0) {
    throw new Error('El precio de venta es requerido y debe ser un número válido');
  }

  // Auto-genera código interno si no tiene código de barras
  const codigoInterno = data.codigoInterno || `INT-${Date.now()}`;
  return prisma.producto.create({ data: { ...data, codigoInterno } });
}

async function registrarEntrada({ productoId, cantidad, motivo, usuarioId }) {
  return prisma.$transaction(async (tx) => {
    const producto = await tx.producto.update({
      where: { id: productoId },
      data:  { stock: { increment: cantidad } }
    });
    await tx.movimientoInventario.create({
      data: { productoId, usuarioId, tipo: 'ENTRADA', cantidad, motivo }
    });
    return producto;
  });
}

function productosStockBajo() {
  return prisma.producto.findMany({
    where: { activo: true, stock: { lte: prisma.producto.fields.stockMinimo } }
  });
}

async function editarProducto(data) {
  const { id, ...updateData } = data;
  if (!id) {
    throw new Error('El ID del producto es requerido');
  }
  if (updateData.nombre !== undefined && (!updateData.nombre || updateData.nombre.trim() === '')) {
    throw new Error('El nombre del producto no puede estar vacío');
  }
  if (updateData.categoria !== undefined && (!updateData.categoria || updateData.categoria.trim() === '')) {
    throw new Error('La categoría del producto no puede estar vacía');
  }
  if (updateData.precioCompra !== undefined && (updateData.precioCompra === null || isNaN(Number(updateData.precioCompra)) || Number(updateData.precioCompra) < 0)) {
    throw new Error('El precio de compra debe ser un número válido');
  }
  if (updateData.precioVenta !== undefined && (updateData.precioVenta === null || isNaN(Number(updateData.precioVenta)) || Number(updateData.precioVenta) < 0)) {
    throw new Error('El precio de venta debe ser un número válido');
  }

  return prisma.$transaction(async (tx) => {
    const original = await tx.producto.findUnique({ where: { id } });
    if (!original) throw new Error('Producto no encontrado');

    const updated = await tx.producto.update({
      where: { id },
      data: updateData
    });

    await tx.auditLog.create({
      data: {
        tabla: 'Producto',
        accion: 'EDITAR_PRODUCTO',
        registroId: id,
        datosAnteriores: JSON.stringify(original),
        datosNuevos: JSON.stringify(updated)
      }
    });

    return updated;
  });
}

module.exports = { listarProductos, crearProducto, registrarEntrada, productosStockBajo, editarProducto };
