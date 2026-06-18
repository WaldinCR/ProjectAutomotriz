// Servicio de Reportes
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function getDownloadsFolder() {
  return app.getPath('downloads');
}

/**
 * Genera el Reporte Diario de Ventas
 */
async function generarReporteDiario(fechaStr) {
  const fecha = new Date(fechaStr);
  const inicioDia = new Date(fecha);
  inicioDia.setUTCHours(0, 0, 0, 0);
  const finDia = new Date(fecha);
  finDia.setUTCHours(23, 59, 59, 999);

  // Obtener ventas del día
  const ventas = await prisma.venta.findMany({
    where: {
      fecha: { gte: inicioDia, lte: finDia },
      estado: 'CONFIRMADA'
    },
    include: { usuario: true }
  });

  const totalVentas = ventas.reduce((sum, v) => sum + v.total, 0);
  const porMetodo = ventas.reduce((acc, v) => {
    acc[v.metodoPago] = (acc[v.metodoPago] || 0) + v.total;
    return acc;
  }, {});

  const downloadsDir = getDownloadsFolder();
  const filename = `Reporte_Diario_${fechaStr}.pdf`;
  const filePath = path.join(downloadsDir, filename);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const writeStream = fs.createWriteStream(filePath);

    writeStream.on('finish', () => resolve(filePath));
    writeStream.on('error', (err) => reject(err));

    doc.pipe(writeStream);

    // Encabezado
    doc.fillColor('#1e3a8a').fontSize(22).text('SGI Automotriz', { align: 'center' });
    doc.fillColor('#4b5563').fontSize(14).text('REPORTE DIARIO DE VENTAS', { align: 'center' });
    doc.fontSize(10).text(`Fecha del Reporte: ${fechaStr}`, { align: 'center' });
    doc.moveDown(1.5);

    // Línea divisoria
    doc.strokeColor('#e5e7eb').lineWidth(1).moveTo(50, doc.y).lineTo(562, doc.y).stroke();
    doc.moveDown(1);

    // Resumen de Métodos de Pago
    doc.fillColor('#1e3a8a').fontSize(14).text('Resumen del Día');
    doc.moveDown(0.5);

    doc.fillColor('#374151').fontSize(11);
    doc.text(`Total Ventas: RD$ ${totalVentas.toFixed(2)}`, { font: 'Helvetica-Bold' });
    doc.text(`Transacciones: ${ventas.length}`);
    doc.moveDown(0.5);

    doc.text('Desglose por método de pago:');
    const metodos = ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'MIXTO'];
    metodos.forEach(m => {
      const monto = porMetodo[m] || 0;
      doc.text(`  • ${m}: RD$ ${monto.toFixed(2)}`);
    });
    doc.moveDown(2);

    // Tabla de transacciones
    doc.fillColor('#1e3a8a').fontSize(14).text('Detalle de Ventas');
    doc.moveDown(0.5);

    // Encabezados de tabla
    let y = doc.y;
    doc.fillColor('#1e3a8a').fontSize(10);
    doc.text('Factura', 50, y, { width: 120 });
    doc.text('Hora', 180, y, { width: 60 });
    doc.text('Cajero', 250, y, { width: 120 });
    doc.text('Método', 380, y, { width: 90 });
    doc.text('Total', 480, y, { width: 82, align: 'right' });

    y += 15;
    doc.strokeColor('#d1d5db').lineWidth(1).moveTo(50, y).lineTo(562, y).stroke();
    y += 10;

    doc.fillColor('#374151');
    if (ventas.length === 0) {
      doc.text('No se registraron ventas en esta fecha.', 50, y, { align: 'center' });
    } else {
      ventas.forEach(v => {
        if (y > 700) {
          doc.addPage();
          y = 50;
          // Redibujar encabezados de tabla
          doc.fillColor('#1e3a8a').fontSize(10);
          doc.text('Factura', 50, y, { width: 120 });
          doc.text('Hora', 180, y, { width: 60 });
          doc.text('Cajero', 250, y, { width: 120 });
          doc.text('Método', 380, y, { width: 90 });
          doc.text('Total', 480, y, { width: 82, align: 'right' });
          y += 15;
          doc.strokeColor('#d1d5db').lineWidth(1).moveTo(50, y).lineTo(562, y).stroke();
          y += 10;
          doc.fillColor('#374151');
        }

        const hora = new Date(v.fecha).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' });
        doc.text(v.numeroFactura, 50, y, { width: 120 });
        doc.text(hora, 180, y, { width: 60 });
        doc.text(v.usuario.nombre, 250, y, { width: 120 });
        doc.text(v.metodoPago, 380, y, { width: 90 });
        doc.text(`RD$ ${v.total.toFixed(2)}`, 480, y, { width: 82, align: 'right' });

        y += 20;
      });
    }

    doc.end();
  });
}

/**
 * Genera el Reporte Mensual de Desempeño y Conciliación
 */
