// PUENTE DE SEGURIDAD entre React (Renderer) y Node.js (Main)
// Solo expone las funciones que React NECESITA. Nada más.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {

  // ── Autenticación ──────────────────────────────
  auth: {
    login:  (data) => ipcRenderer.invoke('auth:login', data),
    logout: ()     => ipcRenderer.invoke('auth:logout'),
  },

  // ── Punto de Venta (POS) ───────────────────────
  pos: {
    buscarProducto:  (codigo) => ipcRenderer.invoke('pos:buscarProducto', codigo),
    confirmarVenta:  (data)   => ipcRenderer.invoke('pos:confirmarVenta', data),
    anularVenta:     (data)   => ipcRenderer.invoke('pos:anularVenta', data),
  },

  // ── Inventario ─────────────────────────────────
  inventory: {
    listarProductos:  ()      => ipcRenderer.invoke('inventory:listar'),
    crearProducto:    (data)  => ipcRenderer.invoke('inventory:crear', data),
    editarProducto:   (data)  => ipcRenderer.invoke('inventory:editar', data),
    registrarEntrada: (data)  => ipcRenderer.invoke('inventory:entrada', data),
  },

  // ── Órdenes de Trabajo ─────────────────────────
  workshop: {
    crearOrden:    (data) => ipcRenderer.invoke('workshop:crear', data),
    listarOrdenes: ()     => ipcRenderer.invoke('workshop:listar'),
    cambiarEstado: (data) => ipcRenderer.invoke('workshop:estado', data),
    facturarOrden: (data) => ipcRenderer.invoke('workshop:facturar', data),
  },

  // ── Caja ───────────────────────────────────────
  cashier: {
    resumenDia:      ()     => ipcRenderer.invoke('cashier:resumen'),
    confirmarCierre: (data) => ipcRenderer.invoke('cashier:cierre', data),
  },

  // ── Reportes ───────────────────────────────────
  reports: {
    diario:  (fecha) => ipcRenderer.invoke('reports:diario', fecha),
    mensual: (data)  => ipcRenderer.invoke('reports:mensual', data),
  },

  // ── Admin ──────────────────────────────────────
  admin: {
    listarUsuarios:  ()     => ipcRenderer.invoke('admin:usuarios'),
    crearUsuario:    (data) => ipcRenderer.invoke('admin:crearUsuario', data),
    auditLog:        (data) => ipcRenderer.invoke('admin:auditLog', data),
  },
});
