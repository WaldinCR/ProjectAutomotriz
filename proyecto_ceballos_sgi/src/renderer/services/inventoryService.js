export async function listarProductos() {
  return window.api.inventory.listarProductos();
}
export async function crearProducto(data) {
  return window.api.inventory.crearProducto(data);
}
export async function editarProducto(data) {
  return window.api.inventory.editarProducto(data);
}
export async function registrarEntrada(data) {
  return window.api.inventory.registrarEntrada(data);
}
