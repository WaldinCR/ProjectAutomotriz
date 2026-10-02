// PUENTE DE SEGURIDAD entre React (Renderer) y Node.js (Main)
// Solo expone las funciones que React NECESITA. Nada más.
// Cada llamada devuelve { ok, data } o { ok: false, error: { code, message } };
// src/renderer/services/api.js se encarga de desenvolver la respuesta.
const { contextBridge, ipcRenderer } = require('electron');

const invoke = (canal) => (datos) => ipcRenderer.invoke(canal, datos);

contextBridge.exposeInMainWorld('api', {

  // ── Autenticación ──────────────────────────────
  auth: {
    login:  invoke('auth:login'),
    logout: invoke('auth:logout'),
    sesion: invoke('auth:sesion'),
  },

  // ── Punto de Venta (POS) ───────────────────────
  pos: {
    buscarProducto: invoke('pos:buscarProducto'),
    confirmarVenta: invoke('pos:confirmarVenta'),
    anularVenta:    invoke('pos:anularVenta'),
    listarVentas:   invoke('pos:listarVentas'),
  },

  // ── Inventario ─────────────────────────────────
  inventory: {
    listarProductos:  invoke('inventory:listar'),
    buscar:           invoke('inventory:buscar'),
    stockBajo:        invoke('inventory:stockBajo'),
    crearProducto:    invoke('inventory:crear'),
    editarProducto:   invoke('inventory:editar'),
    registrarEntrada: invoke('inventory:entrada'),
    registrarAjuste:  invoke('inventory:ajuste'),
    movimientos:      invoke('inventory:movimientos'),
  },

  // ── Órdenes de Trabajo ─────────────────────────
  workshop: {
    crearOrden:    invoke('workshop:crear'),
    listarOrdenes: invoke('workshop:listar'),
    cambiarEstado: invoke('workshop:estado'),
    facturarOrden: invoke('workshop:facturar'),
  },

  // ── Caja ───────────────────────────────────────
  cashier: {
    resumen:         invoke('cashier:resumen'),
    confirmarCierre: invoke('cashier:cierre'),
    historial:       invoke('cashier:historial'),
  },

  // ── Reportes ───────────────────────────────────
  reports: {
    diario:     invoke('reports:diario'),
    mensual:    invoke('reports:mensual'),
    inventario: invoke('reports:inventario'),
    abrir:      invoke('reports:abrir'),
  },

  // ── Admin ──────────────────────────────────────
  admin: {
    listarUsuarios:      invoke('admin:usuarios'),
    crearUsuario:        invoke('admin:crearUsuario'),
    editarUsuario:       invoke('admin:editarUsuario'),
    restablecerPassword: invoke('admin:restablecerPassword'),
    auditLog:            invoke('admin:auditLog'),
    backup:              invoke('admin:backup'),
  },
});
