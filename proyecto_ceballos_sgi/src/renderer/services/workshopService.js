import { call } from './api';

export const crearOrden    = (data)    => call(window.api.workshop.crearOrden, data);
export const listarOrdenes = (filtros) => call(window.api.workshop.listarOrdenes, filtros);
export const listarTecnicos = ()       => call(window.api.workshop.tecnicos);
export const asignarTecnico = (data)   => call(window.api.workshop.asignar, data);
export const agregarItem   = (data)    => call(window.api.workshop.agregarItem, data);
export const quitarItem    = (data)    => call(window.api.workshop.quitarItem, data);
export const cambiarEstado = (data)    => call(window.api.workshop.cambiarEstado, data);
export const facturarOrden = (data)    => call(window.api.workshop.facturarOrden, data);