async function generarReporteMensual({ mes, anio }) {
  const mesInt = parseInt(mes);
  const anioInt = parseInt(anio);

  const inicioMes = new Date(Date.utc(anioInt, mesInt - 1, 1, 0, 0, 0, 0));
  const finMes = new Date(Date.utc(anioInt, mesInt, 0, 23, 59, 59, 999));

  // Ventas del mes
  const ventas = await prisma.venta.findMany({
    where: {
      fecha: { gte: inicioMes, lte: finMes },
      estado: 'CONFIRMADA'
    }
  });
  const totalVentas = ventas.reduce((sum, v) => sum + v.total, 0);

  // Órdenes completadas / facturadas
  const ordenes = await prisma.ordenTrabajo.findMany({
    where: {
      fechaCreacion: { gte: inicioMes, lte: finMes },
      estado: { in: ['COMPLETADA', 'FACTURADA'] }
    }
  });

  // Cierres de caja del mes
  const cierres = await prisma.cierreCaja.findMany({
    where: {
      fecha: { gte: inicioMes, lte: finMes }
    },
    include: { usuario: true }
  });

  const totalEsperado = cierres.reduce((sum, c) => sum + c.efectivoEsperado, 0);
  const totalContado = cierres.reduce((sum, c) => sum + c.efectivoContado, 0);
  const totalDiferencia = cierres.reduce((sum, c) => sum + c.diferencia, 0);

  const downloadsDir = getDownloadsFolder();
  const filename = `Reporte_Mensual_${anioInt}_${String(mesInt).padStart(2, '0')}.pdf`;
  const filePath = path.join(downloadsDir, filename);

  const nombreMeses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  const nombreMes = nombreMeses[mesInt - 1];

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const writeStream = fs.createWriteStream(filePath);

    writeStream.on('finish', () => resolve(filePath));
    writeStream.on('error', (err) => reject(err));

    doc.pipe(writeStream);

    // Encabezado
    doc.fillColor('#1e3a8a').fontSize(22).text('SGI Automotriz', { align: 'center' });
    doc.fillColor('#4b5563').fontSize(14).text(`REPORTE MENSUAL DE DESEMPEÑO — ${nombreMes.toUpperCase()} ${anioInt}`, { align: 'center' });
    doc.moveDown(1.5);

    // Línea divisoria
    doc.strokeColor('#e5e7eb').lineWidth(1).moveTo(50, doc.y).lineTo(562, doc.y).stroke();
    doc.moveDown(1);

    // Ventas y Taller
    doc.fillColor('#1e3a8a').fontSize(14).text('Resumen Operativo');
    doc.moveDown(0.5);

    doc.fillColor('#374151').fontSize(11);
    doc.text(`Total Facturado (Ventas): RD$ ${totalVentas.toFixed(2)}`);
    doc.text(`Cantidad de Ventas: ${ventas.length}`);
    doc.text(`Órdenes de Trabajo Completadas/Facturadas: ${ordenes.length}`);
    doc.moveDown(1.5);

    // Conciliación de Caja
    doc.fillColor('#1e3a8a').fontSize(14).text('Resumen de Conciliación de Caja');
    doc.moveDown(0.5);

    doc.fillColor('#374151');
    doc.text(`Total Efectivo Esperado: RD$ ${totalEsperado.toFixed(2)}`);
    doc.text(`Total Efectivo Contado: RD$ ${totalContado.toFixed(2)}`);
    const difSign = totalDiferencia >= 0 ? '+' : '';
    doc.text(`Diferencia Neta de Caja: ${difSign}RD$ ${totalDiferencia.toFixed(2)}`, {
      font: 'Helvetica-Bold',
      fillColor: totalDiferencia >= 0 ? '#047857' : '#b91c1c'
    });
    doc.fillColor('#374151').font('Helvetica'); // Reset font/color
    doc.moveDown(2);

    // Tabla de Conciliación
    doc.fillColor('#1e3a8a').fontSize(14).text('Detalle de Cierres de Caja');
    doc.moveDown(0.5);

    // Encabezados de tabla
    let y = doc.y;
    doc.fillColor('#1e3a8a').fontSize(9);
    doc.text('Fecha', 50, y, { width: 100 });
    doc.text('Cajero', 160, y, { width: 120 });
    doc.text('Esperado', 290, y, { width: 80, align: 'right' });
    doc.text('Contado', 380, y, { width: 80, align: 'right' });
    doc.text('Diferencia', 470, y, { width: 92, align: 'right' });

    y += 15;
    doc.strokeColor('#d1d5db').lineWidth(1).moveTo(50, y).lineTo(562, y).stroke();
    y += 10;

    doc.fillColor('#374151');
    if (cierres.length === 0) {
      doc.text('No se registraron cierres de caja en este mes.', 50, y, { align: 'center' });
    } else {
      cierres.forEach(c => {
        if (y > 700) {
          doc.addPage();
          y = 50;
          doc.fillColor('#1e3a8a').fontSize(9);
          doc.text('Fecha', 50, y, { width: 100 });
          doc.text('Cajero', 160, y, { width: 120 });
          doc.text('Esperado', 290, y, { width: 80, align: 'right' });
          doc.text('Contado', 380, y, { width: 80, align: 'right' });
          doc.text('Diferencia', 470, y, { width: 92, align: 'right' });
          y += 15;
          doc.strokeColor('#d1d5db').lineWidth(1).moveTo(50, y).lineTo(562, y).stroke();
          y += 10;
          doc.fillColor('#374151');
        }

        const fechaCierre = new Date(c.fecha).toLocaleDateString('es-DO');
        const diffText = (c.diferencia >= 0 ? '+' : '') + c.diferencia.toFixed(2);
        doc.text(fechaCierre, 50, y, { width: 100 });
        doc.text(c.usuario.nombre, 160, y, { width: 120 });
        doc.text(`RD$ ${c.efectivoEsperado.toFixed(2)}`, 290, y, { width: 80, align: 'right' });
        doc.text(`RD$ ${c.efectivoContado.toFixed(2)}`, 380, y, { width: 80, align: 'right' });
        doc.text(`RD$ ${diffText}`, 470, y, { width: 92, align: 'right' });

        y += 20;
      });
    }

    doc.end();
  });
}

module.exports = {
  generarReporteDiario,
  generarReporteMensual
};
