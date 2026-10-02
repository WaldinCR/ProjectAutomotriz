// Servicio de Reportes PDF y exportaciones (RF-43 a RF-48)
// El diseño visual vive en ./pdf/brand.js; aquí solo se arman los datos.
const fs = require('fs');
const path = require('path');
const prisma = require('../core/prisma');
const schemas = require('../core/validation');
const configService = require('../config/config.service');
const { TIPOS_NCF } = require('../core/fiscal');
const { AppError } = require('../core/errors');
const { rangoDia, rangoMes, dinero, fechaLocalISO } = require('../core/dates');
const { resumirVentas } = require('../cashier/cashier.service');
const pdf = require('./pdf/brand');

const { C, rd, num, pct } = pdf;
const METODOS = [
  { clave: 'EFECTIVO', nombre: 'Efectivo', color: C.green },
  { clave: 'TARJETA', nombre: 'Tarjeta', color: C.blue },
  { clave: 'TRANSFERENCIA', nombre: 'Transferencia', color: C.orange },
];
const NOMBRE_MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const PILL_ESTADO = {
  CONFIRMADA: { texto: 'VIGENTE', pill: { bg: C.greenBg, color: C.green } },
  ANULADA: { texto: 'ANULADA', pill: { bg: C.redBg, color: C.red } },
};

const hora = (f) => new Date(f).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', hour12: false });
const fechaCorta = (f) => new Date(f).toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric' });
const fechaLarga = (f) => new Date(f).toLocaleDateString('es-DO', { day: 'numeric', month: 'long', year: 'numeric' });
const ahora = () => new Date().toLocaleString('es-DO', { dateStyle: 'medium', timeStyle: 'short' });

// Carpeta raíz de documentos: Descargas/SGI Automotriz/<subcarpeta>
function carpetaBase() {
  if (process.env.REPORTS_DIR) return path.resolve(process.env.REPORTS_DIR);
  const { app } = require('electron');
  return path.join(app.getPath('downloads'), 'SGI Automotriz');
}
const rutaArchivo = (sub, nombre) => path.join(carpetaBase(), sub, nombre);

// Ingreso neto (sin ITBIS ni descuento global) y costo de cada línea de producto
function margenVentas(ventas) {
  let ingreso = 0;
  let costo = 0;
  const porProducto = new Map();
  for (const v of ventas) {
    const bruto = v.detalles.reduce((s, d) => s + d.subtotal, 0);
    const factor = bruto > 0 ? v.subtotal / bruto : 0;
    for (const d of v.detalles) {
      if (!d.producto) continue;
      const neto = d.subtotal * factor;
      const c = d.producto.precioCompra * d.cantidad;
      ingreso += neto;
      costo += c;
      const p = porProducto.get(d.productoId) || { nombre: d.producto.nombre, cantidad: 0, ingreso: 0, costo: 0 };
      p.cantidad += d.cantidad;
      p.ingreso += neto;
      p.costo += c;
      porProducto.set(d.productoId, p);
    }
  }
  return {
    ingreso: dinero(ingreso),
    costo: dinero(costo),
    ganancia: dinero(ingreso - costo),
    margen: ingreso > 0 ? (ingreso - costo) / ingreso : 0,
    productos: [...porProducto.values()].sort((a, b) => b.ingreso - a.ingreso),
  };
}

function porCajero(ventas) {
  const mapa = new Map();
  for (const v of ventas) {
    const c = mapa.get(v.usuario.nombre) || { nombre: v.usuario.nombre, cantidad: 0, total: 0 };
    c.cantidad += 1;
    c.total += v.total;
    mapa.set(v.usuario.nombre, c);
  }
  return [...mapa.values()].sort((a, b) => b.total - a.total);
}

const filaMetodos = (resumen) => METODOS.map(m => ({ etiqueta: m.nombre, valor: resumen.porMetodo[m.clave] || 0, color: m.color }));

