// Punto de entrada principal — Main Process (Electron)
// Las variables de entorno se cargan ANTES de requerir los servicios:
// estos leen process.env (DATABASE_URL, JWT_SECRET) al cargarse.
const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');

// En la app instalada la carpeta del programa es de solo lectura:
// la base de datos y el .env viven en %APPDATA%/SGI Automotriz
if (app.isPackaged) {
  // Electron crea userData de forma diferida; SQLite necesita la carpeta para crear la base
  require('fs').mkdirSync(app.getPath('userData'), { recursive: true });
  require('./core/env').cargarEnv(path.join(app.getPath('userData'), '.env'));
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = `file:${path.join(app.getPath('userData'), 'sgi_database.db').split(path.sep).join('/')}`;
  }
} else {
  require('./core/env').cargarEnv();
}

const fs = require('fs');
const schedule = require('node-schedule');
const { registerIpcHandlers } = require('./ipcHandlers');
const { startServer } = require('./server');
const { realizarBackup, backupSiCorresponde } = require('./backup/backup.service');
const sesiones = require('./core/session');
const prisma = require('./core/prisma');
const { migrar } = require('./core/migrator');

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

app.whenReady().then(async () => {
  // 0. Actualizar la base de datos (con respaldo previo) antes de atenderla
  try {
    await migrar({
      antesDeMigrar: async (pendientes) => {
        console.log('[Migraciones] Pendientes:', pendientes.join(', '));
        const r = await realizarBackup();
        if (!r.success) throw new Error(`No se pudo respaldar la base antes de migrar: ${r.error}`);
      },
    });
  } catch (error) {
    console.error('[Migraciones] Error:', error);
    dialog.showErrorBox('No se pudo actualizar la base de datos',
      `${error.message}

La base de datos no fue modificada. Contacte al soporte técnico.`);
    app.quit();
    return;
  }

  // Primera instalación: garantiza un administrador para poder ingresar
  await require('./auth/auth.service').asegurarAdministrador();

  // 1. Registrar manejadores IPC
  registerIpcHandlers();

  // 2. Servidor de supervisión remota (opcional)
  if (process.env.REMOTE_API_ENABLED !== 'false') {
    try {
      expressServer = startServer(Number(process.env.PORT) || 3000, process.env.REMOTE_API_HOST || '127.0.0.1');
    } catch (error) {
      console.error('[Express]', error.message);
    }
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
