// Punto de entrada principal — Main Process (Electron)
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const schedule = require('node-schedule');
const { registerIpcHandlers } = require('./ipcHandlers');
const { startServer } = require('./server');
const { realizarBackup } = require('./backup/backup.service');

// Cargar variables de entorno manualmente desde .env
try {
  const envPath = path.join(__dirname, '../../.env');
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
      const parts = line.split('=');
      if (parts.length === 2) {
        const key = parts[0].trim();
        const value = parts[1].trim().replace(/^["']|["']$/g, '');
        process.env[key] = value;
      }
    });
  }
} catch (e) {
  console.warn('No se pudo cargar el archivo .env:', e);
}

let expressServer = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1280,
    minHeight: 768,
    webPreferences: {
      // SEGURIDAD: nodeIntegration SIEMPRE false
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/preload.js'),
    },
  });

  // En desarrollo carga Vite, en producción carga el build
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../../dist/index.html'));
  }
}

app.whenReady().then(() => {
  // 1. Registrar manejadores IPC
  registerIpcHandlers();

  // 2. Iniciar servidor Express
  const port = process.env.PORT || 3000;
  expressServer = startServer(Number(port));

  // 3. Configurar copias de seguridad automáticas a las 11:59 PM diariamente
  schedule.scheduleJob('59 23 * * *', () => {
    console.log('[Schedule] Iniciando copia de seguridad programada de SQLite...');
    realizarBackup();
  });

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  if (expressServer) {
    expressServer.close();
  }
});