// ── Reporte diario ───────────────────────────────
async function generarReporteDiario(fechaStr, actor) {
  const fecha = schemas.reporteDiario.parse(fechaStr);
  const { inicio, fin } = rangoDia(fecha);
  const [empresa, ventas, cierres] = await Promise.all([
    configService.obtener(),
    prisma.venta.findMany({ where: { fecha: { gte: inicio, lt: fin } }, include: { usuario: { select: { nombre: true } } }, orderBy: { fecha: 'asc' } }),
    prisma.cierreCaja.findMany({ where: { fecha: { gte: inicio, lt: fin } }, include: { usuario: { select: { nombre: true } } }, orderBy: { fecha: 'asc' } }),
  ]);
  const confirmadas = ventas.filter(v => v.estado === 'CONFIRMADA');
  const anuladas = ventas.filter(v => v.estado === 'ANULADA');
  const resumen = resumirVentas(confirmadas);
  const itbis = dinero(confirmadas.reduce((s, v) => s + v.itbis, 0));

  const ctx = pdf.crearDocumento({
    archivo: rutaArchivo('Reportes', `Reporte_Diario_${fecha}.pdf`),
    empresa, tipo: 'Reporte de ventas', titulo: 'Reporte Diario', subtitulo: fechaLarga(inicio),
    meta: [['Período', fechaCorta(inicio)], ['Generado por', actor?.nombre || 'Sistema'], ['Emitido', ahora()], ['Transacciones', num(ventas.length)]],
  });

  pdf.kpis(ctx, [
    { etiqueta: 'Total vendido', valor: rd(resumen.totalVentas), nota: `${resumen.cantidadVentas} ventas confirmadas`, color: C.blue },
    { etiqueta: 'Ticket promedio', valor: rd(resumen.cantidadVentas ? resumen.totalVentas / resumen.cantidadVentas : 0), color: C.navy },
    { etiqueta: 'ITBIS facturado', valor: rd(itbis), nota: `${pct(empresa.tasaItbis)} de tasa`, color: C.orange },
    { etiqueta: 'Anulaciones', valor: num(anuladas.length), nota: rd(anuladas.reduce((s, v) => s + v.total, 0)), color: C.red, notaColor: anuladas.length ? C.red : C.muted },
  ]);

  pdf.seccion(ctx, 'Ventas por método de pago');
  pdf.barrasHorizontales(ctx, filaMetodos(resumen));

  pdf.seccion(ctx, 'Desempeño por cajero');
  const cajeros = porCajero(confirmadas);
  pdf.tabla(ctx, [
    { titulo: 'Cajero', ancho: 3 }, { titulo: 'Ventas', ancho: 1, align: 'right' },
    { titulo: 'Participación', ancho: 1.2, align: 'right' }, { titulo: 'Total', ancho: 1.5, align: 'right' },
  ], cajeros.map(c => [c.nombre, num(c.cantidad), pct(resumen.totalVentas ? c.total / resumen.totalVentas : 0), rd(c.total)]),
  { vacio: 'No hubo ventas este día' });

  pdf.seccion(ctx, 'Detalle de transacciones', `${ventas.length} registro(s)`);
  pdf.tabla(ctx, [
    { titulo: 'Factura', ancho: 1.6, fuente: 'mono' }, { titulo: 'NCF', ancho: 1.3, fuente: 'mono' },
    { titulo: 'Hora', px: 40 }, { titulo: 'Cajero', ancho: 1.6 }, { titulo: 'Método', ancho: 1.25 },
    { titulo: 'Estado', px: 62, align: 'center' }, { titulo: 'ITBIS', ancho: 1.05, align: 'right' }, { titulo: 'Total', ancho: 1.3, align: 'right' },
  ], ventas.map(v => [
    v.numeroFactura, v.ncf || '—', hora(v.fecha), v.usuario.nombre, v.metodoPago,
    PILL_ESTADO[v.estado], rd(v.itbis),
    { texto: rd(v.total), color: v.estado === 'ANULADA' ? C.muted : C.ink },
  ]), {
    vacio: 'No se registraron ventas en esta fecha',
    totales: ventas.length ? ['Total vigente', '', '', '', '', '', rd(itbis), rd(resumen.totalVentas)] : null,
  });

  if (cierres.length) {
    pdf.seccion(ctx, 'Cierres de caja del día');
    pdf.tabla(ctx, [
      { titulo: 'Hora', px: 50 }, { titulo: 'Cajero', ancho: 2 }, { titulo: 'Esperado', ancho: 1.2, align: 'right' },
      { titulo: 'Contado', ancho: 1.2, align: 'right' }, { titulo: 'Diferencia', ancho: 1.2, align: 'right' },
    ], cierres.map(c => [hora(c.fecha), c.usuario.nombre, rd(c.efectivoEsperado), rd(c.efectivoContado),
      { texto: `${c.diferencia > 0 ? '+' : ''}${rd(c.diferencia)}`, color: c.diferencia < 0 ? C.red : c.diferencia > 0 ? C.green : C.ink, negrita: true }]));
  }

  pdf.firmas(ctx, ['Preparado por', 'Revisado por'], [actor?.nombre]);
  return ctx.finalizar();
}

