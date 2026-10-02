// Pruebas de reglas de negocio del backend. Ejecutar con: npm test
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const bcrypt = require('bcrypt');

const prisma = require('../src/main/core/prisma');
const sesiones = require('../src/main/core/session');
const auth = require('../src/main/auth/auth.service');
const admin = require('../src/main/admin/admin.service');
const inventario = require('../src/main/inventory/inventory.service');
const pos = require('../src/main/pos/pos.service');
const taller = require('../src/main/workshop/workshop.service');
const caja = require('../src/main/cashier/cashier.service');
const reportes = require('../src/main/reports/reports.service');
const backup = require('../src/main/backup/backup.service');
const { createApp } = require('../src/main/server');
const { normalizarError } = require('../src/main/core/errors');
const { fechaLocalISO } = require('../src/main/core/dates');
const { migrar } = require('../src/main/core/migrator');

let ADMIN, CAJERO, SUPERVISOR;

async function crearUsuarioDirecto(usuario, rol) {
  return prisma.usuario.create({
    data: { nombre: usuario, usuario, rol, passwordHash: await bcrypt.hash('clave1234', 4) },
  });
}

const producto = (over = {}) => inventario.crearProducto({
  nombre: 'Filtro', categoria: 'Repuestos', precioCompra: 100, precioVenta: 250, stock: 10, ...over,
}, ADMIN);

// Espera el rechazo y devuelve el mensaje normalizado
async function rechaza(promesa, regex) {
  await assert.rejects(promesa, (e) => {
    const { message } = normalizarError(e);
    assert.match(message, regex);
    return true;
  });
}

before(async () => {
  await migrar();
  for (const t of ['auditLog', 'movimientoInventario', 'detalleVenta', 'detalleOrden', 'ordenTrabajo', 'venta', 'cierreCaja', 'producto', 'usuario', 'secuenciaNcf']) {
    await prisma[t].deleteMany();
  }
  await prisma.configuracion.deleteMany();
  await prisma.configuracion.create({ data: { id: 1 } });
  ADMIN = await crearUsuarioDirecto('admin', 'ADMINISTRADOR');
  CAJERO = await crearUsuarioDirecto('cajero', 'CAJERO');
  SUPERVISOR = await crearUsuarioDirecto('super', 'SUPERVISOR');
});

after(() => prisma.$disconnect());

// ── Autenticación ────────────────────────────────
test('login correcto no devuelve el hash y registra el acceso', async () => {
  const u = await auth.login({ usuario: 'cajero', password: 'clave1234' });
  assert.deepEqual(Object.keys(u).sort(), ['debeCambiarPassword', 'id', 'nombre', 'rol']);
  const db = await prisma.usuario.findUnique({ where: { id: CAJERO.id } });
  assert.ok(db.ultimoAcceso);
});

test('la cuenta se bloquea tras 5 intentos fallidos', async () => {
  const u = await crearUsuarioDirecto('victima', 'CAJERO');
  for (let i = 0; i < 4; i++) await rechaza(auth.login({ usuario: 'victima', password: 'mala' }), /incorrectos/);
  await rechaza(auth.login({ usuario: 'victima', password: 'mala' }), /bloqueada/);
  // Incluso con la contraseña correcta permanece bloqueada
  await rechaza(auth.login({ usuario: 'victima', password: 'clave1234' }), /bloqueada/);
  const db = await prisma.usuario.findUnique({ where: { id: u.id } });
  assert.ok(db.bloqueadoHasta > new Date());
});

test('usuario inexistente da el mismo mensaje que contraseña errónea', async () => {
  await rechaza(auth.login({ usuario: 'nadie', password: 'x' }), /Usuario o contraseña incorrectos/);
});

// ── Sesiones ─────────────────────────────────────
test('la sesión valida roles y expira por inactividad', () => {
  sesiones.iniciar(99, CAJERO);
  assert.equal(sesiones.requerir(99, ['CAJERO']).id, CAJERO.id);
  assert.throws(() => sesiones.requerir(99, ['ADMINISTRADOR']), /permisos/);

  const realNow = Date.now;
  Date.now = () => realNow() + sesiones.INACTIVIDAD_MS + 1000;
  try {
    assert.throws(() => sesiones.requerir(99), /expiró/);
  } finally {
    Date.now = realNow;
  }
  assert.throws(() => sesiones.requerir(99), /iniciar sesión/);
});

// ── Administración ───────────────────────────────
test('listarUsuarios nunca expone passwordHash', async () => {
  const lista = await admin.listarUsuarios();
  assert.ok(lista.length > 0);
  assert.ok(lista.every(u => !('passwordHash' in u)));
});

