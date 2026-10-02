// Punto de entrada principal — Main Process (Electron)
// Las variables de entorno se cargan ANTES de requerir los servicios:
// estos leen process.env (DATABASE_URL, JWT_SECRET) al cargarse.
require('./core/env').cargarEnv();

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const schedule = require('node-schedule');
const { registerIpcHandlers } = require('./ipcHandlers');
const { startServer } = require('./server');
const { realizarBackup, backupSiCorresponde } = require('./backup/backup.service');
const sesiones = require('./core/session');
const prisma = require('./core/prisma');

const DEV_URL = 'http://localhost:5173';
// `npm run dev` pasa --dev: siempre usa Vite aunque exista un dist/ antiguo
const ES_DEV = process.argv.includes('--dev') || process.env.VITE_DEV === 'true';
let expressServer = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1280,
    minHeight: 768,
    webPreferences: {
      // SEGURIDAD: el renderer no tiene acceso a Node.js
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, '../preload/preload.js'),
    },
  });

  const senderId = win.webContents.id;
  win.webContents.on('destroyed', () => sesiones.cerrar(senderId));

  // SEGURIDAD: no permitir abrir ventanas nuevas ni navegar fuera de la app
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(DEV_URL) && !url.startsWith('file://')) event.preventDefault();
  });

  const distHtml = path.resolve(__dirname, '../../dist/index.html');
  if (ES_DEV || !fs.existsSync(distHtml)) {
    win.loadURL(DEV_URL);
    if (ES_DEV) win.webContents.openDevTools();
  } else {
    win.loadFile(distHtml);
  }
}

app.whenReady().then(() => {
  // 1. Registrar manejadores IPC
  registerIpcHandlers();

  // 2. Servidor de supervisión remota (opcional)
  if (process.env.REMOTE_API_ENABLED !== 'false') {
    expressServer = startServer(Number(process.env.PORT) || 3000, process.env.REMOTE_API_HOST || '127.0.0.1');
  }

  // 3. Copias de seguridad: diaria a las 11:59 PM y al iniciar si la última tiene más de 24 h
  schedule.scheduleJob('59 23 * * *', () => {
    console.log('[Schedule] Iniciando copia de seguridad programada de SQLite...');
    realizarBackup();
  });
  backupSiCorresponde();

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  if (expressServer) expressServer.close();
  prisma.$disconnect();
});
