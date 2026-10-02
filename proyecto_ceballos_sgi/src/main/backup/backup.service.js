// Servicio de Backup de SQLite (RNF-08, RNF-13)
// Usa VACUUM INTO: genera una copia consistente aunque la base esté en uso,
// a diferencia de copiar el archivo, que puede capturar escrituras a medias.
const fs = require('fs');
const path = require('path');
const prisma = require('../core/prisma');
const { ROOT_DIR } = require('../core/env');

const RETENCION_MS = 30 * 24 * 60 * 60 * 1000; // 30 días
const PATRON = /^backup_\d{8}_\d{6}\.db$/;

function carpetaBackups() {
  if (process.env.BACKUP_DIR) return path.resolve(process.env.BACKUP_DIR);
  try {
    const { app } = require('electron');
    // En la app empaquetada el código está en un .asar de solo lectura
    if (app?.isPackaged) return path.join(app.getPath('userData'), 'backups');
  } catch { /* Fuera de Electron (pruebas/scripts) */ }
  return path.join(ROOT_DIR, 'backups');
}

function marcaDeTiempo(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function listarBackups(dir = carpetaBackups()) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => PATRON.test(f))
    .map(f => ({ archivo: f, ruta: path.join(dir, f), fecha: fs.statSync(path.join(dir, f)).mtime }))
    .sort((a, b) => b.fecha - a.fecha);
}

async function realizarBackup() {
  try {
    const dir = carpetaBackups();
    fs.mkdirSync(dir, { recursive: true });

    const archivo = `backup_${marcaDeTiempo()}.db`;
    const destino = path.join(dir, archivo);
    // La ruta la genera el sistema; se escapan comillas por seguridad
    await prisma.$executeRawUnsafe(`VACUUM INTO '${destino.replace(/'/g, "''")}'`);
    console.log(`[Backup] Base de datos respaldada en: ${destino}`);

    const ahora = Date.now();
    for (const b of listarBackups(dir)) {
      if (ahora - b.fecha.getTime() > RETENCION_MS) {
        fs.unlinkSync(b.ruta);
        console.log(`[Backup] Copia obsoleta eliminada: ${b.archivo}`);
      }
    }
    return { success: true, file: archivo, path: destino };
  } catch (error) {
    console.error('[Backup] Error durante la copia de seguridad:', error);
    return { success: false, error: error.message };
  }
}

// Si el equipo estuvo apagado a la hora programada, respalda al iniciar
async function backupSiCorresponde() {
  const ultimo = listarBackups()[0];
  if (!ultimo || Date.now() - ultimo.fecha.getTime() > 24 * 60 * 60 * 1000) {
    return realizarBackup();
  }
  return { success: true, skipped: true };
}

module.exports = { realizarBackup, backupSiCorresponde, listarBackups, carpetaBackups };
