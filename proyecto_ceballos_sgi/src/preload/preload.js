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
    cambiarPassword: invoke('auth:cambiarPassword'),
  },

  // ── Configuración e impresora ──────────────────
  config: {
    obtener:          invoke('config:obtener'),
    actualizar:       invoke('config:actualizar'),
    secuencias:       invoke('config:secuencias'),
    guardarSecuencia: invoke('config:guardarSecuencia'),
    imprimirPrueba:   invoke('printer:prueba'),
    imprimirVenta:    invoke('printer:venta'),
  },

  // ── Punto de Venta (POS) ───────────────────────
  pos: {
    buscarProducto: invoke('pos:buscarProducto'),
    calcular:       invoke('pos:calcular'),
    confirmarVenta: invoke('pos:confirmarVenta'),
    anularVenta:    invoke('pos:anularVenta'),
    listarVentas:   invoke('pos:listarVentas'),
    obtenerVenta:   invoke('pos:obtenerVenta'),
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
    tecnicos:      invoke('workshop:tecnicos'),
    asignar:       invoke('workshop:asignar'),
    agregarItem:   invoke('workshop:agregarItem'),
    quitarItem:    invoke('workshop:quitarItem'),
    cambiarEstado: invoke('workshop:estado'),
    facturarOrden: invoke('workshop:facturar'),
  },

  // ── Caja ───────────────────────────────────────
  cashier: {
    resumen:         invoke('cashier:resumen'),
    confirmarCierre: invoke('cashier:cierre'),
    historial:       invoke('cashier:historial'),
  },

  // ── Reportes y documentos ──────────────────────
  reports: {
    diario:     invoke('reports:diario'),
    mensual:    invoke('reports:mensual'),
    inventario: invoke('reports:inventario'),
    ventas:     invoke('reports:ventas'),
    dgii:       invoke('reports:dgii'),
    factura:    invoke('reports:factura'),
    cierre:     invoke('reports:cierre'),
    abrir:      invoke('reports:abrir'),
    empleados:  invoke('reports:empleados'),
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