// ── Reporte mensual ──────────────────────────────
async function generarReporteMensual(datos, actor) {
  const { mes, anio } = schemas.reporteMensual.parse(datos);
  const { inicio, fin } = rangoMes(mes, anio);
  const nombreMes = `${NOMBRE_MESES[mes - 1]} ${anio}`;

  const [empresa, ventas, anuladas, ordenes, cierres] = await Promise.all([
    configService.obtener(),
    prisma.venta.findMany({
      where: { fecha: { gte: inicio, lt: fin }, estado: 'CONFIRMADA' },
      include: { usuario: { select: { nombre: true } }, detalles: { include: { producto: { select: { nombre: true, precioCompra: true } } } } },
    }),
    prisma.venta.findMany({ where: { fecha: { gte: inicio, lt: fin }, estado: 'ANULADA' }, select: { total: true } }),
    prisma.ordenTrabajo.groupBy({ by: ['estado'], where: { fechaCreacion: { gte: inicio, lt: fin } }, _count: true, _sum: { total: true } }),
    prisma.cierreCaja.findMany({ where: { fecha: { gte: inicio, lt: fin } }, include: { usuario: { select: { nombre: true } } }, orderBy: { fecha: 'asc' } }),
  ]);

  const resumen = resumirVentas(ventas);
  const margen = margenVentas(ventas);
  const itbis = dinero(ventas.reduce((s, v) => s + v.itbis, 0));
  const totalAnulado = dinero(anuladas.reduce((s, v) => s + v.total, 0));
  const faltantes = dinero(cierres.filter(c => c.diferencia < 0).reduce((s, c) => s + c.diferencia, 0));
  const sobrantes = dinero(cierres.filter(c => c.diferencia > 0).reduce((s, c) => s + c.diferencia, 0));

  // Ventas por día del mes
  const dias = new Date(anio, mes, 0).getDate();
  const porDia = Array.from({ length: dias }, (_, i) => ({ etiqueta: String(i + 1), valor: 0 }));
  for (const v of ventas) porDia[new Date(v.fecha).getDate() - 1].valor += v.total;
  const mejorDia = porDia.reduce((a, b) => (b.valor > a.valor ? b : a), porDia[0]);
  if (mejorDia.valor > 0) mejorDia.destacar = true;
  const diasConVenta = porDia.filter(d => d.valor > 0).length;

  const ctx = pdf.crearDocumento({
    archivo: rutaArchivo('Reportes', `Reporte_Mensual_${anio}_${String(mes).padStart(2, '0')}.pdf`),
    empresa, tipo: 'Informe de gestión', titulo: 'Reporte Mensual', subtitulo: nombreMes,
    meta: [['Período', nombreMes], ['Generado por', actor?.nombre || 'Sistema'], ['Emitido', ahora()], ['Días con ventas', `${diasConVenta} de ${dias}`]],
  });

  pdf.kpis(ctx, [
    { etiqueta: 'Ventas del mes', valor: rd(resumen.totalVentas), nota: `${num(resumen.cantidadVentas)} transacciones`, color: C.blue },
    { etiqueta: 'Ganancia bruta est.', valor: rd(margen.ganancia), nota: `Margen ${pct(margen.margen)}`, color: C.green },
    { etiqueta: 'ITBIS facturado', valor: rd(itbis), color: C.orange },
    { etiqueta: 'Ticket promedio', valor: rd(resumen.cantidadVentas ? resumen.totalVentas / resumen.cantidadVentas : 0), color: C.navy },
  ]);

  pdf.seccion(ctx, 'Evolución diaria de ventas', mejorDia.valor > 0 ? `Mejor día: ${mejorDia.etiqueta} (${rd(mejorDia.valor)})` : '');
  pdf.columnasVerticales(ctx, porDia);

  pdf.seccion(ctx, 'Ventas por método de pago');
  pdf.barrasHorizontales(ctx, filaMetodos(resumen));

  pdf.seccion(ctx, 'Productos más vendidos', 'Top 10 por ingreso neto');
  pdf.tabla(ctx, [
    { titulo: '#', px: 24, align: 'center' }, { titulo: 'Producto', ancho: 3 }, { titulo: 'Unidades', ancho: 1, align: 'right' },
    { titulo: 'Ingreso neto', ancho: 1.3, align: 'right' }, { titulo: 'Costo', ancho: 1.2, align: 'right' }, { titulo: 'Margen', ancho: 0.9, align: 'right' },
  ], margen.productos.slice(0, 10).map((p, i) => [
    i + 1, p.nombre, num(p.cantidad), rd(p.ingreso), rd(p.costo),
    { texto: pct(p.ingreso ? (p.ingreso - p.costo) / p.ingreso : 0), color: p.ingreso >= p.costo ? C.green : C.red },
  ]), { vacio: 'No se vendieron productos este mes' });

  pdf.seccion(ctx, 'Desempeño por cajero');
  pdf.tabla(ctx, [
    { titulo: 'Cajero', ancho: 3 }, { titulo: 'Ventas', ancho: 1, align: 'right' },
    { titulo: 'Ticket promedio', ancho: 1.4, align: 'right' }, { titulo: 'Total', ancho: 1.4, align: 'right' },
  ], porCajero(ventas).map(c => [c.nombre, num(c.cantidad), rd(c.total / c.cantidad), rd(c.total)]), { vacio: 'Sin ventas' });

  pdf.seccion(ctx, 'Taller — órdenes de trabajo');
  const totalOt = ordenes.reduce((s, o) => s + o._count, 0);
  pdf.tabla(ctx, [{ titulo: 'Estado', ancho: 3 }, { titulo: 'Órdenes', ancho: 1, align: 'right' }, { titulo: 'Monto', ancho: 1.4, align: 'right' }],
    ['PENDIENTE', 'EN_PROCESO', 'COMPLETADA', 'FACTURADA', 'CANCELADA'].map(e => {
      const o = ordenes.find(x => x.estado === e);
      return [e.replace('_', ' '), num(o?._count || 0), rd(o?._sum.total || 0)];
    }), { totales: ['Total', num(totalOt), rd(ordenes.reduce((s, o) => s + (o._sum.total || 0), 0))] });

  pdf.seccion(ctx, 'Pérdidas y conciliación de caja');
  pdf.kpis(ctx, [
    { etiqueta: 'Ventas anuladas', valor: rd(totalAnulado), nota: `${anuladas.length} anulación(es)`, color: C.red },
    { etiqueta: 'Faltantes de caja', valor: rd(faltantes), color: C.red, notaColor: C.red },
    { etiqueta: 'Sobrantes de caja', valor: rd(sobrantes), color: C.green },
  ]);
  pdf.tabla(ctx, [
    { titulo: 'Fecha', ancho: 1.3 }, { titulo: 'Cajero', ancho: 2 }, { titulo: 'Esperado', ancho: 1.2, align: 'right' },
    { titulo: 'Contado', ancho: 1.2, align: 'right' }, { titulo: 'Diferencia', ancho: 1.2, align: 'right' },
  ], cierres.map(c => [
    `${fechaCorta(c.fecha)} ${hora(c.fecha)}`, c.usuario.nombre, rd(c.efectivoEsperado), rd(c.efectivoContado),
    { texto: `${c.diferencia > 0 ? '+' : ''}${rd(c.diferencia)}`, color: c.diferencia < 0 ? C.red : c.diferencia > 0 ? C.green : C.ink, negrita: true },
  ]), {
    vacio: 'No se registraron cierres de caja en este mes',
    totales: cierres.length ? ['Total', '', rd(cierres.reduce((s, c) => s + c.efectivoEsperado, 0)), rd(cierres.reduce((s, c) => s + c.efectivoContado, 0)), rd(faltantes + sobrantes)] : null,
  });

  pdf.parrafo(ctx, 'La ganancia bruta es una estimación: ingreso neto de productos (sin ITBIS ni descuentos) menos su costo según el precio de compra actual. No incluye mano de obra ni gastos operativos.');
  pdf.firmas(ctx, ['Preparado por', 'Aprobado por'], [actor?.nombre]);
  return ctx.finalizar();
}

