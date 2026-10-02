// Pruebas de ITBIS, NCF, rol Técnico, impresión ESC/POS, exportación DGII y migraciones
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const bcrypt = require('bcrypt');

const prisma = require('../src/main/core/prisma');
const fiscal = require('../src/main/core/fiscal');
const { migrar, sentencias } = require('../src/main/core/migrator');
const configService = require('../src/main/config/config.service');
const inventario = require('../src/main/inventory/inventory.service');
const pos = require('../src/main/pos/pos.service');
const taller = require('../src/main/workshop/workshop.service');
const printer = require('../src/main/printer/printer.service');
const reportes = require('../src/main/reports/reports.service');
const { normalizarError } = require('../src/main/core/errors');

let ADMIN, CAJERO, TEC1, TEC2;

const usuario = async (u, rol) => prisma.usuario.create({
  data: { nombre: u, usuario: u, rol, passwordHash: await bcrypt.hash('clave1234', 4) },
});
const producto = (over = {}) => inventario.crearProducto({
  nombre: 'Aceite', categoria: 'Lubricantes', precioCompra: 50, precioVenta: 118, stock: 20, ...over,
}, ADMIN);
const stock = async (id) => (await prisma.producto.findUnique({ where: { id } })).stock;

async function rechaza(promesa, regex) {
  await assert.rejects(promesa, (e) => {
    assert.match(normalizarError(e).message, regex);
    return true;
  });
}

// RNC válido: calcula el dígito verificador con el algoritmo de la DGII
function rncValido(base8) {
  const pesos = [7, 9, 8, 6, 5, 4, 3, 2];
  const suma = pesos.reduce((s, p, i) => s + p * Number(base8[i]), 0);
  const r = suma % 11;
  return base8 + (r === 0 ? 2 : r === 1 ? 1 : 11 - r);
}

before(async () => {
  await migrar();
  for (const t of ['auditLog', 'movimientoInventario', 'detalleVenta', 'detalleOrden', 'ordenTrabajo', 'venta', 'cierreCaja', 'producto', 'usuario', 'secuenciaNcf']) {
    await prisma[t].deleteMany();
  }
  await prisma.configuracion.deleteMany();
  await prisma.configuracion.create({ data: { id: 1 } });
  ADMIN = await usuario('admin', 'ADMINISTRADOR');
  CAJERO = await usuario('cajero', 'CAJERO');
  TEC1 = await usuario('tecnico1', 'TECNICO');
  TEC2 = await usuario('tecnico2', 'TECNICO');
});

after(() => prisma.$disconnect());

// ── Cálculo de ITBIS ─────────────────────────────
test('ITBIS incluido en el precio se extrae; excluido se suma', () => {
  const inc = fiscal.calcularVenta([{ importe: 118, exento: false }], 0, { tasaItbis: 0.18, preciosIncluyenItbis: true });
  assert.deepEqual([inc.subtotal, inc.itbis, inc.total], [100, 18, 118]);

  const exc = fiscal.calcularVenta([{ importe: 100, exento: false }], 0, { tasaItbis: 0.18, preciosIncluyenItbis: false });
  assert.deepEqual([exc.subtotal, exc.itbis, exc.total], [100, 18, 118]);

  const exento = fiscal.calcularVenta([{ importe: 100, exento: true }], 0, { tasaItbis: 0.18, preciosIncluyenItbis: false });
  assert.equal(exento.itbis, 0);
});

test('el descuento global se reparte y los centavos cuadran', () => {
  const r = fiscal.calcularVenta(
    [{ importe: 33.33, exento: false }, { importe: 33.33, exento: false }, { importe: 33.34, exento: true }],
    10, { tasaItbis: 0.18, preciosIncluyenItbis: true },
  );
  assert.equal(r.total, 90);
  assert.equal(Math.round((r.subtotal + r.itbis) * 100) / 100, r.total);
  assert.throws(() => fiscal.calcularVenta([{ importe: 10 }], 11, { tasaItbis: 0.18, preciosIncluyenItbis: true }), /descuento/);
});

test('validación de RNC (dígito verificador) y cédula', () => {
  const rnc = rncValido('13124675');
  assert.equal(fiscal.normalizarRnc(rnc.replace(/(\d)(\d{2})/, '$1-$2-')), rnc);
  const malo = rnc.slice(0, 8) + ((Number(rnc[8]) + 1) % 10);
  assert.throws(() => fiscal.normalizarRnc(malo), /verificador/);
  assert.throws(() => fiscal.normalizarRnc('12345'), /9 dígitos/);
  assert.equal(fiscal.normalizarRnc('001-1234567-8'), '00112345678');
});

