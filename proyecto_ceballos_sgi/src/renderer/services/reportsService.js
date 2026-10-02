import { call } from './api';

export const reporteDiario     = (fecha)   => call(window.api.reports.diario, fecha);
export const reporteMensual    = (data)    => call(window.api.reports.mensual, data);
export const reporteInventario = ()        => call(window.api.reports.inventario);
export const reporteVentas     = (filtros) => call(window.api.reports.ventas, filtros);
export const exportarDgii      = (data)    => call(window.api.reports.dgii, data);
export const facturaPdf        = (ventaId) => call(window.api.reports.factura, ventaId);
export const cierrePdf         = (cierreId) => call(window.api.reports.cierre, cierreId);
export const abrirDocumento    = (ruta)    => call(window.api.reports.abrir, ruta);
export const listarEmpleados   = ()        => call(window.api.reports.empleados);

// Genera un PDF y lo abre con el visor predeterminado
export async function generarYAbrir(generar) {
  const ruta = await generar();
  await abrirDocumento(ruta);
  return ruta;
}
