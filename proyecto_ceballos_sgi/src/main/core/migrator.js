// Migraciones automáticas al iniciar la aplicación.
// En una app de escritorio no se puede pedir al usuario que ejecute
// `prisma migrate deploy`; este módulo aplica las migraciones pendientes de
// prisma/migrations y las registra en _prisma_migrations con el mismo formato
// que Prisma, de modo que `prisma migrate status` sigue funcionando.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const prisma = require('./prisma');

const CARPETA = path.resolve(__dirname, '../../../prisma/migrations');

async function crearTablaControl() {
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "checksum" TEXT NOT NULL,
    "finished_at" DATETIME,
    "migration_name" TEXT NOT NULL,
    "logs" TEXT,
    "rolled_back_at" DATETIME,
    "started_at" DATETIME NOT NULL DEFAULT current_timestamp,
    "applied_steps_count" INTEGER UNSIGNED NOT NULL DEFAULT 0
  )`);
}

async function existeTabla(nombre) {
  const r = await prisma.$queryRawUnsafe(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`, nombre);
  return r.length > 0;
}

// Divide el script en sentencias (las migraciones no usan ';' dentro de textos)
function sentencias(sql) {
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map(s => s.split(/\r?\n/).filter(l => !l.trim().startsWith('--')).join('\n').trim())
    .filter(Boolean);
}

function listarMigraciones(carpeta = CARPETA) {
  if (!fs.existsSync(carpeta)) return [];
  return fs.readdirSync(carpeta)
    .filter(d => fs.existsSync(path.join(carpeta, d, 'migration.sql')))
    .sort()
    .map(nombre => {
      const sql = fs.readFileSync(path.join(carpeta, nombre, 'migration.sql'), 'utf8');
      return { nombre, sql, checksum: crypto.createHash('sha256').update(sql).digest('hex') };
    });
}

async function registrar(m, pasos) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, started_at, applied_steps_count)
     VALUES (?, ?, ?, ?, ?, ?)`,
    crypto.randomUUID(), m.checksum, new Date().toISOString(), m.nombre, new Date().toISOString(), pasos,
  );
}

/**
 * Aplica las migraciones pendientes. `antesDeMigrar` se invoca una sola vez
 * (p. ej. para respaldar la base) si hay algo que aplicar.
 */
async function migrar({ antesDeMigrar, carpeta = CARPETA } = {}) {
  const migraciones = listarMigraciones(carpeta);
  if (!migraciones.length) return { aplicadas: [] };

  const habiaControl = await existeTabla('_prisma_migrations');
  await crearTablaControl();
  const hechas = new Set((await prisma.$queryRawUnsafe(
    `SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`,
  )).map(r => r.migration_name));

  // Base creada antes con `prisma db push`: ya tiene el esquema inicial
  if (!habiaControl && await existeTabla('Usuario') && !hechas.has(migraciones[0].nombre)) {
    await registrar(migraciones[0], 0);
    hechas.add(migraciones[0].nombre);
  }

  const pendientes = migraciones.filter(m => !hechas.has(m.nombre));
  if (!pendientes.length) return { aplicadas: [] };
  if (antesDeMigrar) await antesDeMigrar(pendientes.map(m => m.nombre));

  for (const m of pendientes) {
    const pasos = sentencias(m.sql);
    // Una transacción por migración: o se aplica completa o no se aplica.
    // Dentro de ella, PRAGMA defer_foreign_keys (que Prisma genera) permite
    // recrear tablas referenciadas sin violar llaves foráneas.
    try {
      await prisma.$transaction(async (tx) => {
        for (const s of pasos) await tx.$executeRawUnsafe(s);
      }, { timeout: 120_000 });
    } catch (error) {
      throw new Error(`La migración ${m.nombre} falló y no se aplicó: ${error.message}`);
    }
    await registrar(m, pasos.length);
    console.log(`[Migraciones] Aplicada ${m.nombre}`);
  }
  return { aplicadas: pendientes.map(m => m.nombre) };
}

module.exports = { migrar, sentencias, listarMigraciones };
