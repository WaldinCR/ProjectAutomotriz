export async function reporteDiario(fecha) {
  return window.api.reports.diario(fecha);
}
export async function reporteMensual(data) {
  return window.api.reports.mensual(data);
}
