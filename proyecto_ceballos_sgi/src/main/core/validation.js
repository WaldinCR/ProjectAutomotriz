// Esquemas de validación (zod) para TODOS los datos que llegan del renderer
// o de la API remota. Ningún servicio debe confiar en datos sin validar.
const { z } = require('zod');
const { ROLES } = require('./roles');

const texto = (campo, max = 120) =>
  z.string({ required_error: `${campo} es requerido`, invalid_type_error: `${campo} es requerido` })
    .trim()
    .min(1, `${campo} es requerido`)
    .max(max, `${campo} no puede exceder ${max} caracteres`);

const textoOpcional = (max = 255) =>
  z.string().trim().max(max, `El texto no puede exceder ${max} caracteres`)
    .optional().nullable()
    // undefined = "no enviado" (no se modifica); '' o null = vaciar el campo
    .transform(v => (v === undefined ? undefined : v || null));

const id = (campo = 'El identificador') =>
  z.coerce.number({ invalid_type_error: `${campo} no es válido` }).int(`${campo} no es válido`).positive(`${campo} no es válido`);

const entero = (campo, min = 0) =>
  z.coerce.number({ invalid_type_error: `${campo} debe ser un número` })
    .int(`${campo} debe ser un número entero`)
    .min(min, `${campo} debe ser mayor o igual a ${min}`)
    .max(1_000_000, `${campo} es demasiado grande`);

const monto = (campo) =>
  z.coerce.number({ invalid_type_error: `${campo} debe ser un número` })
    .finite(`${campo} debe ser un número`)
    .min(0, `${campo} no puede ser negativo`)
    .max(100_000_000, `${campo} es demasiado grande`);

const fechaISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener el formato AAAA-MM-DD');

const METODOS_PAGO = ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'];
const metodoPago = z.enum(METODOS_PAGO, { errorMap: () => ({ message: 'Método de pago no válido' }) });

const password = z.string({ required_error: 'La contraseña es requerida' })
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(72, 'La contraseña no puede exceder 72 caracteres'); // límite de bcrypt

const comprobante = {
  tipoComprobante: z.enum(['B01', 'B02', 'B14', 'B15'], { errorMap: () => ({ message: 'Tipo de comprobante no válido' }) }).optional(),
  clienteNombre: textoOpcional(120),
  clienteRnc: textoOpcional(20),
};

const rol = z.enum(Object.values(ROLES), { errorMap: () => ({ message: 'Rol no válido' }) });

// ── Autenticación ────────────────────────────────
const login = z.object({
  usuario: texto('El usuario', 50),
  password: z.string({ required_error: 'La contraseña es requerida' }).min(1, 'La contraseña es requerida').max(72),
});

// ── Usuarios ─────────────────────────────────────
const crearUsuario = z.object({
  nombre: texto('El nombre', 100),
  usuario: texto('El nombre de usuario', 50)
    .regex(/^[a-zA-Z0-9._-]+$/, 'El usuario solo puede contener letras, números, punto, guion y guion bajo')
    .transform(v => v.toLowerCase()),
  password,
  rol,
});

const editarUsuario = z.object({
  id: id('El usuario'),
  nombre: texto('El nombre', 100).optional(),
  rol: rol.optional(),
  activo: z.boolean().optional(),
});

const restablecerPassword = z.object({ id: id('El usuario'), password });

const cambiarPassword = z.object({
  actual: z.string({ required_error: 'Indique su contraseña actual' }).min(1, 'Indique su contraseña actual').max(72),
  nueva: password,
}).refine(d => d.actual !== d.nueva, { message: 'La nueva contraseña debe ser distinta de la actual' });

const filtrosAudit = z.object({
  usuarioId: id('El usuario').optional().nullable(),
  accion: z.string().trim().max(60).optional().nullable(),
  desde: fechaISO.optional().nullable().or(z.literal('')),
  hasta: fechaISO.optional().nullable().or(z.literal('')),
}).default({});

// ── Inventario ───────────────────────────────────
const productoBase = {
  nombre: texto('El nombre del producto', 120),
  categoria: texto('La categoría', 60),
  codigoBarras: textoOpcional(50),
  precioCompra: monto('El precio de compra'),
  precioVenta: monto('El precio de venta'),
  stockMinimo: entero('El stock mínimo').default(5),
  exentoItbis: z.boolean().default(false),
};

