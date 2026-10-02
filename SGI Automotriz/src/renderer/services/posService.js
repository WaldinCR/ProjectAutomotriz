export async function buscarProducto(codigo) {
  return window.api.pos.buscarProducto(codigo);
}
export async function confirmarVenta(data) {
  return window.api.pos.confirmarVenta(data);
}
export async function anularVenta(data) {
  return window.api.pos.anularVenta(data);
}