// ── Reporte de inventario ────────────────────────
async function generarReporteInventario(actor) {
  const desde = new Date();
  desde.setDate(desde.getDate() - 30);
  const [empresa, productos, movimientos] = await Promise.all([
    configService.obtener(),
    prisma.producto.findMany({ where: { activo: true }, orderBy: [{ categoria: 'asc' }, { nombre: 'asc' }] }),
    prisma.movimientoInventario.groupBy({ by: ['productoId', 'tipo'], where: { fecha: { gte: desde } }, _sum: { cantidad: true } }),
  ]);
  const movs = new Map();
  for (const m of movimientos) {
    const a = movs.get(m.productoId) || { ENTRADA: 0, SALIDA: 0, AJUSTE: 0 };
    a[m.tipo] = m._sum.cantidad || 0;
    movs.set(m.productoId, a);
  }
  const agotados = productos.filter(p => p.stock <= 0);
  const bajos = productos.filter(p => p.stock > 0 && p.stock <= p.stockMinimo);
  const valorCosto = dinero(productos.reduce((s, p) => s + p.precioCompra * p.stock, 0));
  const valorVenta = dinero(productos.reduce((s, p) => s + p.precioVenta * p.stock, 0));

  const ctx = pdf.crearDocumento({
    archivo: rutaArchivo('Reportes', `Reporte_Inventario_${fechaLocalISO()}.pdf`),
    empresa, tipo: 'Control de existencias', titulo: 'Reporte de Inventario', subtitulo: `Corte al ${fechaLarga(new Date())}`,
    meta: [['Corte', fechaCorta(new Date())], ['Movimientos', 'Últimos 30 días'], ['Generado por', actor?.nombre || 'Sistema'], ['Emitido', ahora()]],
  });

  pdf.kpis(ctx, [
    { etiqueta: 'Productos activos', valor: num(productos.length), nota: `${new Set(productos.map(p => p.categoria)).size} categorías`, color: C.blue },
    { etiqueta: 'Valor al costo', valor: rd(valorCosto), color: C.navy },
    { etiqueta: 'Valor de venta', valor: rd(valorVenta), nota: `Margen ${rd(valorVenta - valorCosto)}`, color: C.green },
    { etiqueta: 'Requieren reposición', valor: num(agotados.length + bajos.length), nota: `${agotados.length} agotados · ${bajos.length} bajo mínimo`, color: C.red, notaColor: C.red },
  ]);

  if (agotados.length + bajos.length > 0) {
    pdf.seccion(ctx, 'Reposición sugerida', 'Cantidad para llegar al doble del mínimo');
    pdf.tabla(ctx, [
      { titulo: 'Código', ancho: 1.1, fuente: 'mono' }, { titulo: 'Producto', ancho: 3 }, { titulo: 'Stock', ancho: 0.7, align: 'right' },
      { titulo: 'Mínimo', ancho: 0.7, align: 'right' }, { titulo: 'Sugerido', ancho: 0.8, align: 'right' }, { titulo: 'Costo est.', ancho: 1.2, align: 'right' },
    ], [...agotados, ...bajos].map(p => {
      const sugerido = Math.max(p.stockMinimo * 2 - p.stock, 1);
      return [p.codigoInterno, p.nombre, { texto: num(p.stock), color: C.red, negrita: true }, num(p.stockMinimo), num(sugerido), rd(sugerido * p.precioCompra)];
    }));
  }

  pdf.seccion(ctx, 'Existencias por producto');
  pdf.tabla(ctx, [
    { titulo: 'Código', ancho: 1.25, fuente: 'mono' }, { titulo: 'Producto', ancho: 2.3 }, { titulo: 'Categoría', ancho: 1 },
    { titulo: 'Stock', px: 42, align: 'right' }, { titulo: 'Mín.', px: 34, align: 'right' },
    { titulo: 'Ent.', px: 34, align: 'right' }, { titulo: 'Sal.', px: 34, align: 'right' },
    { titulo: 'Valor', ancho: 1.35, align: 'right' }, { titulo: 'Estado', px: 58, align: 'center' },
  ], productos.map(p => {
    const m = movs.get(p.id) || { ENTRADA: 0, SALIDA: 0, AJUSTE: 0 };
    const estado = p.stock <= 0 ? { texto: 'AGOTADO', pill: { bg: C.redBg, color: C.red } }
      : p.stock <= p.stockMinimo ? { texto: 'BAJO', pill: { bg: C.amberBg, color: C.amber } }
        : { texto: 'OK', pill: { bg: C.greenBg, color: C.green } };
    return [p.codigoInterno, p.nombre, p.categoria, num(p.stock), num(p.stockMinimo), num(m.ENTRADA + Math.max(m.AJUSTE, 0)), num(m.SALIDA - Math.min(m.AJUSTE, 0)), rd(p.precioCompra * p.stock), estado];
  }), { vacio: 'No hay productos registrados', totales: ['Total', '', '', num(productos.reduce((s, p) => s + p.stock, 0)), '', '', '', rd(valorCosto), ''] });

  pdf.firmas(ctx, ['Conteo realizado por', 'Verificado por'], [actor?.nombre]);
  return ctx.finalizar();
}

