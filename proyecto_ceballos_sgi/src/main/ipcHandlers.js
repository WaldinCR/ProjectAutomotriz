// Manejadores IPC — Comunicación entre Renderer (React) y Main (Node.js)
//
// Reglas de seguridad aplicadas a TODOS los canales:
//  1. La identidad del usuario se toma de la sesión del proceso principal,
//     nunca de los datos enviados por el renderer.
//  2. Cada canal declara qué roles pueden usarlo.
//  3. La respuesta siempre es { ok: true, data } o { ok: false, error: { code, message } }
//     para que el renderer reciba mensajes claros y el código del error.
const path = require('path');
const { ipcMain, shell } = require('electron');

const sesiones = require('./core/session');
const { normalizarError, AppError } = require('./core/errors');
const { TODOS, OPERADORES, SOLO_ADMIN, ADMIN_SUPERVISOR, GESTION, TALLER } = require('./core/roles');

const authService = require('./auth/auth.service');
const posService = require('./pos/pos.service');
const inventoryService = require('./inventory/inventory.service');
const workshopService = require('./workshop/workshop.service');
const cashierService = require('./cashier/cashier.service');
const reportsService = require('./reports/reports.service');
const adminService = require('./admin/admin.service');
const backupService = require('./backup/backup.service');
const configService = require('./config/config.service');
const printerService = require('./printer/printer.service');

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

// Solo se abren documentos generados por el sistema dentro de su carpeta
function abrirDocumento(ruta) {
  const destino = path.resolve(String(ruta || ''));
  const base = path.resolve(reportsService.carpetaBase());
  const relativa = path.relative(base, destino);
  if (relativa.startsWith('..') || path.isAbsolute(relativa) || !/\.(pdf|csv)$/i.test(destino)) {
    throw new AppError('Documento no válido');
  }
  return shell.openPath(destino).then((err) => {
    if (err) throw new AppError(`No se pudo abrir el documento: ${err}`);
    return true;
  });
}

// Imprime el ticket si la empresa lo configuró; un fallo de impresora nunca anula la venta
async function conImpresionAutomatica(venta) {
  const config = await configService.obtener();
  if (!config.imprimirAutomatico || config.impresoraTipo === 'NINGUNA') return venta;
  try {
    await printerService.imprimirVenta(venta.id);
    return { ...venta, impresion: { ok: true } };
  } catch (error) {
    return { ...venta, impresion: { ok: false, mensaje: normalizarError(error).message } };
  }
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

  // ── Configuración de la empresa ────────────────
  protegido('config:obtener', TODOS, () => configService.obtener());
  protegido('config:actualizar', SOLO_ADMIN, (datos, u) => configService.actualizar(datos, u));
  protegido('config:secuencias', SOLO_ADMIN, () => configService.listarSecuencias());
  protegido('config:guardarSecuencia', SOLO_ADMIN, (datos, u) => configService.guardarSecuencia(datos, u));
  protegido('printer:prueba', SOLO_ADMIN, () => printerService.imprimirPrueba());
  protegido('printer:venta', GESTION, (ventaId) => printerService.imprimirVenta(ventaId));

  // ── Punto de Venta (POS) ───────────────────────
  protegido('pos:buscarProducto', OPERADORES, (codigo) => posService.buscarProducto(codigo));
  protegido('pos:calcular', OPERADORES, (datos) => posService.calcularVenta(datos));
  protegido('pos:confirmarVenta', OPERADORES, async (datos, u) => conImpresionAutomatica(await posService.confirmarVenta(datos, u)));
  protegido('pos:anularVenta', ADMIN_SUPERVISOR, (datos, u) => posService.anularVenta(datos, u));
  protegido('pos:listarVentas', GESTION, (filtros) => posService.listarVentas(filtros));
  protegido('pos:obtenerVenta', GESTION, (ventaId) => posService.obtenerVenta(ventaId));

  // ── Inventario ─────────────────────────────────
  protegido('inventory:listar', TODOS, (opciones, u) =>
    inventoryService.listarProductos({ incluirInactivos: u.rol === 'ADMINISTRADOR' && !!opciones?.incluirInactivos }));
  protegido('inventory:buscar', TODOS, (termino) => inventoryService.buscarProductos(termino));
  protegido('inventory:stockBajo', GESTION, () => inventoryService.productosStockBajo());
  protegido('inventory:crear', SOLO_ADMIN, (datos, u) => inventoryService.crearProducto(datos, u));
  protegido('inventory:editar', SOLO_ADMIN, (datos, u) => inventoryService.editarProducto(datos, u));
  protegido('inventory:entrada', SOLO_ADMIN, (datos, u) => inventoryService.registrarEntrada(datos, u));
  protegido('inventory:ajuste', SOLO_ADMIN, (datos, u) => inventoryService.registrarAjuste(datos, u));
  protegido('inventory:movimientos', ADMIN_SUPERVISOR, (productoId) => inventoryService.historialMovimientos(productoId));

  // ── Taller (Órdenes de Trabajo) ─────────────────
  protegido('workshop:crear', OPERADORES, (datos, u) => workshopService.crearOrden(datos, u));
  protegido('workshop:listar', TODOS, (filtros, u) => workshopService.listarOrdenes(filtros, u));
  protegido('workshop:tecnicos', TODOS, () => workshopService.listarTecnicos());
  protegido('workshop:asignar', OPERADORES, (datos, u) => workshopService.asignarTecnico(datos, u));
  protegido('workshop:agregarItem', TALLER, (datos, u) => workshopService.agregarItem(datos, u));
  protegido('workshop:quitarItem', TALLER, (datos, u) => workshopService.quitarItem(datos, u));
  protegido('workshop:estado', TALLER, (datos, u) => workshopService.cambiarEstado(datos, u));
  protegido('workshop:facturar', OPERADORES, async (datos, u) => conImpresionAutomatica(await workshopService.facturarOrden(datos, u)));

  // ── Caja ───────────────────────────────────────
  protegido('cashier:resumen', GESTION, () => cashierService.resumenTurno());
  protegido('cashier:cierre', OPERADORES, (datos, u) => cashierService.confirmarCierre(datos, u));
  protegido('cashier:historial', SOLO_ADMIN, () => cashierService.listarCierres());

  // ── Reportes y documentos ──────────────────────
  protegido('reports:diario', ADMIN_SUPERVISOR, (fecha, u) => reportsService.generarReporteDiario(fecha, u));
  protegido('reports:mensual', ADMIN_SUPERVISOR, (datos, u) => reportsService.generarReporteMensual(datos, u));
  protegido('reports:inventario', ADMIN_SUPERVISOR, (_d, u) => reportsService.generarReporteInventario(u));
  protegido('reports:ventas', ADMIN_SUPERVISOR, (filtros, u) => reportsService.generarReporteVentas(filtros, u));
  protegido('reports:dgii', SOLO_ADMIN, (datos) => reportsService.exportarDgii(datos));
  protegido('reports:factura', GESTION, (ventaId, u) => reportsService.generarFactura(ventaId, u));
  protegido('reports:cierre', GESTION, (cierreId, u) => reportsService.generarCierre(cierreId, u));
  protegido('reports:abrir', GESTION, (ruta) => abrirDocumento(ruta));

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
