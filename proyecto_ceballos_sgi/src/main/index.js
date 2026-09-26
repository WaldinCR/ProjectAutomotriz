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

  // Cargar dist compilado si existe
  const distHtml = path.resolve(__dirname, '../../dist/index.html');
  if (process.env.VITE_DEV === 'true') {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else if (fs.existsSync(distHtml)) {
    win.loadFile(distHtml);
  } else {
    win.loadURL('http://localhost:5173');
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
