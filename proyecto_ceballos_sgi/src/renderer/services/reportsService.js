import { call } from './api';

export const reporteDiario     = (fecha) => call(window.api.reports.diario, fecha);
export const reporteMensual    = (data)  => call(window.api.reports.mensual, data);
export const reporteInventario = ()      => call(window.api.reports.inventario);
export const abrirReporte      = (ruta)  => call(window.api.reports.abrir, ruta);