// ── Ventas con ITBIS y NCF ───────────────────────
test('la venta guarda subtotal, ITBIS por línea y total', async () => {
  const p = await producto({ precioVenta: 118 });
  const e = await producto({ nombre: 'Exento', precioVenta: 100, exentoItbis: true });
  const v = await pos.confirmarVenta({ metodoPago: 'EFECTIVO', items: [{ productoId: p.id, cantidad: 1 }, { productoId: e.id, cantidad: 1 }] }, CAJERO);
  assert.equal(v.total, 218);
  assert.equal(v.itbis, 18);
  assert.equal(v.subtotal, 200);
  assert.equal(v.ncf, null); // sin NCF mientras no se active la emisión

  const preview = await pos.calcularVenta({ items: [{ productoId: p.id, cantidad: 2 }] });
  assert.deepEqual([preview.subtotal, preview.itbis, preview.total], [200, 36, 236]);
});

test('NCF: requiere secuencia, numera en orden, se agota y valida el RNC', async () => {
  await configService.actualizar({ emitirNcf: true }, ADMIN);
  const p = await producto();
  const venta = (extra = {}) => pos.confirmarVenta({ metodoPago: 'TARJETA', items: [{ productoId: p.id, cantidad: 1 }], ...extra }, CAJERO);

  await rechaza(venta(), /No hay una secuencia NCF activa/);
  const stockAntes = await stock(p.id);
  assert.equal(stockAntes, 20, 'una venta rechazada no descuenta stock');

  await configService.guardarSecuencia({ tipo: 'B02', siguiente: 1, hasta: 2 }, ADMIN);
  assert.equal((await venta()).ncf, 'B0200000001');
  assert.equal((await venta()).ncf, 'B0200000002');
  await rechaza(venta(), /agotó/);

  // No se puede retroceder la numeración
  await rechaza(configService.guardarSecuencia({ tipo: 'B02', siguiente: 2, hasta: 50 }, ADMIN), /mayor al último NCF/);

  await configService.guardarSecuencia({ tipo: 'B01', siguiente: 10, hasta: 20, vencimiento: '2099-12-31' }, ADMIN);
  await rechaza(venta({ tipoComprobante: 'B01' }), /requiere el RNC/);
  const v = await venta({ tipoComprobante: 'B01', clienteNombre: 'Taller XYZ SRL', clienteRnc: rncValido('13124675') });
  assert.equal(v.ncf, 'B0100000010');
  assert.equal(v.clienteRnc, rncValido('13124675'));

  await configService.guardarSecuencia({ tipo: 'B01', siguiente: 11, hasta: 20, vencimiento: '2020-01-01' }, ADMIN);
  await rechaza(venta({ tipoComprobante: 'B01', clienteNombre: 'X', clienteRnc: rncValido('13124675') }), /venció/);

  const secs = await configService.listarSecuencias();
  assert.ok(secs.find(s => s.tipo === 'B01').vencida);

  // Exportación 607/608 del mes
  const hoy = new Date();
  const dgii = await reportes.exportarDgii({ mes: hoy.getMonth() + 1, anio: hoy.getFullYear() });
  assert.equal(dgii.registros607, 3);
  const contenido = fs.readFileSync(dgii.archivo607, 'utf8');
  assert.match(contenido, /B0200000001/);
  assert.match(contenido, /B0100000010/);

  await configService.actualizar({ emitirNcf: false }, ADMIN);
});

test('la configuración valida RNC, correo y tasa', async () => {
  await rechaza(configService.actualizar({ rnc: '123456789' }, ADMIN), /RNC no es válido/);
  await rechaza(configService.actualizar({ email: 'no-es-correo' }, ADMIN), /Correo/);
  await rechaza(configService.actualizar({ tasaItbis: 2 }, ADMIN), /Tasa/);
  const c = await configService.actualizar({ nombreEmpresa: 'Repuestos Ceballos SRL', rnc: rncValido('10100101') }, ADMIN);
  assert.equal(c.nombreEmpresa, 'Repuestos Ceballos SRL');
});

