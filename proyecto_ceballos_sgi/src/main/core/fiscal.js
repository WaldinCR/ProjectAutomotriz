// Reglas fiscales de República Dominicana: ITBIS y Números de Comprobante Fiscal (NCF)
const { AppError } = require('./errors');
const { dinero } = require('./dates');

const TIPOS_NCF = {
  B01: { nombre: 'Crédito Fiscal', requiereRnc: true },
  B02: { nombre: 'Consumo', requiereRnc: false },
  B14: { nombre: 'Régimen Especial', requiereRnc: true },
  B15: { nombre: 'Gubernamental', requiereRnc: true },
};

/**
 * Calcula ITBIS y totales de una venta.
 * lineas: [{ importe, exento }]  (importe = precio × cantidad − descuento de línea)
 * El descuento global se reparte proporcionalmente entre las líneas antes del impuesto.
 * Si los precios incluyen ITBIS, el impuesto se extrae; si no, se suma.
 */
function calcularVenta(lineas, descuentoTotal, { tasaItbis, preciosIncluyenItbis }) {
  const bruto = dinero(lineas.reduce((s, l) => s + l.importe, 0));
  if (descuentoTotal > bruto) throw new AppError('El descuento no puede ser mayor que el total de la venta');

  let descuentoRestante = dinero(descuentoTotal);
  const detalle = lineas.map((l, i) => {
    // La última línea absorbe el redondeo para que la suma cuadre exacta
    const desc = i === lineas.length - 1
      ? descuentoRestante
      : dinero(bruto > 0 ? (descuentoTotal * l.importe) / bruto : 0);
    descuentoRestante = dinero(descuentoRestante - desc);
    const neto = dinero(l.importe - desc);
    const tasa = l.exento ? 0 : tasaItbis;

    const base = preciosIncluyenItbis ? dinero(neto / (1 + tasa)) : neto;
    const itbis = preciosIncluyenItbis ? dinero(neto - base) : dinero(base * tasa);
    return { base, itbis };
  });

  const subtotal = dinero(detalle.reduce((s, d) => s + d.base, 0));
  const itbis = dinero(detalle.reduce((s, d) => s + d.itbis, 0));
  return {
    lineas: detalle,
    bruto,
    descuento: dinero(descuentoTotal),
    subtotal,
    itbis,
    total: dinero(subtotal + itbis),
  };
}

// RNC (9 dígitos, con dígito verificador DGII) o cédula (11 dígitos)
function normalizarRnc(valor) {
  const limpio = String(valor || '').replace(/[\s-]/g, '');
  if (!/^\d{9}$|^\d{11}$/.test(limpio)) {
    throw new AppError('El RNC debe tener 9 dígitos o la cédula 11 dígitos');
  }
  if (limpio.length === 9) {
    const pesos = [7, 9, 8, 6, 5, 4, 3, 2];
    const suma = pesos.reduce((s, p, i) => s + p * Number(limpio[i]), 0);
    const resto = suma % 11;
    const verificador = resto === 0 ? 2 : resto === 1 ? 1 : 11 - resto;
    if (verificador !== Number(limpio[8])) throw new AppError('El RNC no es válido (dígito verificador incorrecto)');
  }
  return limpio;
}

// Valida los datos del cliente según el tipo de comprobante
function validarComprobante({ tipoComprobante, clienteNombre, clienteRnc }) {
  const tipo = TIPOS_NCF[tipoComprobante];
  if (!tipo) throw new AppError('Tipo de comprobante no válido');
  if (tipo.requiereRnc) {
    if (!clienteRnc) throw new AppError(`El comprobante de ${tipo.nombre} requiere el RNC o cédula del cliente`);
    if (!clienteNombre) throw new AppError(`El comprobante de ${tipo.nombre} requiere el nombre o razón social del cliente`);
  }
  return {
    tipoComprobante,
    clienteNombre: clienteNombre || null,
    clienteRnc: clienteRnc ? normalizarRnc(clienteRnc) : null,
  };
}

const formatearNcf = (tipo, numero) => `${tipo}${String(numero).padStart(8, '0')}`;

// Toma el siguiente NCF de la secuencia de forma atómica (dentro de la transacción)
async function tomarNcf(tx, tipo) {
  const sec = await tx.secuenciaNcf.findUnique({ where: { tipo } });
  const nombre = TIPOS_NCF[tipo]?.nombre || tipo;
  if (!sec || !sec.activo) {
    throw new AppError(`No hay una secuencia NCF activa para ${nombre} (${tipo}). Configúrela en Admin › Empresa.`);
  }
  if (sec.vencimiento && sec.vencimiento < new Date()) {
    throw new AppError(`La secuencia NCF ${tipo} venció el ${sec.vencimiento.toLocaleDateString('es-DO')}. Solicite una nueva a la DGII.`);
  }
  if (sec.siguiente > sec.hasta) {
    throw new AppError(`Se agotó la secuencia NCF ${tipo}. Solicite una nueva a la DGII.`);
  }
  // Actualización condicional: si otra operación tomó el número, no se duplica
  const r = await tx.secuenciaNcf.updateMany({
    where: { id: sec.id, siguiente: sec.siguiente },
    data: { siguiente: { increment: 1 } },
  });
  if (r.count !== 1) throw new AppError('No se pudo reservar el NCF. Intente de nuevo.');
  return formatearNcf(tipo, sec.siguiente);
}

module.exports = { TIPOS_NCF, calcularVenta, normalizarRnc, validarComprobante, tomarNcf, formatearNcf };