// ── RF-47: ventas filtradas por rango, empleado y producto ───────
async function generarReporteVentas(filtros, actor) {
  const f = schemas.reporteVentas.parse(filtros);
  const inicio = rangoDia(f.desde).inicio;
  const fin = rangoDia(f.hasta).fin;
  const [empresa, empleado, producto] = await Promise.all([
    configService.obtener(),
    f.usuarioId ? prisma.usuario.findUnique({ where: { id: f.usuarioId }, select: { nombre: true } }) : null,
    f.productoId ? prisma.producto.findUnique({ where: { id: f.productoId }, select: { nombre: true } }) : null,
  ]);
  const detalles = await prisma.detalleVenta.findMany({
    where: {
      venta: { fecha: { gte: inicio, lt: fin }, estado: 'CONFIRMADA', ...(f.usuarioId && { usuarioId: f.usuarioId }) },
      ...(f.productoId && { productoId: f.productoId }),
    },
    include: { venta: { include: { usuario: { select: { nombre: true } } } }, producto: { select: { nombre: true } } },
    orderBy: { venta: { fecha: 'asc' } },
  });
  const facturas = new Set(detalles.map(d => d.ventaId));
  const totalImporte = dinero(detalles.reduce((s, d) => s + d.subtotal, 0));
  const unidades = detalles.reduce((s, d) => s + d.cantidad, 0);
  const periodo = f.desde === f.hasta ? fechaCorta(inicio) : `${fechaCorta(inicio)} — ${fechaCorta(rangoDia(f.hasta).inicio)}`;

  const ctx = pdf.crearDocumento({
    archivo: rutaArchivo('Reportes', `Reporte_Ventas_${f.desde}_a_${f.hasta}.pdf`),
    empresa, tipo: 'Análisis de ventas', titulo: 'Ventas por Filtros', subtitulo: periodo,
    meta: [['Período', periodo], ['Empleado', empleado?.nombre || 'Todos'], ['Producto', producto?.nombre || 'Todos'], ['Generado por', actor?.nombre || 'Sistema']],
  });
  pdf.kpis(ctx, [
    { etiqueta: 'Importe vendido', valor: rd(totalImporte), nota: 'Precio × cantidad − descuento de línea', color: C.blue },
    { etiqueta: 'Facturas', valor: num(facturas.size), color: C.navy },
    { etiqueta: 'Unidades / servicios', valor: num(unidades), color: C.orange },
  ]);
  pdf.seccion(ctx, 'Detalle', `${detalles.length} línea(s)`);
  pdf.tabla(ctx, [
    { titulo: 'Fecha', ancho: 1.2 }, { titulo: 'Factura', ancho: 1.15, fuente: 'mono' }, { titulo: 'Concepto', ancho: 2.6 },
    { titulo: 'Cajero', ancho: 1.4 }, { titulo: 'Cant.', ancho: 0.55, align: 'right' }, { titulo: 'Precio', ancho: 1.05, align: 'right' }, { titulo: 'Importe', ancho: 1.15, align: 'right' },
  ], detalles.map(d => [
    `${fechaCorta(d.venta.fecha)} ${hora(d.venta.fecha)}`, d.venta.numeroFactura, d.producto?.nombre || d.servicio,
    d.venta.usuario.nombre, num(d.cantidad), rd(d.precioUnitario), rd(d.subtotal),
  ]), { vacio: 'No hay ventas que coincidan con los filtros', totales: detalles.length ? ['Total', '', '', '', num(unidades), '', rd(totalImporte)] : null });
  return ctx.finalizar();
}

