// Servidor Express local para Supervisor Remoto (solo lectura)
//
// SEGURIDAD: por defecto escucha solo en 127.0.0.1. El acceso remoto debe
// hacerse a través de un túnel cifrado (WireGuard, SSH, Cloudflare Tunnel...)
// según RNF-07; nunca exponiendo este puerto HTTP directamente a la red.
// Para escuchar en otra interfaz defina REMOTE_API_HOST en .env.
const fs = require('fs');
const http = require('http');
const https = require('https');
const express = require('express');
const prisma = require('./core/prisma');
const authService = require('./auth/auth.service');
const cashierService = require('./cashier/cashier.service');
const inventoryService = require('./inventory/inventory.service');
const schemas = require('./core/validation');
const { normalizarError, AppError } = require('./core/errors');
const { ADMIN_SUPERVISOR } = require('./core/roles');
const { rangoDia, rangoMes, dinero } = require('./core/dates');

const ESTADO_HTTP = { VALIDACION: 400, CREDENCIALES: 401, BLOQUEADO: 423, NO_ENCONTRADO: 404, PROHIBIDO: 403 };

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '10kb' }));
  app.use((req, res, next) => {
    res.set({ 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' });
    next();
  });

  // Envuelve un handler async y traduce errores a códigos HTTP sin filtrar detalles internos
  const ruta = (fn) => async (req, res) => {
    try {
      res.json(await fn(req));
    } catch (error) {
      const { code, message } = normalizarError(error);
      res.status(ESTADO_HTTP[code] || 500).json({ error: message });
    }
  };

  function authenticateJWT(req, res, next) {
    const [tipo, token] = (req.headers.authorization || '').split(' ');
    if (tipo !== 'Bearer' || !token) {
      return res.status(401).json({ error: 'Acceso denegado: Token no proporcionado' });
    }
    try {
      const payload = authService.verificarToken(token);
      if (!ADMIN_SUPERVISOR.includes(payload.rol)) {
        return res.status(403).json({ error: 'Acceso denegado: Privilegios insuficientes' });
      }
      req.user = payload;
      next();
    } catch {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }
  }

  // Login: solo SUPERVISOR y ADMINISTRADOR obtienen token (con bloqueo por intentos, RF-06)
  app.post('/api/auth/login', ruta(async (req) => {
    const usuario = await authService.login(req.body);
    if (!ADMIN_SUPERVISOR.includes(usuario.rol)) {
      throw new AppError('Acceso remoto no permitido para este rol', 'PROHIBIDO');
    }
    if (usuario.debeCambiarPassword) {
      throw new AppError('Debe cambiar su contraseña temporal en la aplicación antes de usar el acceso remoto', 'PROHIBIDO');
    }
    return { token: authService.emitirToken(usuario), usuario };
  }));

  app.get('/api/reports/diario', authenticateJWT, ruta(async (req) => {
    const fecha = schemas.reporteDiario.parse(req.query.fecha);
    const { inicio, fin } = rangoDia(fecha);
    const [resumen, ventas] = await Promise.all([
      cashierService.resumenDia(fecha),
      prisma.venta.findMany({
        where: { fecha: { gte: inicio, lt: fin }, estado: 'CONFIRMADA' },
        select: { numeroFactura: true, fecha: true, total: true, metodoPago: true, usuario: { select: { nombre: true } } },
        orderBy: { fecha: 'asc' },
      }),
    ]);
    return { fecha, ...resumen, ventasDetail: ventas };
  }));

  app.get('/api/reports/mensual', authenticateJWT, ruta(async (req) => {
    const { mes, anio } = schemas.reporteMensual.parse(req.query);
    const { inicio, fin } = rangoMes(mes, anio);
    const [ventas, ordenesCompletadas, cierres] = await Promise.all([
      prisma.venta.findMany({ where: { fecha: { gte: inicio, lt: fin }, estado: 'CONFIRMADA' }, select: { total: true, metodoPago: true } }),
      prisma.ordenTrabajo.count({ where: { fechaCreacion: { gte: inicio, lt: fin }, estado: { in: ['COMPLETADA', 'FACTURADA'] } } }),
      prisma.cierreCaja.findMany({
        where: { fecha: { gte: inicio, lt: fin } },
        include: { usuario: { select: { nombre: true } } },
        orderBy: { fecha: 'asc' },
      }),
    ]);
    const resumen = cashierService.resumirVentas(ventas);
    return {
      mes, anio,
      totalVentas: dinero(resumen.totalVentas),
      porMetodo: resumen.porMetodo,
      cantidadVentas: resumen.cantidadVentas,
      ordenesCompletadas,
      cierres,
    };
  }));

  app.get('/api/health', (req, res) => res.json({ ok: true, servicio: 'SGI Automotriz', hora: new Date() }));
  app.get('/api/cashier/resumen', authenticateJWT, ruta(() => cashierService.resumenTurno()));
  app.get('/api/inventory/listar', authenticateJWT, ruta(() => inventoryService.listarProductos()));
  app.get('/api/inventory/stock-bajo', authenticateJWT, ruta(() => inventoryService.productosStockBajo()));

  app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
  return app;
}

// RNF-07: si se configuran certificado y llave, la API se sirve por HTTPS
function opcionesTls() {
  const cert = process.env.REMOTE_API_TLS_CERT;
  const key = process.env.REMOTE_API_TLS_KEY;
  if (!cert || !key) return null;
  try {
    return { cert: fs.readFileSync(cert), key: fs.readFileSync(key) };
  } catch (error) {
    // Nunca se degrada a HTTP en silencio si se pidió TLS
    throw new Error(`No se pudo leer el certificado TLS de la API remota (${error.message}). La API no se iniciará.`);
  }
}

function startServer(port = 3000, host = '127.0.0.1') {
  const tls = opcionesTls();
  const app = createApp();
  const local = ['127.0.0.1', 'localhost', '::1'].includes(host);
  if (!tls && !local) {
    console.warn('[Express] ADVERTENCIA: API expuesta en la red sin TLS. Configure REMOTE_API_TLS_CERT/KEY o use un túnel cifrado.');
  }
  const server = (tls ? https.createServer(tls, app) : http.createServer(app)).listen(port, host, () => {
    console.log(`[Express] API de supervisión activa en ${tls ? 'https' : 'http'}://${host}:${port}`);
  });
  server.on('error', (err) => console.error('[Express] No se pudo iniciar la API remota:', err.message));
  return server;
}

module.exports = { startServer, createApp, opcionesTls };
