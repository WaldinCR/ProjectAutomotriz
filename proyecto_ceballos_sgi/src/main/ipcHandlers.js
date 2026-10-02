// Manejadores IPC — Comunicación entre Renderer (React) y Main (Node.js)
//
// Reglas de seguridad aplicadas a TODOS los canales:
//  1. La identidad del usuario se toma de la sesión del proceso principal,
//     nunca de los datos enviados por el renderer.
//  2. Cada canal declara qué roles pueden usarlo.
//  3. La respuesta siempre es { ok: true, data } o { ok: false, error: { code, message } }
//     para que el renderer reciba mensajes claros y el código del error.
const path = require('path');
const { ipcMain, shell, app } = require('electron');

const sesiones = require('./core/session');
const { normalizarError, AppError } = require('./core/errors');
const { TODOS, OPERADORES, SOLO_ADMIN, ADMIN_SUPERVISOR } = require('./core/roles');

const authService = require('./auth/auth.service');
const posService = require('./pos/pos.service');
const inventoryService = require('./inventory/inventory.service');
const workshopService = require('./workshop/workshop.service');
const cashierService = require('./cashier/cashier.service');
const reportsService = require('./reports/reports.service');
const adminService = require('./admin/admin.service');
const backupService = require('./backup/backup.service');

async function responder(fn) {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    return { ok: false, error: normalizarError(error) };
  }
}

// Canal público (solo login)
function publico(canal, fn) {
  ipcMain.handle(canal, (event, datos) => responder(() => fn(datos, event)));
}

// Canal protegido: requiere sesión válida y uno de los roles indicados
function protegido(canal, roles, fn) {
  ipcMain.handle(canal, (event, datos) => responder(() => {
    const usuario = sesiones.requerir(event.sender.id, roles);
    return fn(datos, usuario, event);
  }));
}

// Solo se abren PDFs de reportes generados por el sistema en la carpeta de descargas
function abrirReporte(ruta) {
  const destino = path.resolve(String(ruta || ''));
  const carpeta = path.resolve(process.env.REPORTS_DIR || app.getPath('downloads'));
  const nombre = path.basename(destino);
  if (path.dirname(destino) !== carpeta || !/^Reporte_[\w-]+\.pdf$/.test(nombre)) {
    throw new AppError('Archivo de reporte no válido');
  }
  return shell.openPath(destino).then((err) => {
    if (err) throw new AppError(`No se pudo abrir el reporte: ${err}`);
    return true;
  });
}

function registerIpcHandlers() {
  // ── Autenticación ──────────────────────────────
  publico('auth:login', async (datos, event) => {
    const usuario = await authService.login(datos);
    sesiones.iniciar(event.sender.id, usuario);
    return usuario;
  });
  ipcMain.handle('auth:logout', (event) => {
    sesiones.cerrar(event.sender.id);
    return { ok: true, data: true };
  });
  protegido('auth:sesion', TODOS, (_datos, usuario) => usuario);

  // ── Punto de Venta (POS) ───────────────────────
  protegido('pos:buscarProducto', OPERADORES, (codigo) => posService.buscarProducto(codigo));
  protegido('pos:confirmarVenta', OPERADORES, (datos, u) => posService.confirmarVenta(datos, u));
  protegido('pos:anularVenta', ADMIN_SUPERVISOR, (datos, u) => posService.anularVenta(datos, u));
  protegido('pos:listarVentas', TODOS, (filtros) => posService.listarVentas(filtros));

  // ── Inventario ─────────────────────────────────
  protegido('inventory:listar', TODOS, (opciones, u) =>
    inventoryService.listarProductos({ incluirInactivos: u.rol === 'ADMINISTRADOR' && !!opciones?.incluirInactivos }));
  protegido('inventory:buscar', TODOS, (termino) => inventoryService.buscarProductos(termino));
  protegido('inventory:stockBajo', TODOS, () => inventoryService.productosStockBajo());
  protegido('inventory:crear', SOLO_ADMIN, (datos, u) => inventoryService.crearProducto(datos, u));
  protegido('inventory:editar', SOLO_ADMIN, (datos, u) => inventoryService.editarProducto(datos, u));
  protegido('inventory:entrada', SOLO_ADMIN, (datos, u) => inventoryService.registrarEntrada(datos, u));
  protegido('inventory:ajuste', SOLO_ADMIN, (datos, u) => inventoryService.registrarAjuste(datos, u));
  protegido('inventory:movimientos', ADMIN_SUPERVISOR, (productoId) => inventoryService.historialMovimientos(productoId));

  // ── Taller (Órdenes de Trabajo) ─────────────────
  protegido('workshop:crear', OPERADORES, (datos, u) => workshopService.crearOrden(datos, u));
  protegido('workshop:listar', TODOS, () => workshopService.listarOrdenes());
  protegido('workshop:estado', OPERADORES, (datos, u) => workshopService.cambiarEstado(datos, u));
  protegido('workshop:facturar', OPERADORES, (datos, u) => workshopService.facturarOrden(datos, u));

  // ── Caja ───────────────────────────────────────
  protegido('cashier:resumen', TODOS, () => cashierService.resumenTurno());
  protegido('cashier:cierre', OPERADORES, (datos, u) => cashierService.confirmarCierre(datos, u));
  protegido('cashier:historial', SOLO_ADMIN, () => cashierService.listarCierres());

  // ── Reportes ───────────────────────────────────
  protegido('reports:diario', ADMIN_SUPERVISOR, (fecha) => reportsService.generarReporteDiario(fecha));
  protegido('reports:mensual', ADMIN_SUPERVISOR, (datos) => reportsService.generarReporteMensual(datos));
  protegido('reports:inventario', ADMIN_SUPERVISOR, () => reportsService.generarReporteInventario());
  protegido('reports:abrir', ADMIN_SUPERVISOR, (ruta) => abrirReporte(ruta));

  // ── Admin ──────────────────────────────────────
  protegido('admin:usuarios', SOLO_ADMIN, () => adminService.listarUsuarios());
  protegido('admin:crearUsuario', SOLO_ADMIN, (datos, u) => adminService.crearUsuario(datos, u));
  protegido('admin:editarUsuario', SOLO_ADMIN, (datos, u) => adminService.editarUsuario(datos, u));
  protegido('admin:restablecerPassword', SOLO_ADMIN, (datos, u) => adminService.restablecerPassword(datos, u));
  protegido('admin:auditLog', SOLO_ADMIN, (filtros) => adminService.consultarAuditLog(filtros));
  protegido('admin:backup', SOLO_ADMIN, async () => {
    const r = await backupService.realizarBackup();
    if (!r.success) throw new AppError(`No se pudo realizar el respaldo: ${r.error}`);
    return r;
  });
}

module.exports = { registerIpcHandlers };
