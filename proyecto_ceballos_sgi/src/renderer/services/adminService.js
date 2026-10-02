import { call } from './api';

export const listarUsuarios      = ()        => call(window.api.admin.listarUsuarios);
export const crearUsuario        = (data)    => call(window.api.admin.crearUsuario, data);
export const editarUsuario       = (data)    => call(window.api.admin.editarUsuario, data);
export const restablecerPassword = (data)    => call(window.api.admin.restablecerPassword, data);
export const consultarAuditLog   = (filtros) => call(window.api.admin.auditLog, filtros);
export const realizarBackup      = ()        => call(window.api.admin.backup);