test('no se puede desactivar al último administrador ni a uno mismo', async () => {
  await rechaza(admin.editarUsuario({ id: ADMIN.id, activo: false }, ADMIN), /sí mismo/);
  await rechaza(admin.editarUsuario({ id: ADMIN.id, rol: 'CAJERO' }, { id: -1 }), /al menos un administrador/);
});

test('crear usuario valida contraseña y duplicados', async () => {
  await rechaza(admin.crearUsuario({ nombre: 'X', usuario: 'nuevo', password: '123', rol: 'CAJERO' }, ADMIN), /8 caracteres/);
  await rechaza(admin.crearUsuario({ nombre: 'X', usuario: 'CAJERO', password: '12345678', rol: 'CAJERO' }, ADMIN), /ya se encuentra/);
  await rechaza(admin.crearUsuario({ nombre: 'X', usuario: 'otro', password: '12345678', rol: 'DIOS' }, ADMIN), /Rol no válido/);
});

// ── Inventario ───────────────────────────────────
test('crear producto ignora campos no permitidos y registra stock inicial', async () => {
  const p = await producto({ id: 5000, activo: false, nombre: 'Bujía' });
  assert.notEqual(p.id, 5000);
  assert.equal(p.activo, true);
  assert.match(p.codigoInterno, /^INT-\d{6}$/);
  const movs = await prisma.movimientoInventario.findMany({ where: { productoId: p.id } });
  assert.equal(movs.length, 1);
  assert.equal(movs[0].cantidad, 10);
});

test('valida precios y textos de producto', async () => {
  await rechaza(producto({ precioVenta: 50 }), /menor que el precio de compra/);
  await rechaza(producto({ nombre: '   ' }), /nombre del producto es requerido/);
  await rechaza(producto({ precioCompra: 'abc' }), /número/);
});

test('editar producto no permite tocar el stock y audita cambios de precio', async () => {
  const p = await producto();
  const e = await inventario.editarProducto({ id: p.id, stock: 999, precioVenta: 300 }, ADMIN);
  assert.equal(e.stock, 10);
  assert.equal(e.codigoBarras, null);
  const log = await prisma.auditLog.findFirst({ where: { registroId: p.id, accion: 'CAMBIO_PRECIO' } });
  assert.ok(log);
});

test('el ajuste exige motivo y no deja stock negativo', async () => {
  const p = await producto({ stock: 3 });
  await rechaza(inventario.registrarAjuste({ productoId: p.id, cantidad: -5, motivo: 'Rotura' }, ADMIN), /negativo/);
  await rechaza(inventario.registrarAjuste({ productoId: p.id, cantidad: -1, motivo: '' }, ADMIN), /motivo/);
  const r = await inventario.registrarAjuste({ productoId: p.id, cantidad: -1, motivo: 'Rotura' }, ADMIN);
  assert.equal(r.stock, 2);
  await rechaza(inventario.registrarEntrada({ productoId: p.id, cantidad: -4 }, ADMIN), /mayor o igual a 1/);
});

test('la búsqueda encuentra por nombre parcial y categoría', async () => {
  await producto({ nombre: 'Pastillas de freno', categoria: 'Frenos' });
  assert.ok((await inventario.buscarProductos('pastillas')).length >= 1);
  assert.ok((await inventario.buscarProductos('Frenos')).length >= 1);
});

// ── POS ──────────────────────────────────────────
test('el total se calcula con el precio de la BD, no el enviado', async () => {
  const p = await producto({ precioVenta: 250 });
  const v = await pos.confirmarVenta({
    metodoPago: 'EFECTIVO',
    items: [{ productoId: p.id, cantidad: 2, precioUnitario: 1, subtotal: 2 }],
  }, CAJERO);
  assert.equal(v.total, 500);
  assert.equal(v.usuarioId, CAJERO.id);
  assert.match(v.numeroFactura, /^FAC-\d{8}$/);
  assert.equal((await prisma.producto.findUnique({ where: { id: p.id } })).stock, 8);
});

test('líneas repetidas se suman para validar stock', async () => {
  const p = await producto({ stock: 3 });
  await rechaza(pos.confirmarVenta({
    metodoPago: 'EFECTIVO',
    items: [{ productoId: p.id, cantidad: 2 }, { productoId: p.id, cantidad: 2 }],
  }, CAJERO), /Stock insuficiente/);
  assert.equal((await prisma.producto.findUnique({ where: { id: p.id } })).stock, 3);
});

