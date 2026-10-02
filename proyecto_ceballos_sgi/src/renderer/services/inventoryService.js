import { call } from './api';

export const listarProductos  = (opciones) => call(window.api.inventory.listarProductos, opciones);
export const buscarProductos  = (termino)  => call(window.api.inventory.buscar, termino);
export const productosStockBajo = ()       => call(window.api.inventory.stockBajo);
export const crearProducto    = (data)     => call(window.api.inventory.crearProducto, data);
export const editarProducto   = (data)     => call(window.api.inventory.editarProducto, data);
export const registrarEntrada = (data)     => call(window.api.inventory.registrarEntrada, data);
export const registrarAjuste  = (data)     => call(window.api.inventory.registrarAjuste, data);
export const movimientos      = (productoId) => call(window.api.inventory.movimientos, productoId);
