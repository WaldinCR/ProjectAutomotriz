// Carga de variables de entorno desde .env
// Debe ejecutarse ANTES de requerir cualquier servicio: varios módulos leen
// process.env al momento de cargarse (Prisma, JWT, puerto del servidor).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT_DIR = path.resolve(__dirname, '../../..');
const SECRETO_INSEGURO = 'cambia_esto_por_una_clave_secreta_muy_larga_123';

function cargarEnv(envPath = path.join(ROOT_DIR, '.env')) {
  if (fs.existsSync(envPath)) {
    const contenido = fs.readFileSync(envPath, 'utf8');
    for (const linea of contenido.split(/\r?\n/)) {
      const limpia = linea.trim();
      if (!limpia || limpia.startsWith('#')) continue;
      const idx = limpia.indexOf('=');
      if (idx === -1) continue;
      const clave = limpia.slice(0, idx).trim();
      const valor = limpia.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      // Las variables ya definidas en el sistema tienen prioridad
      if (process.env[clave] === undefined) process.env[clave] = valor;
    }
  }

  // Sin un secreto real, se genera uno aleatorio por ejecución: los tokens
  // remotos dejan de ser válidos al reiniciar, pero nunca se firman con una
  // clave conocida públicamente.
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === SECRETO_INSEGURO || process.env.JWT_SECRET.length < 32) {
    console.warn('[Env] JWT_SECRET ausente o inseguro; se usará una clave aleatoria temporal.');
    process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
  }
}

module.exports = { cargarEnv, ROOT_DIR };
