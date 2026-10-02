// Servicio de Reportes PDF (RF-43 a RF-48)
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const prisma = require('../core/prisma');
const schemas = require('../core/validation');
const { rangoDia, rangoMes, dinero, fechaLocalISO } = require('../core/dates');
const { resumirVentas } = require('../cashier/cashier.service');

const COLOR_TITULO = '#1e3a8a';
const COLOR_TEXTO = '#374151';
const METODOS = ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'];
const NOMBRE_MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const rd = (n) => `RD$ ${Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Electron se carga de forma diferida para poder probar el servicio con Node puro
function carpetaSalida() {
  if (process.env.REPORTS_DIR) return process.env.REPORTS_DIR;
  const { app } = require('electron');
  return app.getPath('downloads');
}

function crearDocumento(nombreArchivo, titulo, subtitulo) {
  const dir = carpetaSalida();
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, nombreArchivo);
  const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
  const stream = fs.createWriteStream(filePath);
  const terminado = new Promise((resolve, reject) => {
    stream.on('finish', () => resolve(filePath));
    stream.on('error', reject);
    doc.on('error', reject);
  });
  doc.pipe(stream);

  doc.fillColor(COLOR_TITULO).fontSize(20).text('Repuestos Ceballos — SGI Automotriz', { align: 'center' });
  doc.fillColor('#4b5563').fontSize(13).text(titulo, { align: 'center' });
  if (subtitulo) doc.fontSize(9).text(subtitulo, { align: 'center' });
  doc.fontSize(8).text(`Generado: ${new Date().toLocaleString('es-DO')}`, { align: 'center' });
  doc.moveDown(1);
  linea(doc);
  return { doc, terminado };
}

function linea(doc) {
  doc.strokeColor('#e5e7eb').lineWidth(1).moveTo(50, doc.y).lineTo(562, doc.y).stroke();
  doc.moveDown(0.8);
}

function seccion(doc, texto) {
  doc.moveDown(0.5);
  doc.font('Helvetica-Bold').fillColor(COLOR_TITULO).fontSize(13).text(texto, 50);
  doc.font('Helvetica').fillColor(COLOR_TEXTO).fontSize(10);
  doc.moveDown(0.4);
}

function dato(doc, etiqueta, valor, { negrita = false, color = COLOR_TEXTO } = {}) {
  doc.font(negrita ? 'Helvetica-Bold' : 'Helvetica').fillColor(color).fontSize(10).text(`${etiqueta}: ${valor}`, 50);
  doc.font('Helvetica').fillColor(COLOR_TEXTO);
}

// Tabla simple con salto de página y encabezados repetidos
// columnas: [{ titulo, ancho, align }]
function tabla(doc, columnas, filas, textoVacio) {
  const dibujarEncabezado = () => {
    let x = 50;
    const y = doc.y;
    doc.font('Helvetica-Bold').fillColor(COLOR_TITULO).fontSize(9);
    for (const c of columnas) {
      doc.text(c.titulo, x, y, { width: c.ancho, align: c.align || 'left' });
      x += c.ancho + 6;
    }
    doc.y = y + 14;
    doc.strokeColor('#d1d5db').lineWidth(1).moveTo(50, doc.y).lineTo(562, doc.y).stroke();
    doc.y += 6;
    doc.font('Helvetica').fillColor(COLOR_TEXTO).fontSize(9);
  };

  dibujarEncabezado();
  if (filas.length === 0) {
    doc.text(textoVacio, 50, doc.y, { width: 512, align: 'center' });
    doc.moveDown();
    return;
  }
  for (const fila of filas) {
    if (doc.y > 700) {
      doc.addPage();
      dibujarEncabezado();
    }
    let x = 50;
    const y = doc.y;
    fila.forEach((celda, i) => {
      doc.text(String(celda ?? ''), x, y, { width: columnas[i].ancho, align: columnas[i].align || 'left', lineBreak: false, ellipsis: true });
      x += columnas[i].ancho + 6;
    });
    doc.y = y + 16;
  }
  doc.x = 50;
}

// Ganancia bruta estimada: venta de productos menos su costo actual (RF-46)
function gananciaBruta(ventas) {
  let ingresoProductos = 0;
  let costo = 0;
  for (const v of ventas) {
    for (const d of v.detalles) {
      if (!d.producto) continue;
      ingresoProductos += d.subtotal;
      costo += d.producto.precioCompra * d.cantidad;
    }
  }
  return { ingresoProductos: dinero(ingresoProductos), costo: dinero(costo), ganancia: dinero(ingresoProductos - costo) };
}

async function generarReporteDiario(fechaStr) {
  const fecha = schemas.reporteDiario.parse(fechaStr);
  const { inicio, fin } = rangoDia(fecha);

  const ventas = await prisma.venta.findMany({
    where: { fecha: { gte: inicio, lt: fin } },
    include: { usuario: { select: { nombre: true } } },
    orderBy: { fecha: 'asc' },
  });
  const confirmadas = ventas.filter(v => v.estado === 'CONFIRMADA');
  const anuladas = ventas.filter(v => v.estado === 'ANULADA');
  const resumen = resumirVentas(confirmadas);

  const { doc, terminado } = crearDocumento(`Reporte_Diario_${fecha}.pdf`, 'REPORTE DIARIO DE VENTAS', `Fecha: ${fecha}`);

  seccion(doc, 'Resumen del día');
  dato(doc, 'Total vendido', rd(resumen.totalVentas), { negrita: true });
  dato(doc, 'Ventas confirmadas', resumen.cantidadVentas);
  dato(doc, 'Ventas anuladas', `${anuladas.length} (${rd(anuladas.reduce((s, v) => s + v.total, 0))})`);
  doc.moveDown(0.3);
  for (const m of METODOS) dato(doc, `  ${m}`, rd(resumen.porMetodo[m]));

  seccion(doc, 'Detalle de ventas');
  tabla(doc, [
    { titulo: 'Factura', ancho: 95 },
    { titulo: 'Hora', ancho: 50 },
    { titulo: 'Cajero', ancho: 120 },
    { titulo: 'Método', ancho: 85 },
    { titulo: 'Estado', ancho: 65 },
    { titulo: 'Total', ancho: 67, align: 'right' },
  ], ventas.map(v => [
    v.numeroFactura,
    new Date(v.fecha).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' }),
    v.usuario.nombre,
    v.metodoPago,
    v.estado,
    rd(v.total),
  ]), 'No se registraron ventas en esta fecha.');

  doc.end();
  return terminado;
}

async function generarReporteMensual(datos) {
  const { mes, anio } = schemas.reporteMensual.parse(datos);
  const { inicio, fin } = rangoMes(mes, anio);
  const nombreMes = NOMBRE_MESES[mes - 1];

  const [ventas, anuladas, ordenes, cierres] = await Promise.all([
    prisma.venta.findMany({
      where: { fecha: { gte: inicio, lt: fin }, estado: 'CONFIRMADA' },
      include: { detalles: { include: { producto: { select: { precioCompra: true } } } } },
    }),
    prisma.venta.findMany({ where: { fecha: { gte: inicio, lt: fin }, estado: 'ANULADA' }, select: { total: true } }),
    prisma.ordenTrabajo.groupBy({ by: ['estado'], where: { fechaCreacion: { gte: inicio, lt: fin } }, _count: true }),
    prisma.cierreCaja.findMany({
      where: { fecha: { gte: inicio, lt: fin } },
      include: { usuario: { select: { nombre: true } } },
      orderBy: { fecha: 'asc' },
    }),
  ]);

  const resumen = resumirVentas(ventas);
  const margen = gananciaBruta(ventas);
  const totalEsperado = dinero(cierres.reduce((s, c) => s + c.efectivoEsperado, 0));
  const totalContado = dinero(cierres.reduce((s, c) => s + c.efectivoContado, 0));
  const faltantes = dinero(cierres.filter(c => c.diferencia < 0).reduce((s, c) => s + c.diferencia, 0));
  const totalDiferencia = dinero(totalContado - totalEsperado);

  const { doc, terminado } = crearDocumento(
    `Reporte_Mensual_${anio}_${String(mes).padStart(2, '0')}.pdf`,
    `REPORTE MENSUAL — ${nombreMes.toUpperCase()} ${anio}`,
  );

  seccion(doc, 'Ventas');
  dato(doc, 'Total facturado', rd(resumen.totalVentas), { negrita: true });
  dato(doc, 'Cantidad de ventas', resumen.cantidadVentas);
  for (const m of METODOS) dato(doc, `  ${m}`, rd(resumen.porMetodo[m]));

  seccion(doc, 'Ganancia bruta estimada (productos)');
  dato(doc, 'Ingreso por productos', rd(margen.ingresoProductos));
  dato(doc, 'Costo de productos (precio de compra actual)', rd(margen.costo));
  dato(doc, 'Ganancia bruta estimada', rd(margen.ganancia), { negrita: true });

  seccion(doc, 'Órdenes de trabajo');
  if (ordenes.length === 0) dato(doc, 'Órdenes creadas', 0);
  for (const o of ordenes) dato(doc, o.estado, o._count);

  seccion(doc, 'Pérdidas y diferencias');
  dato(doc, 'Ventas anuladas', `${anuladas.length} (${rd(anuladas.reduce((s, v) => s + v.total, 0))})`);
  dato(doc, 'Faltantes de caja', rd(faltantes), { color: faltantes < 0 ? '#b91c1c' : COLOR_TEXTO });

  seccion(doc, 'Conciliación de caja');
  dato(doc, 'Efectivo esperado', rd(totalEsperado));
  dato(doc, 'Efectivo contado', rd(totalContado));
  dato(doc, 'Diferencia neta', `${totalDiferencia >= 0 ? '+' : ''}${rd(totalDiferencia)}`, {
    negrita: true, color: totalDiferencia >= 0 ? '#047857' : '#b91c1c',
  });
  doc.moveDown(0.5);
  tabla(doc, [
    { titulo: 'Fecha', ancho: 95 },
    { titulo: 'Cajero', ancho: 125 },
    { titulo: 'Esperado', ancho: 90, align: 'right' },
    { titulo: 'Contado', ancho: 90, align: 'right' },
    { titulo: 'Diferencia', ancho: 82, align: 'right' },
  ], cierres.map(c => [
    new Date(c.fecha).toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'short' }),
    c.usuario.nombre,
    rd(c.efectivoEsperado),
    rd(c.efectivoContado),
    `${c.diferencia >= 0 ? '+' : ''}${rd(c.diferencia)}`,
  ]), 'No se registraron cierres de caja en este mes.');

  doc.end();
  return terminado;
}

// RF-26 / RF-48: stock actual, mínimos y movimientos de los últimos 30 días
async function generarReporteInventario() {
  const desde = new Date();
  desde.setDate(desde.getDate() - 30);

  const [productos, movimientos] = await Promise.all([
    prisma.producto.findMany({ where: { activo: true }, orderBy: [{ categoria: 'asc' }, { nombre: 'asc' }] }),
    prisma.movimientoInventario.groupBy({ by: ['productoId', 'tipo'], where: { fecha: { gte: desde } }, _sum: { cantidad: true } }),
  ]);

  const movs = new Map();
  for (const m of movimientos) {
    const actual = movs.get(m.productoId) || { ENTRADA: 0, SALIDA: 0, AJUSTE: 0 };
    actual[m.tipo] = m._sum.cantidad || 0;
    movs.set(m.productoId, actual);
  }

  const bajoMinimo = productos.filter(p => p.stock <= p.stockMinimo);
  const valorInventario = dinero(productos.reduce((s, p) => s + p.precioCompra * p.stock, 0));
  const hoy = fechaLocalISO();

  const { doc, terminado } = crearDocumento(`Reporte_Inventario_${hoy}.pdf`, 'REPORTE DE INVENTARIO', 'Movimientos de los últimos 30 días');

  seccion(doc, 'Resumen');
  dato(doc, 'Productos activos', productos.length);
  dato(doc, 'Productos en o bajo el mínimo', bajoMinimo.length, { color: bajoMinimo.length ? '#b91c1c' : COLOR_TEXTO });
  dato(doc, 'Valor del inventario (costo)', rd(valorInventario), { negrita: true });

  seccion(doc, 'Existencias');
  tabla(doc, [
    { titulo: 'Código', ancho: 70 },
    { titulo: 'Producto', ancho: 150 },
    { titulo: 'Categoría', ancho: 70 },
    { titulo: 'Stock', ancho: 35, align: 'right' },
    { titulo: 'Mín.', ancho: 30, align: 'right' },
    { titulo: 'Entradas', ancho: 40, align: 'right' },
    { titulo: 'Salidas', ancho: 40, align: 'right' },
    { titulo: 'Ajustes', ancho: 37, align: 'right' },
  ], productos.map(p => {
    const m = movs.get(p.id) || { ENTRADA: 0, SALIDA: 0, AJUSTE: 0 };
    return [
      p.codigoInterno,
      `${p.stock <= p.stockMinimo ? '* ' : ''}${p.nombre}`,
      p.categoria, p.stock, p.stockMinimo, m.ENTRADA, m.SALIDA, m.AJUSTE,
    ];
  }), 'No hay productos registrados.');
  doc.fontSize(8).fillColor('#6b7280').text('* Producto en o por debajo del stock mínimo', 50);

  doc.end();
  return terminado;
}

module.exports = {
  generarReporteDiario,
  generarReporteMensual,
  generarReporteInventario,
  gananciaBruta,
};
