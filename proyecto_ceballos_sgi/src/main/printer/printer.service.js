// Impresión de tickets en impresora térmica ESC/POS (80 mm / 58 mm)
// Destinos soportados (Admin › Empresa):
//   RED         → impresora de red, p. ej. 192.168.1.50 o 192.168.1.50:9100
//   COMPARTIDA  → impresora compartida de Windows, p. ej. \\localhost\Ticketera
// No requiere controladores nativos: se envían los bytes ESC/POS directamente.
const path = require('path');
const { ThermalPrinter, PrinterTypes, CharacterSet } = require('node-thermal-printer');
const prisma = require('../core/prisma');
const configService = require('../config/config.service');
const { TIPOS_NCF } = require('../core/fiscal');
const { AppError } = require('../core/errors');
const schemas = require('../core/validation');

const rd = (n) => `RD$ ${Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function interfaz(config) {
  const destino = (config.impresoraDestino || '').trim();
  if (config.impresoraTipo === 'NINGUNA' || !destino) {
    throw new AppError('No hay impresora térmica configurada (Admin › Empresa › Impresora)');
  }
  if (config.impresoraTipo === 'RED') {
    const host = destino.replace(/^tcp:\/\//i, '');
    return `tcp://${host.includes(':') ? host : `${host}:9100`}`;
  }
  return path.normalize(destino);
}

function crearImpresora(config) {
  return new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: interfaz(config),
    width: config.impresoraAncho,
    characterSet: CharacterSet.PC850_MULTILINGUAL,
    removeSpecialCharacters: false,
    options: { timeout: 5000 },
  });
}

function encabezado(p, config) {
  p.alignCenter();
  p.bold(true);
  p.setTextDoubleHeight();
  p.println(config.nombreEmpresa.toUpperCase());
  p.setTextNormal();
  p.bold(false);
  if (config.eslogan) p.println(config.eslogan);
  if (config.rnc) p.println(`RNC: ${config.rnc}`);
  if (config.direccion) p.println(config.direccion);
  if (config.telefono) p.println(`Tel.: ${config.telefono}`);
  p.drawLine();
}

// Construye el ticket de una venta (se separa de execute para poder probarlo)
function componerTicket(p, venta, config) {
  encabezado(p, config);
  p.alignCenter();
  p.bold(true);
  p.println(venta.tipoComprobante ? `FACTURA DE ${TIPOS_NCF[venta.tipoComprobante].nombre.toUpperCase()}` : 'FACTURA');
  p.bold(false);
  if (venta.ncf) p.println(`NCF: ${venta.ncf}`);
  p.alignLeft();
  p.leftRight('Factura:', venta.numeroFactura);
  p.leftRight('Fecha:', new Date(venta.fecha).toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'short', hour12: false }));
  p.leftRight('Cajero:', venta.usuario.nombre);
  if (venta.clienteNombre) p.leftRight('Cliente:', venta.clienteNombre);
  if (venta.clienteRnc) p.leftRight('RNC/Céd.:', venta.clienteRnc);
  if (venta.ordenTrabajo) p.leftRight('OT:', `#${venta.ordenTrabajo.id} ${venta.ordenTrabajo.placa || ''}`.trim());
  p.drawLine();

  for (const d of venta.detalles) {
    p.println(d.producto?.nombre || d.servicio);
    p.leftRight(`  ${d.cantidad} x ${rd(d.precioUnitario)}${d.descuento > 0 ? ` -${rd(d.descuento)}` : ''}`, rd(d.subtotal));
  }
  p.drawLine();
  if (venta.descuento > 0) p.leftRight('Descuento:', `-${rd(venta.descuento)}`);
  p.leftRight('Subtotal:', rd(venta.subtotal));
  p.leftRight(`ITBIS (${Math.round(config.tasaItbis * 100)}%):`, rd(venta.itbis));
  p.bold(true);
  p.setTextDoubleHeight();
  p.leftRight('TOTAL:', rd(venta.total));
  p.setTextNormal();
  p.bold(false);
  p.leftRight('Pago:', venta.metodoPago);
  if (venta.estado === 'ANULADA') {
    p.alignCenter();
    p.bold(true);
    p.println('*** VENTA ANULADA ***');
    p.bold(false);
  }
  p.drawLine();
  p.alignCenter();
  if (!venta.ncf) p.println('Documento sin valor fiscal');
  if (config.piePagina) p.println(config.piePagina);
  p.newLine();
  p.cut();
}

async function imprimirVenta(ventaId) {
  const id = schemas.id('La venta').parse(ventaId);
  const [config, venta] = await Promise.all([
    configService.obtener(),
    prisma.venta.findUnique({
      where: { id },
      include: {
        detalles: { include: { producto: { select: { nombre: true } } }, orderBy: { id: 'asc' } },
        usuario: { select: { nombre: true } },
        ordenTrabajo: { select: { id: true, placa: true } },
      },
    }),
  ]);
  if (!venta) throw new AppError('Venta no encontrada', 'NO_ENCONTRADO');
  const p = crearImpresora(config);
  componerTicket(p, venta, config);
  return enviar(p);
}

async function imprimirPrueba() {
  const config = await configService.obtener();
  const p = crearImpresora(config);
  encabezado(p, config);
  p.alignCenter();
  p.println('PRUEBA DE IMPRESIÓN');
  p.println(new Date().toLocaleString('es-DO'));
  p.println('Acentos: á é í ó ú ñ ¡ ¿');
  p.newLine();
  p.cut();
  return enviar(p);
}

async function enviar(p) {
  try {
    await p.execute();
    return { impreso: true };
  } catch (error) {
    throw new AppError(`No se pudo imprimir: ${error?.message || error}. Verifique que la impresora esté encendida y conectada.`);
  }
}

module.exports = { imprimirVenta, imprimirPrueba, componerTicket, interfaz };
