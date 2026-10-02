export async function listarUsuarios() {
  return window.api.admin.listarUsuarios();
}
export async function crearUsuario(data) {
  return window.api.admin.crearUsuario(data);
}
export async function consultarAuditLog(filtros = {}) {
  return window.api.admin.auditLog(filtros);
}