// ── Rol Técnico ──────────────────────────────────
test('el técnico solo ve y trabaja sus órdenes; registra repuestos', async () => {
  const p = await producto({ stock: 10, precioVenta: 200 });
  await rechaza(taller.crearOrden({ vehiculo: 'X', cliente: 'Y', tecnicoId: CAJERO.id, items: [{ servicio: 'A', cantidad: 1, precioUnitario: 1 }] }, CAJERO), /técnico seleccionado no es válido/);

  const ot = await taller.crearOrden({
    vehiculo: 'Kia Rio', cliente: 'Ana', tecnicoId: TEC1.id,
    items: [{ servicio: 'Diagnóstico', cantidad: 1, precioUnitario: 500 }],
  }, CAJERO);
  const otra = await taller.crearOrden({ vehiculo: 'Ford', cliente: 'Luis', items: [{ servicio: 'Lavado', cantidad: 1, precioUnitario: 100 }] }, CAJERO);

  const vistas = await taller.listarOrdenes({}, TEC1);
  assert.deepEqual(vistas.map(o => o.id), [ot.id]);
  assert.equal((await taller.listarOrdenes({ tecnicoId: TEC1.id }, ADMIN)).length, 1);

  // RF-30: el técnico agrega repuestos a su orden
  const conRepuesto = await taller.agregarItem({ ordenId: ot.id, item: { productoId: p.id, cantidad: 2 } }, TEC1);
  assert.equal(conRepuesto.total, 900);
  assert.equal(await stock(p.id), 8);

  await rechaza(taller.agregarItem({ ordenId: ot.id, item: { servicio: 'X', cantidad: 1, precioUnitario: 1 } }, TEC2), /no está asignada/);
  await rechaza(taller.agregarItem({ ordenId: otra.id, item: { servicio: 'X', cantidad: 1, precioUnitario: 1 } }, TEC1), /no está asignada/);
  await rechaza(taller.cambiarEstado({ ordenId: ot.id, estado: 'CANCELADA', motivo: 'x' }, TEC1), /Solo caja/);

  // Quitar la línea del repuesto devuelve el stock
  const lineaRep = conRepuesto.detalles.find(d => d.productoId === p.id);
  const sinRepuesto = await taller.quitarItem({ ordenId: ot.id, detalleId: lineaRep.id }, TEC1);
  assert.equal(sinRepuesto.total, 500);
  assert.equal(await stock(p.id), 10);
  await rechaza(taller.quitarItem({ ordenId: ot.id, detalleId: sinRepuesto.detalles[0].id }, TEC1), /al menos una línea/);

  await taller.cambiarEstado({ ordenId: ot.id, estado: 'EN_PROCESO' }, TEC1);
  await taller.cambiarEstado({ ordenId: ot.id, estado: 'COMPLETADA' }, TEC1);
  await rechaza(taller.agregarItem({ ordenId: ot.id, item: { servicio: 'X', cantidad: 1, precioUnitario: 1 } }, TEC1), /No se pueden agregar/);

  // Reasignación y facturación con ITBIS (servicios gravados)
  await taller.asignarTecnico({ ordenId: ot.id, tecnicoId: TEC2.id }, CAJERO);
  const venta = await taller.facturarOrden({ ordenId: ot.id, metodoPago: 'EFECTIVO' }, CAJERO);
  assert.equal(venta.total, 500);
  assert.ok(Math.abs(venta.itbis - 76.27) < 0.01);
  assert.equal(venta.clienteNombre, 'Ana');
  assert.equal(venta.ordenTrabajo.id, ot.id);
});

// ── Impresión ESC/POS ────────────────────────────
test('el ticket ESC/POS se genera con los datos de la venta', async () => {
  const archivo = path.join(os.tmpdir(), `ticket-${Date.now()}.bin`);
  fs.writeFileSync(archivo, '');
  await configService.actualizar({ impresoraTipo: 'COMPARTIDA', impresoraDestino: archivo }, ADMIN);
  const p = await producto();
  const v = await pos.confirmarVenta({ metodoPago: 'EFECTIVO', items: [{ productoId: p.id, cantidad: 1 }] }, CAJERO);

  await printer.imprimirVenta(v.id);
  const bytes = fs.readFileSync(archivo);
  const texto = bytes.toString('latin1');
  assert.ok(bytes.length > 100);
  assert.match(texto, new RegExp(v.numeroFactura));
  assert.match(texto, /TOTAL/);
  assert.ok(bytes.includes(Buffer.from([0x1d, 0x56])), 'incluye el comando de corte de papel');
  fs.unlinkSync(archivo);

  assert.equal(printer.interfaz({ impresoraTipo: 'RED', impresoraDestino: '192.168.1.50' }), 'tcp://192.168.1.50:9100');
  await configService.actualizar({ impresoraTipo: 'NINGUNA' }, ADMIN);
  await rechaza(printer.imprimirVenta(v.id), /No hay impresora/);
});

// ── Migraciones ──────────────────────────────────
test('el migrador separa sentencias e ignora comentarios', async () => {
  const s = sentencias('-- comentario\nCREATE TABLE a (x INT);\n\nINSERT INTO a VALUES (1);\n');
  assert.deepEqual(s, ['CREATE TABLE a (x INT)', 'INSERT INTO a VALUES (1)']);
  assert.deepEqual((await migrar()).aplicadas, []);
});
