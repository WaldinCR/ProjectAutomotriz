// Manejadores IPC — Comunicación entre Renderer (React) y Main (Node.js)
const { ipcMain } = require('electron');

// Importar servicios
const authService = require('./auth/auth.service');
const posService = require('./pos/pos.service');
const inventoryService = require('./inventory/inventory.service');
const workshopService = require('./workshop/workshop.service');
const cashierService = require('./cashier/cashier.service');
const reportsService = require('./reports/reports.service');
const adminService = require('./admin/admin.service');

function registerIpcHandlers() {
  // ── Autenticación ──────────────────────────────
  ipcMain.handle('auth:login', async (event, data) => {
    return authService.login(data);
  });

  ipcMain.handle('auth:logout', async (event) => {
    return { success: true };
  });

  // ── Punto de Venta (POS) ───────────────────────
  ipcMain.handle('pos:buscarProducto', async (event, codigo) => {
    return posService.buscarProducto(codigo);
  });

  ipcMain.handle('pos:confirmarVenta', async (event, data) => {
    return posService.confirmarVenta(data);
  });

  ipcMain.handle('pos:anularVenta', async (event, data) => {
    return posService.anularVenta(data);
  });

  // ── Inventario ─────────────────────────────────
  ipcMain.handle('inventory:listar', async (event) => {
    return inventoryService.listarProductos();
  });

  ipcMain.handle('inventory:crear', async (event, data) => {
    return inventoryService.crearProducto(data);
  });

  ipcMain.handle('inventory:editar', async (event, data) => {
    return inventoryService.editarProducto(data);
  });

  ipcMain.handle('inventory:entrada', async (event, data) => {
    return inventoryService.registrarEntrada(data);
  });

  // ── Taller (Órdenes de Trabajo) ─────────────────
  ipcMain.handle('workshop:crear', async (event, data) => {
    return workshopService.crearOrden(data);
  });

  ipcMain.handle('workshop:listar', async (event) => {
    return workshopService.listarOrdenes();
  });

  ipcMain.handle('workshop:estado', async (event, data) => {
    return workshopService.cambiarEstado(data);
  });

  ipcMain.handle('workshop:facturar', async (event, data) => {
    return workshopService.facturarOrden(data);
  });

  // ── Caja ───────────────────────────────────────
  ipcMain.handle('cashier:resumen', async (event) => {
    return cashierService.resumenDia();
  });

  ipcMain.handle('cashier:cierre', async (event, data) => {
    return cashierService.confirmarCierre(data);
  });

  // ── Reportes ───────────────────────────────────
  ipcMain.handle('reports:diario', async (event, fecha) => {
    return reportsService.generarReporteDiario(fecha);
  });

  ipcMain.handle('reports:mensual', async (event, data) => {
    return reportsService.generarReporteMensual(data);
  });

  // ── Admin ──────────────────────────────────────
  ipcMain.handle('admin:usuarios', async (event) => {
    return adminService.listarUsuarios();
  });

  ipcMain.handle('admin:crearUsuario', async (event, data) => {
    return adminService.crearUsuario(data);
  });

  ipcMain.handle('admin:auditLog', async (event, data) => {
    return adminService.consultarAuditLog(data);
  });
}

module.exports = { registerIpcHandlers };
