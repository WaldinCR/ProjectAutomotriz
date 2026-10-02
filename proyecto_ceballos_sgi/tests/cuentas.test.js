// Primera instalación, contraseñas temporales y cambio de contraseña
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const prisma = require('../src/main/core/prisma');
const { migrar } = require('../src/main/core/migrator');
const sesiones = require('../src/main/core/session');
const auth = require('../src/main/auth/auth.service');
const admin = require('../src/main/admin/admin.service');
const { createApp } = require('../src/main/server');
const { normalizarError } = require('../src/main/core/errors');

async function rechaza(promesa, regex) {
  await assert.rejects(promesa, (e) => {
    assert.match(normalizarError(e).message, regex);
    return true;
  });
}

before(async () => {
  await migrar();
  for (const t of ['auditLog', 'movimientoInventario', 'detalleVenta', 'detalleOrden', 'ordenTrabajo', 'venta', 'cierreCaja', 'producto', 'usuario', 'secuenciaNcf']) {
    await prisma[t].deleteMany();
  }
});

after(() => prisma.$disconnect());

test('primera instalación crea un administrador con contraseña temporal', async () => {
  const creado = await auth.asegurarAdministrador();
  assert.equal(creado.usuario, 'admin');
  assert.equal(await auth.asegurarAdministrador(), null, 'no se duplica');

  const u = await auth.login({ usuario: 'admin', password: 'admin123' });
  assert.equal(u.debeCambiarPassword, true);

  // Con clave temporal la sesión solo permite cambiarla
  sesiones.iniciar(500, u);
  assert.throws(() => sesiones.requerir(500, ['ADMINISTRADOR']), /cambiar su contraseña temporal/);
  assert.equal(sesiones.requerir(500, null, { permitirTemporal: true }).id, u.id);

  await rechaza(auth.cambiarPassword({ actual: 'mala', nueva: 'nueva12345' }, u), /actual no es correcta/);
  await rechaza(auth.cambiarPassword({ actual: 'admin123', nueva: 'admin123' }, u), /distinta/);
  await rechaza(auth.cambiarPassword({ actual: 'admin123', nueva: 'corta' }, u), /8 caracteres/);
  const cambiado = await auth.cambiarPassword({ actual: 'admin123', nueva: 'Ceballos2026' }, u);
  assert.equal(cambiado.debeCambiarPassword, false);
  sesiones.actualizar(500, cambiado);
  assert.equal(sesiones.requerir(500, ['ADMINISTRADOR']).id, u.id);

  await rechaza(auth.login({ usuario: 'admin', password: 'admin123' }), /incorrectos/);
  assert.equal((await auth.login({ usuario: 'admin', password: 'Ceballos2026' })).debeCambiarPassword, false);
});

test('usuarios nuevos y contraseñas restablecidas son temporales; la API remota los rechaza', async () => {
  const actor = await prisma.usuario.findUnique({ where: { usuario: 'admin' } });
  const sup = await admin.crearUsuario({ nombre: 'Sup', usuario: 'sup', password: 'inicial123', rol: 'SUPERVISOR' }, actor);
  assert.equal(sup.debeCambiarPassword, true);

  const server = createApp().listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  const login = (password) => fetch(`http://127.0.0.1:${server.address().port}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario: 'sup', password }),
  });
  try {
    const r = await login('inicial123');
    assert.equal(r.status, 403);
    assert.match((await r.json()).error, /contraseña temporal/);

    await auth.cambiarPassword({ actual: 'inicial123', nueva: 'propia12345' }, sup);
    assert.equal((await login('propia12345')).status, 200);

    await admin.restablecerPassword({ id: sup.id, password: 'temporal123' }, actor);
    assert.equal((await prisma.usuario.findUnique({ where: { id: sup.id } })).debeCambiarPassword, true);
    assert.equal((await login('temporal123')).status, 403);
  } finally {
    server.close();
  }
});
