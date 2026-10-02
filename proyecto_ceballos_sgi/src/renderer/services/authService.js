import { call } from './api';

export const login  = (usuario, password) => call(window.api.auth.login, { usuario, password });
export const logout = () => call(window.api.auth.logout);
export const sesion = () => call(window.api.auth.sesion);
export const cambiarPassword = (actual, nueva) => call(window.api.auth.cambiarPassword, { actual, nueva });
