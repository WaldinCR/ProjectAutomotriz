export async function crearOrden(data) {
  return window.api.workshop.crearOrden(data);
}
export async function listarOrdenes() {
  return window.api.workshop.listarOrdenes();
}
export async function cambiarEstado(data) {
  return window.api.workshop.cambiarEstado(data);
}
export async function facturarOrden(data) {
  return window.api.workshop.facturarOrden(data);
}
