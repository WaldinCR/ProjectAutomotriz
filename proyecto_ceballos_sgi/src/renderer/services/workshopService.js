import { call } from './api';

export const crearOrden    = (data) => call(window.api.workshop.crearOrden, data);
export const listarOrdenes = ()     => call(window.api.workshop.listarOrdenes);
export const cambiarEstado = (data) => call(window.api.workshop.cambiarEstado, data);
export const facturarOrden = (data) => call(window.api.workshop.facturarOrden, data);
