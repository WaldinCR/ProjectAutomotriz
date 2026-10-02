import { call } from './api';

export const resumenTurno    = ()     => call(window.api.cashier.resumen);
export const confirmarCierre = (data) => call(window.api.cashier.confirmarCierre, data);
export const historialCierres = ()    => call(window.api.cashier.historial);