const crearProducto = z.object(productoBase).extend({
  codigoInterno: textoOpcional(50),
  stock: entero('El stock inicial').default(0),
}).refine(p => p.precioVenta >= p.precioCompra, {
  message: 'El precio de venta no puede ser menor que el precio de compra',
});

// En edición NO se permite tocar el stock: solo cambia por entradas/ajustes
const editarProducto = z.object({
  id: id('El producto'),
  nombre: productoBase.nombre.optional(),
  categoria: productoBase.categoria.optional(),
  codigoBarras: productoBase.codigoBarras,
  precioCompra: productoBase.precioCompra.optional(),
  precioVenta: productoBase.precioVenta.optional(),
  stockMinimo: entero('El stock mínimo').optional(),
  exentoItbis: z.boolean().optional(),
  activo: z.boolean().optional(),
});

const entradaInventario = z.object({
  productoId: id('El producto'),
  cantidad: entero('La cantidad', 1),
  motivo: texto('El motivo', 200).default('Entrada de mercancía'),
});

const ajusteInventario = z.object({
  productoId: id('El producto'),
  cantidad: z.coerce.number().int('La cantidad debe ser un número entero')
    .refine(n => n !== 0, 'La cantidad del ajuste no puede ser 0')
    .refine(n => Math.abs(n) <= 1_000_000, 'La cantidad es demasiado grande'),
  motivo: texto('El motivo del ajuste', 200), // RF-22: motivo obligatorio
});

const busqueda = z.string().trim().min(1, 'Ingrese un término de búsqueda').max(100);

// ── POS ──────────────────────────────────────────
// Solo se aceptan productoId y cantidad: precios y totales los calcula el servidor
const itemsVenta = z.array(z.object({
  productoId: id('El producto'),
  cantidad: entero('La cantidad', 1),
  descuento: monto('El descuento').default(0),
}), { required_error: 'El carrito de compras no puede estar vacío' })
  .min(1, 'El carrito de compras no puede estar vacío')
  .max(200, 'Demasiados artículos en una sola venta');

const calcularVenta = z.object({
  items: itemsVenta,
  descuentoTotal: monto('El descuento').default(0),
});

const confirmarVenta = calcularVenta.extend({
  metodoPago,
  ...comprobante,
});

const anularVenta = z.object({
  ventaId: id('La venta'),
  motivoAnulacion: texto('El motivo de anulación', 255),
});

const listarVentas = z.object({ fecha: fechaISO.optional() }).default({});

// ── Taller ───────────────────────────────────────
const ESTADOS_OT = ['PENDIENTE', 'EN_PROCESO', 'COMPLETADA', 'FACTURADA', 'CANCELADA'];

const itemOrden = z.object({
  servicio: textoOpcional(120),
  productoId: id('El repuesto').optional().nullable().or(z.literal('').transform(() => null)),
  cantidad: entero('La cantidad', 1),
  precioUnitario: monto('El precio unitario').optional(),
});

const crearOrden = z.object({
  vehiculo: texto('El vehículo', 100),
  tecnicoId: id('El técnico').optional().nullable(),
  placa: textoOpcional(15).transform(v => (v ? v.toUpperCase() : null)),
  cliente: texto('El nombre del cliente', 100),
  telefono: textoOpcional(20).refine(v => !v || /^[0-9+()\-\s]{7,20}$/.test(v), 'El teléfono no es válido'),
  descripcion: textoOpcional(500),
  items: z.array(itemOrden, { required_error: 'Debe agregar al menos un servicio o repuesto' })
    .min(1, 'Debe agregar al menos un servicio o repuesto')
    .max(100, 'Demasiadas líneas en la orden'),
});

const cambiarEstado = z.object({
  ordenId: id('La orden'),
  estado: z.enum(ESTADOS_OT, { errorMap: () => ({ message: 'Estado de orden no válido' }) }),
  motivo: textoOpcional(255),
});

const facturarOrden = z.object({
  ordenId: id('La orden'),
  metodoPago,
  ...comprobante,
});

