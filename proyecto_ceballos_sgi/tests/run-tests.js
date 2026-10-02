// Ejecuta las pruebas del backend contra una base SQLite temporal,
// sin tocar la base real de la aplicación.
const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sgi-test-'));
const env = {
  ...process.env,
  DATABASE_URL: `file:${path.join(tmp, 'test.db').split(path.sep).join('/')}`,
  JWT_SECRET: 'x'.repeat(64),
  REPORTS_DIR: path.join(tmp, 'reportes'),
  BACKUP_DIR: path.join(tmp, 'backups'),
};

execSync('npx prisma db push --skip-generate --accept-data-loss', {
  cwd: path.join(__dirname, '..'), env, stdio: 'ignore',
});

const archivos = fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js')).map(f => path.join(__dirname, f));
const r = spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...archivos], { env, stdio: 'inherit' });

fs.rmSync(tmp, { recursive: true, force: true });
process.exit(r.status ?? 1);
