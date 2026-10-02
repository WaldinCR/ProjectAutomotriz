// Utilidades de fechas y montos.
// Todas las fechas de negocio se interpretan en la hora LOCAL del equipo:
// new Date('2026-05-01') es medianoche UTC, que en República Dominicana
// (UTC-4) corresponde al día anterior.
const { AppError } = require('./errors');

function parsearFechaLocal(fechaStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(fechaStr || ''));
  if (!m) throw new AppError('La fecha debe tener el formato AAAA-MM-DD');
  const fecha = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (fecha.getMonth() !== Number(m[2]) - 1) throw new AppError('La fecha indicada no es válida');
  return fecha;
}

// Rango [inicio, fin) del día local indicado (hoy si no se indica)
function rangoDia(fechaStr) {
  const inicio = fechaStr ? parsearFechaLocal(fechaStr) : new Date();
  inicio.setHours(0, 0, 0, 0);
  const fin = new Date(inicio);
  fin.setDate(fin.getDate() + 1);
  return { inicio, fin };
}

// Rango [inicio, fin) del mes local indicado (mes 1-12)
function rangoMes(mes, anio) {
  const inicio = new Date(anio, mes - 1, 1);
  const fin = new Date(anio, mes, 1);
  return { inicio, fin };
}

function fechaLocalISO(fecha = new Date()) {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Redondeo monetario a 2 decimales (evita 0.1 + 0.2 = 0.30000000000000004)
function dinero(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

module.exports = { parsearFechaLocal, rangoDia, rangoMes, fechaLocalISO, dinero };