// ── Factura / comprobante fiscal ─────────────────
async function generarFactura(ventaId, actor) {
  const id = schemas.id('La venta').parse(ventaId);
  const [empresa, venta] = await Promise.all([
    configService.obtener(),
    prisma.venta.findUnique({
      where: { id },
      include: {
        detalles: { include: { producto: { select: { nombre: true, codigoInterno: true } } }, orderBy: { id: 'asc' } },
        usuario: { select: { nombre: true } },
        ordenTrabajo: { select: { id: true, vehiculo: true, placa: true, tecnico: { select: { nombre: true } } } },
      },
    }),
  ]);
  if (!venta) throw new AppError('Venta no encontrada', 'NO_ENCONTRADO');
  const secuencia = venta.tipoComprobante
    ? await prisma.secuenciaNcf.findUnique({ where: { tipo: venta.tipoComprobante } })
    : null;
  const tipoNombre = venta.tipoComprobante ? `Factura de ${TIPOS_NCF[venta.tipoComprobante].nombre}` : 'Factura';

  const ctx = pdf.crearDocumento({
    archivo: rutaArchivo('Facturas', `Factura_${venta.numeroFactura}.pdf`),
    empresa, tipo: tipoNombre, titulo: venta.numeroFactura, subtitulo: fechaLarga(venta.fecha),
  });
  const { doc } = ctx;
  const m = pdf.PAGINA.margen;
  const W = pdf.ANCHO_UTIL;

  // Tarjetas: cliente | comprobante
  const y = doc.y;
  const mitad = (W - 12) / 2;
  const filasCliente = [
    ['Cliente', venta.clienteNombre || 'Consumidor final'],
    ['RNC / Cédula', venta.clienteRnc || '—'],
    ...(venta.ordenTrabajo ? [['Vehículo', `${venta.ordenTrabajo.vehiculo}${venta.ordenTrabajo.placa ? ` · ${venta.ordenTrabajo.placa}` : ''}`],
      ['Orden de trabajo', `#${venta.ordenTrabajo.id}${venta.ordenTrabajo.tecnico ? ` · ${venta.ordenTrabajo.tecnico.nombre}` : ''}`]] : []),
  ];
  const filasComprobante = [
    ['NCF', venta.ncf || 'Sin valor fiscal'],
    ['Válido hasta', secuencia?.vencimiento ? fechaCorta(secuencia.vencimiento) : '—'],
    ['Fecha', `${fechaCorta(venta.fecha)} ${hora(venta.fecha)}`],
    ['Vendedor', venta.usuario.nombre],
    ['Forma de pago', venta.metodoPago],
  ];
  const altoTarjeta = 44 + Math.max(filasCliente.length, filasComprobante.length) * 13;
  const tarjeta = (x, titulo, filas) => {
    doc.roundedRect(x, y, mitad, altoTarjeta, 7).lineWidth(0.8).fillAndStroke(C.white, C.line);
    doc.rect(x, y + 12, 3, 14).fill(C.orange);
    doc.font(pdf.F.bold).fontSize(8).fillColor(C.navy).text(titulo.toUpperCase(), x + 12, y + 15, { characterSpacing: 0.9, lineBreak: false });
    filas.forEach(([e, v], i) => {
      const fy = y + 34 + i * 13;
      doc.font(pdf.F.regular).fontSize(7.8).fillColor(C.muted).text(e, x + 12, fy, { lineBreak: false });
      doc.font(pdf.F.semibold).fontSize(8.2).fillColor(C.ink).text(pdf.ajustar(doc, v, mitad - 110), x + 95, fy, { width: mitad - 107, lineBreak: false });
    });
  };
  tarjeta(m, 'Facturado a', filasCliente);
  tarjeta(m + mitad + 12, 'Comprobante', filasComprobante);
  doc.y = y + altoTarjeta + 14;

  pdf.tabla(ctx, [
    { titulo: '#', px: 24, align: 'center' }, { titulo: 'Descripción', ancho: 3.2 }, { titulo: 'Cant.', ancho: 0.6, align: 'right' },
    { titulo: 'Precio', ancho: 1.1, align: 'right' }, { titulo: 'Desc.', ancho: 0.9, align: 'right' },
    { titulo: 'ITBIS', ancho: 0.95, align: 'right' }, { titulo: 'Importe', ancho: 1.15, align: 'right' },
  ], venta.detalles.map((d, i) => [
    i + 1, d.producto ? `${d.producto.nombre}  ·  ${d.producto.codigoInterno}` : d.servicio, num(d.cantidad), rd(d.precioUnitario),
    d.descuento > 0 ? `-${rd(d.descuento)}` : '—', rd(d.itbis), rd(d.subtotal),
  ]), { altoFila: 20 });

  // Totales
  pdf.espacio(ctx, 120);
  const xT = m + W - 230;
  const yInicio = doc.y;
  let yT = yInicio;
  const lineaTotal = (etiqueta, valor, color = C.ink) => {
    doc.font(pdf.F.regular).fontSize(8.5).fillColor(C.muted).text(etiqueta, xT, yT, { width: 120, lineBreak: false });
    doc.font(pdf.F.semibold).fontSize(8.5).fillColor(color).text(valor, xT + 110, yT, { width: 120, align: 'right', lineBreak: false });
    yT += 15;
  };
  const bruto = venta.detalles.reduce((s, d) => s + d.subtotal, 0);
  lineaTotal('Importe bruto', rd(bruto));
  if (venta.descuento > 0) lineaTotal('Descuento', `-${rd(venta.descuento)}`, C.red);
  lineaTotal('Subtotal gravado + exento', rd(venta.subtotal));
  lineaTotal(`ITBIS (${pct(empresa.tasaItbis)})`, rd(venta.itbis));
  doc.roundedRect(xT, yT + 2, 230, 30, 6).fill(C.navy);
  doc.font(pdf.F.semibold).fontSize(8).fillColor('#9fc3d4').text('TOTAL A PAGAR', xT + 12, yT + 13, { characterSpacing: 1, lineBreak: false });
  doc.font(pdf.F.bold).fontSize(14).fillColor(C.white).text(rd(venta.total), xT + 90, yT + 9, { width: 128, align: 'right', lineBreak: false });

  // Notas a la izquierda de los totales
  doc.font(pdf.F.semibold).fontSize(7.5).fillColor(C.navy).text('NOTAS', m, yInicio, { characterSpacing: 0.9 });
  doc.font(pdf.F.regular).fontSize(7.5).fillColor(C.muted).text([
    empresa.preciosIncluyenItbis ? 'Los precios incluyen ITBIS.' : 'El ITBIS se agrega al precio de lista.',
    venta.ncf ? 'Comprobante fiscal válido según la Norma 06-2018 de la DGII.' : 'Documento sin valor fiscal.',
    empresa.piePagina || '',
  ].filter(Boolean).join('\n'), m, yInicio + 13, { width: W - 250, lineGap: 2 });
  doc.y = Math.max(doc.y, yT + 40);

  if (venta.estado === 'ANULADA') {
    pdf.sello(ctx, 'ANULADA');
    pdf.parrafo(ctx, `Venta anulada. Motivo: ${venta.motivoAnulacion || '—'}`, { color: C.red, tamano: 8.5 });
  }
  pdf.firmas(ctx, ['Entregado por', 'Recibido conforme'], [venta.usuario.nombre]);
  void actor;
  return ctx.finalizar({ leyenda: venta.ncf ? `NCF ${venta.ncf}` : 'Documento sin valor fiscal' });
}

