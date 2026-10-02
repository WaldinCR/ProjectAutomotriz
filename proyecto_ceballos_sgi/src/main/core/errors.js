// Errores de negocio con mensajes claros para el usuario (RNF-11)
const { ZodError } = require('zod');

class AppError extends Error {
  constructor(message, code = 'VALIDACION') {
    super(message);
    this.code = code;
  }
}

const NOMBRES_CAMPO = {
  usuario: 'nombre de usuario',
  codigoBarras: 'código de barras',
  codigoInterno: 'código interno',
  numeroFactura: 'número de factura',
};

// Convierte cualquier error en { code, message } apto para mostrar en pantalla
function normalizarError(error) {
  if (error instanceof AppError) {
    return { code: error.code, message: error.message };
  }
  if (error instanceof ZodError) {
    const primero = error.issues[0];
    return { code: 'VALIDACION', message: primero?.message || 'Datos inválidos' };
  }
  if (error?.code === 'P2002') {
    const campos = [].concat(error.meta?.target || []);
    const campo = campos.map(c => NOMBRES_CAMPO[c] || c).join(', ');
    return { code: 'DUPLICADO', message: `Ya existe un registro con ese ${campo || 'valor'}` };
  }
  if (error?.code === 'P2025') {
    return { code: 'NO_ENCONTRADO', message: 'El registro solicitado no existe' };
  }
  console.error('[Error inesperado]', error);
  return { code: 'INTERNO', message: 'Ocurrió un error inesperado. Intente de nuevo o contacte al administrador.' };
}

module.exports = { AppError, normalizarError };
