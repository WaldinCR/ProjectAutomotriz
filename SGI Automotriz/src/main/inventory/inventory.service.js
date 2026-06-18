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