test('rechaza cantidades negativas, métodos inválidos y descuentos excesivos', async () => {
  const p = await producto();
  await rechaza(pos.confirmarVenta({ metodoPago: 'EFECTIVO', items: [{ productoId: p.id, cantidad: -3 }] }, CAJERO), /mayor o igual a 1/);
  await rechaza(pos.confirmarVenta({ metodoPago: 'BITCOIN', items: [{ productoId: p.id, cantidad: 1 }] }, CAJERO), /Método de pago/);
  await rechaza(pos.confirmarVenta({ metodoPago: 'EFECTIVO', descuentoTotal: 9999, items: [{ productoId: p.id, cantidad: 1 }] }, CAJERO), /descuento/);
  await rechaza(pos.confirmarVenta({ metodoPago: 'EFECTIVO', items: [] }, CAJERO), /vacío/);
});

test('anular venta devuelve stock y no se puede anular dos veces', async () => {
  const p = await producto({ stock: 5 });
  const v = await pos.confirmarVenta({ metodoPago: 'TARJETA', items: [{ productoId: p.id, cantidad: 2 }] }, CAJERO);
  await rechaza(pos.anularVenta({ ventaId: v.id, motivoAnulacion: '' }, SUPERVISOR), /motivo/);
  await pos.anularVenta({ ventaId: v.id, motivoAnulacion: 'Cliente devolvió' }, SUPERVISOR);
  assert.equal((await prisma.producto.findUnique({ where: { id: p.id } })).stock, 5);
  await rechaza(pos.anularVenta({ ventaId: v.id, motivoAnulacion: 'otra vez' }, SUPERVISOR), /ya se encuentra anulada/);
});

// ── Taller ───────────────────────────────────────
test('flujo completo de OT: estados, facturación y anulación', async () => {
  const p = await producto({ stock: 4, precioVenta: 300 });
  const ot = await taller.crearOrden({
    vehiculo: 'Toyota Corolla', placa: 'a123456', cliente: 'Juan',
    items: [
      { productoId: p.id, cantidad: 2, precioUnitario: 1 },
      { servicio: 'Mano de obra', cantidad: 1, precioUnitario: 500 },
    ],
  }, CAJERO);
  assert.equal(ot.total, 1100);
  assert.equal(ot.placa, 'A123456');
  assert.equal((await prisma.producto.findUnique({ where: { id: p.id } })).stock, 2);

  await rechaza(taller.facturarOrden({ ordenId: ot.id, metodoPago: 'EFECTIVO' }, CAJERO), /COMPLETADA/);
  await rechaza(taller.cambiarEstado({ ordenId: ot.id, estado: 'COMPLETADA' }, CAJERO), /No se puede cambiar/);
  await taller.cambiarEstado({ ordenId: ot.id, estado: 'EN_PROCESO' }, CAJERO);
  await taller.cambiarEstado({ ordenId: ot.id, estado: 'COMPLETADA' }, CAJERO);
  const venta = await taller.facturarOrden({ ordenId: ot.id, metodoPago: 'TRANSFERENCIA' }, CAJERO);
  assert.equal(venta.total, 1100);
  await rechaza(taller.facturarOrden({ ordenId: ot.id, metodoPago: 'EFECTIVO' }, CAJERO), /ya se encuentra facturada/);

  // Anular la factura de una OT la devuelve a COMPLETADA (los repuestos ya se usaron)
  await pos.anularVenta({ ventaId: venta.id, motivoAnulacion: 'Error de cobro' }, ADMIN);
  const otDb = await prisma.ordenTrabajo.findUnique({ where: { id: ot.id } });
  assert.equal(otDb.estado, 'COMPLETADA');
  assert.equal(otDb.ventaId, null);
  assert.equal((await prisma.producto.findUnique({ where: { id: p.id } })).stock, 2);
});

test('cancelar OT exige motivo y devuelve repuestos', async () => {
  const p = await producto({ stock: 4 });
  const ot = await taller.crearOrden({ vehiculo: 'Honda', cliente: 'Ana', items: [{ productoId: p.id, cantidad: 3 }] }, CAJERO);
  await rechaza(taller.cambiarEstado({ ordenId: ot.id, estado: 'CANCELADA' }, CAJERO), /motivo/);
  await taller.cambiarEstado({ ordenId: ot.id, estado: 'CANCELADA', motivo: 'Cliente desistió' }, CAJERO);
  assert.equal((await prisma.producto.findUnique({ where: { id: p.id } })).stock, 4);
});

test('OT sin stock suficiente o servicio sin precio se rechaza', async () => {
  const p = await producto({ stock: 1 });
  await rechaza(taller.crearOrden({ vehiculo: 'Kia', cliente: 'Luis', items: [{ productoId: p.id, cantidad: 5 }] }, CAJERO), /Stock insuficiente/);
  await rechaza(taller.crearOrden({ vehiculo: 'Kia', cliente: 'Luis', items: [{ servicio: 'Alineación', cantidad: 1 }] }, CAJERO), /precio/);
  await rechaza(taller.crearOrden({ vehiculo: 'Kia', cliente: 'Luis', telefono: 'abc', items: [{ servicio: 'X', cantidad: 1, precioUnitario: 1 }] }, CAJERO), /teléfono/);
});