// ── Comprobante de cierre de caja ────────────────
async function generarCierre(cierreId, actor) {
  const id = schemas.id('El cierre').parse(cierreId);
  const [empresa, cierre, log] = await Promise.all([
    configService.obtener(),
    prisma.cierreCaja.findUnique({ where: { id }, include: { usuario: { select: { nombre: true } } } }),
    prisma.auditLog.findFirst({ where: { tabla: 'CierreCaja', accion: 'CONFIRMAR_CIERRE', registroId: id } }),
  ]);
  if (!cierre) throw new AppError('Cierre no encontrado', 'NO_ENCONTRADO');
  const detalle = log?.datosNuevos ? JSON.parse(log.datosNuevos) : {};
  const porMetodo = detalle.porMetodo || {};

  const ctx = pdf.crearDocumento({
    archivo: rutaArchivo('Cierres', `Cierre_${String(cierre.id).padStart(6, '0')}_${fechaLocalISO(cierre.fecha)}.pdf`),
    empresa, tipo: 'Arqueo de caja', titulo: `Cierre #${String(cierre.id).padStart(6, '0')}`, subtitulo: `${fechaLarga(cierre.fecha)} · ${hora(cierre.fecha)}`,
    meta: [['Cajero', cierre.usuario.nombre], ['Fecha', `${fechaCorta(cierre.fecha)} ${hora(cierre.fecha)}`], ['Ventas', detalle.cantidadVentas !== undefined ? num(detalle.cantidadVentas) : '—'], ['Estado', 'Confirmado']],
  });
  const dif = cierre.diferencia;
  pdf.kpis(ctx, [
    { etiqueta: 'Ventas del turno', valor: rd(cierre.totalVentas), color: C.blue },
    { etiqueta: 'Efectivo esperado', valor: rd(cierre.efectivoEsperado), color: C.navy },
    { etiqueta: 'Efectivo contado', valor: rd(cierre.efectivoContado), color: C.orange },
    { etiqueta: dif === 0 ? 'Cuadre exacto' : dif > 0 ? 'Sobrante' : 'Faltante', valor: `${dif > 0 ? '+' : ''}${rd(dif)}`, color: dif < 0 ? C.red : C.green, nota: dif === 0 ? 'Sin diferencias' : 'Ver justificación', notaColor: dif < 0 ? C.red : C.muted },
  ]);
  pdf.seccion(ctx, 'Ventas por método de pago');
  if (detalle.porMetodo) {
    pdf.tabla(ctx, [{ titulo: 'Método', ancho: 3 }, { titulo: 'Debe estar en caja', ancho: 1.5, align: 'center' }, { titulo: 'Monto', ancho: 1.5, align: 'right' }],
      METODOS.map(mt => [mt.nombre, mt.clave === 'EFECTIVO' ? 'Sí' : 'No (voucher / banco)', rd(porMetodo[mt.clave] || 0)]),
      { totales: ['Total vendido', '', rd(cierre.totalVentas)] });
  } else {
    pdf.parrafo(ctx, 'Desglose por método no disponible: este cierre se registró con una versión anterior del sistema.');
  }
  pdf.seccion(ctx, 'Observaciones');
  pdf.parrafo(ctx, cierre.observaciones || 'Sin observaciones.', { color: C.ink, tamano: 9 });
  pdf.parrafo(ctx, 'Este cierre es inmutable y quedó registrado en el log de auditoría del sistema.');
  pdf.firmas(ctx, ['Cajero', 'Supervisor / Administración'], [cierre.usuario.nombre]);
  void actor;
  return ctx.finalizar();
}

