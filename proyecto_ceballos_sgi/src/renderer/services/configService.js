import { call } from './api';

export const obtenerConfig     = ()      => call(window.api.config.obtener);
export const actualizarConfig  = (data)  => call(window.api.config.actualizar, data);
export const listarSecuencias  = ()      => call(window.api.config.secuencias);
export const guardarSecuencia  = (data)  => call(window.api.config.guardarSecuencia, data);
export const imprimirPrueba    = ()      => call(window.api.config.imprimirPrueba);
export const imprimirTicket    = (ventaId) => call(window.api.config.imprimirVenta, ventaId);