const asignarTecnico = z.object({
  ordenId: id('La orden'),
  tecnicoId: id('El técnico').nullable(),
});

const agregarItemOrden = z.object({ ordenId: id('La orden'), item: itemOrden });
const quitarItemOrden = z.object({ ordenId: id('La orden'), detalleId: id('La línea') });

const filtrosOrdenes = z.object({
  estado: z.enum(ESTADOS_OT).optional().or(z.literal('').transform(() => undefined)),
  tecnicoId: id('El técnico').optional().nullable().or(z.literal('').transform(() => undefined)),
  desde: fechaISO.optional().or(z.literal('').transform(() => undefined)),
  hasta: fechaISO.optional().or(z.literal('').transform(() => undefined)),
}).default({});

// ── Caja ─────────────────────────────────────────
const confirmarCierre = z.object({
  efectivoContado: monto('El efectivo contado'),
  observaciones: textoOpcional(500),
});

// ── Reportes ─────────────────────────────────────
const reporteDiario = fechaISO;
const reporteVentas = z.object({
  desde: fechaISO,
  hasta: fechaISO,
  usuarioId: id('El empleado').optional().nullable().or(z.literal('').transform(() => undefined)),
  productoId: id('El producto').optional().nullable().or(z.literal('').transform(() => undefined)),
}).refine(f => f.desde <= f.hasta, { message: 'La fecha inicial no puede ser posterior a la final' });

const reporteMensual = z.object({
  mes: z.coerce.number().int().min(1, 'El mes debe estar entre 1 y 12').max(12, 'El mes debe estar entre 1 y 12'),
  anio: z.coerce.number().int().min(2000, 'Año no válido').max(2100, 'Año no válido'),
});

// ── Configuración ────────────────────────────────
const actualizarConfig = z.object({
  nombreEmpresa: texto('El nombre de la empresa', 100).optional(),
  eslogan: textoOpcional(120),
  rnc: textoOpcional(20),
  direccion: textoOpcional(200),
  telefono: textoOpcional(30),
  email: z.string().trim().email('Correo electrónico no válido').max(100).optional().nullable().or(z.literal('').transform(() => null)),
  tasaItbis: z.coerce.number().min(0, 'Tasa no válida').max(0.5, 'Tasa no válida').optional(),
  preciosIncluyenItbis: z.boolean().optional(),
  emitirNcf: z.boolean().optional(),
  impresoraTipo: z.enum(['NINGUNA', 'RED', 'COMPARTIDA'], { errorMap: () => ({ message: 'Tipo de impresora no válido' }) }).optional(),
  impresoraDestino: textoOpcional(200),
  impresoraAncho: z.coerce.number().int().min(24, 'Ancho no válido').max(64, 'Ancho no válido').optional(),
  imprimirAutomatico: z.boolean().optional(),
  piePagina: textoOpcional(200),
});

const guardarSecuencia = z.object({
  tipo: z.enum(['B01', 'B02', 'B14', 'B15'], { errorMap: () => ({ message: 'Tipo de comprobante no válido' }) }),
  siguiente: entero('El número inicial', 1),
  hasta: entero('El número final', 1),
  vencimiento: fechaISO.optional().nullable().or(z.literal('').transform(() => null)),
  activo: z.boolean().default(true),
}).refine(s => s.hasta >= s.siguiente, { message: 'El número final debe ser mayor o igual al inicial' })
  .refine(s => s.hasta <= 99_999_999, { message: 'El NCF admite como máximo 8 dígitos de secuencia' });

module.exports = {
  comprobante, actualizarConfig, guardarSecuencia, calcularVenta,
  asignarTecnico, agregarItemOrden, quitarItemOrden, filtrosOrdenes, reporteVentas,
  METODOS_PAGO, ESTADOS_OT,
  login, crearUsuario, editarUsuario, restablecerPassword, cambiarPassword, filtrosAudit,
  crearProducto, editarProducto, entradaInventario, ajusteInventario, busqueda,
  confirmarVenta, anularVenta, listarVentas,
  crearOrden, cambiarEstado, facturarOrden,
  confirmarCierre, reporteDiario, reporteMensual,
  id,
};