// ── Caja ─────────────────────────────────────────
test('cierre: espera solo efectivo, exige justificación y separa turnos', async () => {
  // Cierra cualquier turno previo de las pruebas anteriores
  const previo = await caja.resumenTurno();
  if (previo.cantidadVentas > 0) {
    await caja.confirmarCierre({ efectivoContado: previo.efectivoEsperado }, CAJERO);
  }

  const p = await producto({ precioVenta: 200 });
  await pos.confirmarVenta({ metodoPago: 'EFECTIVO', items: [{ productoId: p.id, cantidad: 1 }] }, CAJERO);
  await pos.confirmarVenta({ metodoPago: 'TARJETA', items: [{ productoId: p.id, cantidad: 2 }] }, CAJERO);

  const r = await caja.resumenTurno();
  assert.equal(r.totalVentas, 600);
  assert.equal(r.efectivoEsperado, 200);

  await rechaza(caja.confirmarCierre({ efectivoContado: 150 }, CAJERO), /justificación/);
  const cierre = await caja.confirmarCierre({ efectivoContado: 150, observaciones: 'Cambio mal dado' }, CAJERO);
  assert.equal(cierre.diferencia, -50);

  await rechaza(caja.confirmarCierre({ efectivoContado: 0 }, CAJERO), /no hay ventas nuevas/);

  // Una venta posterior pertenece al siguiente turno
  await pos.confirmarVenta({ metodoPago: 'EFECTIVO', items: [{ productoId: p.id, cantidad: 1 }] }, CAJERO);
  const nuevo = await caja.resumenTurno();
  assert.equal(nuevo.cantidadVentas, 1);
  assert.equal(nuevo.efectivoEsperado, 200);
});

test('no se pueden anular ventas ya incluidas en un cierre', async () => {
  const p = await producto();
  const v = await pos.confirmarVenta({ metodoPago: 'EFECTIVO', items: [{ productoId: p.id, cantidad: 1 }] }, CAJERO);
  const r = await caja.resumenTurno();
  await caja.confirmarCierre({ efectivoContado: r.efectivoEsperado }, CAJERO);
  await rechaza(pos.anularVenta({ ventaId: v.id, motivoAnulacion: 'tarde' }, ADMIN), /cierre de caja/);
});

// ── Reportes y respaldo ──────────────────────────
test('los reportes y documentos PDF se generan', async () => {
  const hoy = new Date();
  const venta = await prisma.venta.findFirst();
  const cierre = await prisma.cierreCaja.findFirst();
  const rutas = [
    await reportes.generarReporteDiario(fechaLocalISO(hoy), ADMIN),
    await reportes.generarReporteMensual({ mes: hoy.getMonth() + 1, anio: hoy.getFullYear() }, ADMIN),
    await reportes.generarReporteInventario(ADMIN),
    await reportes.generarReporteVentas({ desde: fechaLocalISO(hoy), hasta: fechaLocalISO(hoy), usuarioId: CAJERO.id }, ADMIN),
    await reportes.generarFactura(venta.id, ADMIN),
    await reportes.generarCierre(cierre.id, ADMIN),
  ];
  for (const r of rutas) assert.ok(fs.statSync(r).size > 1000, r);
  await rechaza(reportes.generarReporteDiario('2026-13-45'), /fecha/);
  await rechaza(reportes.generarReporteVentas({ desde: '2026-05-02', hasta: '2026-05-01' }), /posterior/);
});

test('el respaldo crea una copia válida de la base', async () => {
  const r = await backup.realizarBackup();
  assert.equal(r.success, true, r.error);
  assert.ok(fs.statSync(r.path).size > 0);
});

// ── API remota ───────────────────────────────────
test('API remota: login por rol, token obligatorio y reporte mensual', async () => {
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (body) => fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  try {
    assert.equal((await post({ usuario: 'cajero', password: 'clave1234' })).status, 403);
    assert.equal((await post({ usuario: 'super', password: 'nop' })).status, 401);
    assert.equal((await fetch(`${base}/api/cashier/resumen`)).status, 401);

    const { token } = await (await post({ usuario: 'super', password: 'clave1234' })).json();
    const h = { Authorization: `Bearer ${token}` };
    const mensual = await fetch(`${base}/api/reports/mensual?mes=1&anio=2026`, { headers: h });
    assert.equal(mensual.status, 200);
    assert.equal((await fetch(`${base}/api/reports/mensual?mes=13&anio=2026`, { headers: h })).status, 400);
    assert.equal((await fetch(`${base}/api/reports/diario?fecha=${fechaLocalISO()}`, { headers: h })).status, 200);
  } finally {
    server.close();
  }
});