// ── DGII: formatos 607 (ventas) y 608 (anulados) ─
function csv(filas) {
  const celda = (v) => {
    const s = String(v ?? '');
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // BOM para que Excel abra el archivo con acentos correctos
  return `﻿${filas.map(f => f.map(celda).join(';')).join('\r\n')}\r\n`;
}
const fechaDgii = (f) => fechaLocalISO(new Date(f)).replace(/-/g, '');
const monto = (n) => Number(n || 0).toFixed(2);

async function exportarDgii(datos) {
  const { mes, anio } = schemas.reporteMensual.parse(datos);
  const { inicio, fin } = rangoMes(mes, anio);
  const ventas = await prisma.venta.findMany({
    where: { fecha: { gte: inicio, lt: fin }, ncf: { not: null } },
    orderBy: { ncf: 'asc' },
  });
  const periodo = `${anio}${String(mes).padStart(2, '0')}`;

  const f607 = [[
    'RNC/Cédula', 'Tipo Identificación', 'NCF', 'NCF Modificado', 'Tipo de Ingreso', 'Fecha Comprobante', 'Fecha Retención',
    'Monto Facturado', 'ITBIS Facturado', 'ITBIS Retenido por Terceros', 'ITBIS Percibido', 'Retención Renta por Terceros',
    'ISR Percibido', 'Impuesto Selectivo al Consumo', 'Otros Impuestos/Tasas', 'Monto Propina Legal', 'Efectivo',
    'Cheque/Transferencia/Depósito', 'Tarjeta Débito/Crédito', 'Venta a Crédito', 'Bonos o Certificados de Regalo', 'Permuta', 'Otras Formas de Ventas',
  ]];
  for (const v of ventas.filter(v => v.estado === 'CONFIRMADA')) {
    f607.push([
      v.clienteRnc || '', v.clienteRnc ? (v.clienteRnc.length === 9 ? '1' : '2') : '', v.ncf, '', '01', fechaDgii(v.fecha), '',
      monto(v.subtotal), monto(v.itbis), '', '', '', '', '', '', '',
      monto(v.metodoPago === 'EFECTIVO' ? v.total : 0), monto(v.metodoPago === 'TRANSFERENCIA' ? v.total : 0),
      monto(v.metodoPago === 'TARJETA' ? v.total : 0), '0.00', '0.00', '0.00', '0.00',
    ]);
  }
  // 608: tipo 04 = Corrección de la información (ajustable en la herramienta de la DGII)
  const f608 = [['NCF', 'Fecha Comprobante', 'Tipo de Anulación']];
  for (const v of ventas.filter(v => v.estado === 'ANULADA')) f608.push([v.ncf, fechaDgii(v.fecha), '04']);

  const rnc = (await configService.obtener()).rnc || 'SIN-RNC';
  const archivo607 = rutaArchivo('DGII', `607_${rnc}_${periodo}.csv`);
  const archivo608 = rutaArchivo('DGII', `608_${rnc}_${periodo}.csv`);
  fs.mkdirSync(path.dirname(archivo607), { recursive: true });
  fs.writeFileSync(archivo607, csv(f607), 'utf8');
  fs.writeFileSync(archivo608, csv(f608), 'utf8');
  return { archivo607, archivo608, registros607: f607.length - 1, registros608: f608.length - 1 };
}

module.exports = {
  carpetaBase,
  generarReporteDiario,
  generarReporteMensual,
  generarReporteInventario,
  generarReporteVentas,
  generarFactura,
  generarCierre,
  exportarDgii,
  margenVentas,
};
