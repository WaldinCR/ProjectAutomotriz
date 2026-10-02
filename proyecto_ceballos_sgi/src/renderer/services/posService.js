import { call } from './api';

export const buscarProducto = (codigo)  => call(window.api.pos.buscarProducto, codigo);
export const calcularVenta  = (data)    => call(window.api.pos.calcular, data);
export const confirmarVenta = (data)    => call(window.api.pos.confirmarVenta, data);
export const anularVenta    = (data)    => call(window.api.pos.anularVenta, data);
export const listarVentas   = (filtros) => call(window.api.pos.listarVentas, filtros);
export const obtenerVenta   = (ventaId) => call(window.api.pos.obtenerVenta, ventaId);
