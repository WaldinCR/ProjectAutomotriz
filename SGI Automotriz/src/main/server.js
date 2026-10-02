// Servidor Express local para Supervisor Remoto
const express = require('express');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const authService = require('./auth/auth.service');
const cashierService = require('./cashier/cashier.service');
const inventoryService = require('./inventory/inventory.service');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'clave_por_defecto';

function startServer(port = 3000) {
  const app = express();
  app.use(express.json());

  // Middleware de Autenticación JWT y verificación de Rol
  function authenticateJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Acceso denegado: Token no proporcionado' });
    }

    const token = authHeader.split(' ')[1];
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      if (payload.rol !== 'SUPERVISOR' && payload.rol !== 'ADMINISTRADOR') {
        return res.status(403).json({ error: 'Acceso denegado: Privilegios insuficientes' });
      }
      req.user = payload;
      next();
    } catch (error) {
      return res.status(403).json({ error: 'Token inválido o expirado' });
    }
  }

  // Endpoint de autenticación para obtener Token
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { usuario, password } = req.body;
      if (!usuario || !password) {
        return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
      }
      const data = await authService.login({ usuario, password });
      res.json(data);
    } catch (error) {
      res.status(401).json({ error: error.message });
    }
  });

  // Endpoint de solo lectura: Reporte Diario
  app.get('/api/reports/diario', authenticateJWT, async (req, res) => {
    try {
      const { fecha } = req.query; // YYYY-MM-DD
      if (!fecha) {
        return res.status(400).json({ error: 'Parámetro de fecha requerido (YYYY-MM-DD)' });
      }

      const resumen = await cashierService.resumenDia(fecha);

      const targetDate = new Date(fecha);
      const inicioDia = new Date(targetDate);
      inicioDia.setUTCHours(0, 0, 0, 0);
      const finDia = new Date(targetDate);
      finDia.setUTCHours(23, 59, 59, 999);

      const ventas = await prisma.venta.findMany({
        where: {
          fecha: { gte: inicioDia, lte: finDia },
          estado: 'CONFIRMADA'
        },
        include: { usuario: { select: { nombre: true, usuario: true } } }
      });

      res.json({
        fecha,
        ...resumen,
        ventasDetail: ventas
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Endpoint de solo lectura: Reporte Mensual
  app.get('/api/reports/mensual', authenticateJWT, async (req, res) => {
    try {
      const { mes, anio } = req.query;
      if (!mes || !anio) {
        return res.status(400).json({ error: 'Parámetros de mes y año requeridos' });
      }

      const mesInt = parseInt(mes);
      const anioInt = parseInt(anio);

      const inicioMes = new Date(Date.utc(anioInt, mesInt - 1, 1, 0, 0, 0, 0));
      const finMes = new Date(Date.utc(anioInt, mesInt, 0, 23, 59, 59, 999));

      const ventas = await prisma.venta.findMany({
        where: {
          fecha: { gte: inicioMes, lte: finMes },
          estado: 'CONFIRMADA'
        }
      });
      const totalVentas = ventas.reduce((sum, v) => sum + v.total, 0);

      const ordenes = await prisma.ordenTrabajo.findMany({
        where: {
          fechaCreacion: { gte: inicioMes, lte: finMes },
          estado: { in: ['COMPLETADA', 'FACTURADA'] }
        }
      });

      const cierres = await prisma.cierreCaja.findMany({
        where: {
          fecha: { gte: inicioMes, lte: finMes }
        },
        include: { usuario: { select: { nombre: true } } }
      });

      res.json({
        mes: mesInt,
        anio: anioInt,
        totalVentas,
        cantidadVentas: ventas.length,
        ordenesCompletadas: ordenes.length,
        cierres
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Endpoint de solo lectura: Resumen de Caja actual (hoy)
  app.get('/api/cashier/resumen', authenticateJWT, async (req, res) => {
    try {
      const resumen = await cashierService.resumenDia();
      res.json(resumen);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Endpoint de solo lectura: Listado de Productos activos
  app.get('/api/inventory/listar', authenticateJWT, async (req, res) => {
    try {
      const productos = await inventoryService.listarProductos();
      res.json(productos);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  const server = app.listen(port, () => {
    console.log(`[Express] Servidor API REST activo en puerto ${port}`);
  });

  return server;
}

module.exports = { startServer };
