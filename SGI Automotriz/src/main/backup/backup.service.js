// Servicio de Backup de SQLite
const fs = require('fs');
const path = require('path');

function realizarBackup() {
  try {
    const projectRoot = process.cwd();
    let dbPath = path.join(projectRoot, 'prisma', 'sgi_database.db');
    
    // Si no existe en prisma/sgi_database.db, buscar en prisma/prisma/sgi_database.db
    if (!fs.existsSync(dbPath)) {
      dbPath = path.join(projectRoot, 'prisma', 'prisma', 'sgi_database.db');
    }
    
    const backupDir = path.join(projectRoot, 'backups');

    // 1. Crear carpeta backups si no existe
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // 2. Generar nombre de archivo con marca de tiempo local
    const ahora = new Date();
    const anio = ahora.getFullYear();
    const mes = String(ahora.getMonth() + 1).padStart(2, '0');
    const dia = String(ahora.getDate()).padStart(2, '0');
    const horas = String(ahora.getHours()).padStart(2, '0');
    const mins = String(ahora.getMinutes()).padStart(2, '0');
    const secs = String(ahora.getSeconds()).padStart(2, '0');
    const timestamp = `${anio}${mes}${dia}_${horas}${mins}${secs}`;

    const backupFile = `backup_${timestamp}.db`;
    const destPath = path.join(backupDir, backupFile);

    // 3. Copiar archivo de base de datos
    if (fs.existsSync(dbPath)) {
      fs.copyFileSync(dbPath, destPath);
      console.log(`[Backup] Base de datos respaldada con éxito en: ${destPath}`);
    } else {
      console.warn(`[Backup] No se pudo encontrar el archivo origen en ${dbPath}`);
      return { success: false, error: 'Database file not found' };
    }

    // 4. Depurar copias con antigüedad mayor a 30 días
    const archivos = fs.readdirSync(backupDir);
    const limite30Dias = 30 * 24 * 60 * 60 * 1000; // 30 días en ms

    archivos.forEach(archivo => {
      if (archivo.startsWith('backup_') && archivo.endsWith('.db')) {
        const filePath = path.join(backupDir, archivo);
        const stats = fs.statSync(filePath);
        const antiguedad = ahora.getTime() - stats.mtime.getTime();

        if (antiguedad > limite30Dias) {
          fs.unlinkSync(filePath);
          console.log(`[Backup] Copia obsoleta eliminada: ${archivo}`);
        }
      }
    });

    return { success: true, file: backupFile };
  } catch (error) {
    console.error('[Backup] Error durante el proceso de copia de seguridad:', error);
    return { success: false, error: error.message };
  }
}

module.exports = { realizarBackup };
