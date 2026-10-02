// Formato común de montos y fechas para toda la interfaz
export const rd = (n) =>
  `RD$ ${Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const fechaHora = (f) => (f ? new Date(f).toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'short' }) : '—');
export const fecha = (f) => (f ? new Date(f).toLocaleDateString('es-DO') : '—');

// AAAA-MM-DD en hora local (toISOString usa UTC y de noche devuelve el día siguiente)
export function hoyISO(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
