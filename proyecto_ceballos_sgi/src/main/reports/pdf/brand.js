// Kit de diseño PDF con la identidad de Repuestos Ceballos.
// Misma paleta y tipografía (Work Sans) que la aplicación (src/renderer/index.css).
// Todas las piezas (membrete, tarjetas KPI, tablas, gráficos, firmas, pie con
// paginación) se dibujan aquí para que cada documento se vea igual.
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const ASSETS = path.join(__dirname, '../../assets');
const LOGO = path.join(ASSETS, 'logo.png');

const C = {
  navy: '#062b3a',
  navy2: '#0a3b4e',
  blue: '#0677dd',
  orange: '#f58220',
  mist: '#f4f7f9',
  zebra: '#f8fafc',
  line: '#dce5ea',
  ink: '#17313d',
  muted: '#70818a',
  green: '#16794c',
  greenBg: '#e6f7ef',
  red: '#c0262d',
  redBg: '#fdecec',
  amber: '#b45309',
  amberBg: '#fff4e5',
  white: '#ffffff',
};

const PAGINA = { ancho: 612, alto: 792, margen: 40 };
const ANCHO_UTIL = PAGINA.ancho - PAGINA.margen * 2;
const LIMITE_INFERIOR = PAGINA.alto - 70; // espacio reservado para el pie

const F = { regular: 'Helvetica', medium: 'Helvetica', semibold: 'Helvetica-Bold', bold: 'Helvetica-Bold' };

function registrarFuentes(doc) {
  const fuentes = { regular: 'Regular', medium: 'Medium', semibold: 'SemiBold', bold: 'Bold' };
  for (const [clave, peso] of Object.entries(fuentes)) {
    const archivo = path.join(ASSETS, 'fonts', `WorkSans-${peso}.ttf`);
    if (fs.existsSync(archivo)) {
      doc.registerFont(`WS-${peso}`, archivo);
      F[clave] = `WS-${peso}`;
    }
  }
}

const rd = (n) => `RD$ ${Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = (n) => Number(n || 0).toLocaleString('es-DO');
const pct = (n) => `${(Number(n || 0) * 100).toLocaleString('es-DO', { maximumFractionDigits: 1 })} %`;

// Recorta un texto para que quepa en el ancho indicado
function ajustar(doc, texto, ancho, opciones = {}) {
  let t = String(texto ?? '');
  if (doc.widthOfString(t, opciones) <= ancho) return t;
  while (t.length > 1 && doc.widthOfString(`${t}…`, opciones) > ancho) t = t.slice(0, -1);
  return `${t}…`;
}

/**
 * Crea un documento con membrete.
 * opciones: { archivo, empresa, tipo, titulo, subtitulo, meta: [[etiqueta, valor]], horizontal }
 */
function crearDocumento({ archivo, empresa, tipo, titulo, subtitulo, meta = [] }) {
  fs.mkdirSync(path.dirname(archivo), { recursive: true });
  const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: PAGINA.margen, bottom: PAGINA.margen, left: PAGINA.margen, right: PAGINA.margen },
    bufferPages: true,
    info: { Title: `${titulo} — ${empresa.nombreEmpresa}`, Author: empresa.nombreEmpresa, Creator: 'SGI Automotriz' },
  });
  registrarFuentes(doc);

  const stream = fs.createWriteStream(archivo);
  const terminado = new Promise((resolve, reject) => {
    stream.on('finish', () => resolve(archivo));
    stream.on('error', reject);
    doc.on('error', reject);
  });
  doc.pipe(stream);

  const ctx = { doc, empresa, tipo, titulo, subtitulo };
  membrete(ctx, true);
  if (meta.length) franjaMeta(ctx, meta);
  // Las páginas siguientes llevan un membrete compacto
  doc.on('pageAdded', () => membrete(ctx, false));

  ctx.finalizar = (opciones = {}) => {
    pieDePagina(ctx, opciones);
    doc.end();
    return terminado;
  };
  return ctx;
}

function membrete({ doc, empresa, tipo, titulo, subtitulo }, completo) {
  const m = PAGINA.margen;
  const altoLogo = completo ? 54 : 30;
  const y0 = m - 6;

  if (fs.existsSync(LOGO)) doc.image(LOGO, m, y0, { height: altoLogo });
  const xTexto = m + altoLogo * (225 / 165) + 10;

  doc.font(F.bold).fontSize(completo ? 15 : 11).fillColor(C.navy)
    .text(empresa.nombreEmpresa.toUpperCase(), xTexto, y0 + (completo ? 4 : 2), { lineBreak: false, characterSpacing: 0.6 });
  if (completo) {
    doc.font(F.medium).fontSize(8.5).fillColor(C.orange)
      .text((empresa.eslogan || '').toUpperCase(), xTexto, y0 + 23, { lineBreak: false, characterSpacing: 1.2 });
    const contacto = [
      empresa.rnc && `RNC ${empresa.rnc}`,
      empresa.telefono && `Tel. ${empresa.telefono}`,
      empresa.email,
    ].filter(Boolean).join('   ·   ');
    doc.font(F.regular).fontSize(7.5).fillColor(C.muted);
    if (empresa.direccion) doc.text(empresa.direccion, xTexto, y0 + 36, { width: 260, lineBreak: false });
    if (contacto) doc.text(contacto, xTexto, y0 + 46, { width: 270, lineBreak: false });
  }

  // Bloque del documento (derecha)
  const anchoDer = 220;
  const xDer = PAGINA.ancho - m - anchoDer;
  doc.font(F.semibold).fontSize(7.5).fillColor(C.orange)
    .text(tipo.toUpperCase(), xDer, y0 + (completo ? 4 : 2), { width: anchoDer, align: 'right', characterSpacing: 1.5 });
  doc.font(F.bold).fontSize(completo ? 15 : 10.5).fillColor(C.navy)
    .text(titulo, xDer, y0 + (completo ? 15 : 12), { width: anchoDer, align: 'right', lineBreak: false });
  if (completo && subtitulo) {
    doc.font(F.regular).fontSize(8.5).fillColor(C.muted)
      .text(subtitulo, xDer, y0 + 35, { width: anchoDer, align: 'right' });
  }

  // Doble filete: naranja grueso + navy fino
  const yLinea = y0 + altoLogo + 8;
  doc.rect(m, yLinea, ANCHO_UTIL, 3).fill(C.orange);
  doc.rect(m, yLinea + 3, ANCHO_UTIL, 0.8).fill(C.navy);
  doc.x = m;
  doc.y = yLinea + 16;
}

function franjaMeta({ doc }, meta) {
  const m = PAGINA.margen;
  const y = doc.y;
  const alto = 34;
  doc.roundedRect(m, y, ANCHO_UTIL, alto, 6).fill(C.mist);
  const ancho = ANCHO_UTIL / meta.length;
  meta.forEach(([etiqueta, valor], i) => {
    const x = m + i * ancho + 12;
    if (i > 0) doc.rect(m + i * ancho, y + 8, 0.6, alto - 16).fill(C.line);
    doc.font(F.semibold).fontSize(6.5).fillColor(C.muted).text(etiqueta.toUpperCase(), x, y + 7, { width: ancho - 20, characterSpacing: 0.8, lineBreak: false });
    doc.font(F.semibold).fontSize(9).fillColor(C.ink).text(ajustar(doc, valor, ancho - 20), x, y + 18, { lineBreak: false });
  });
  doc.x = m;
  doc.y = y + alto + 14;
}

// Garantiza espacio vertical; si no hay, salta de página
function espacio(ctx, alto) {
  if (ctx.doc.y + alto > LIMITE_INFERIOR) ctx.doc.addPage();
}

function seccion(ctx, texto, nota) {
  const { doc } = ctx;
  espacio(ctx, 50);
  const m = PAGINA.margen;
  const y = doc.y + 4;
  doc.rect(m, y + 2, 7, 7).fill(C.orange);
  doc.font(F.bold).fontSize(10).fillColor(C.navy).text(texto.toUpperCase(), m + 13, y, { characterSpacing: 0.9, lineBreak: false });
  if (nota) {
    doc.font(F.regular).fontSize(7.5).fillColor(C.muted).text(nota, m, y + 1.5, { width: ANCHO_UTIL, align: 'right', lineBreak: false });
  }
  doc.rect(m, y + 15, ANCHO_UTIL, 0.6).fill(C.line);
  doc.x = m;
  doc.y = y + 24;
}

/** Fila de tarjetas KPI: [{ etiqueta, valor, nota, color }] */
function kpis(ctx, tarjetas) {
  const { doc } = ctx;
  espacio(ctx, 70);
  const m = PAGINA.margen;
  const sep = 10;
  const ancho = (ANCHO_UTIL - sep * (tarjetas.length - 1)) / tarjetas.length;
  const alto = 58;
  const y = doc.y;
  tarjetas.forEach((t, i) => {
    const x = m + i * (ancho + sep);
    doc.roundedRect(x, y, ancho, alto, 7).lineWidth(0.8).fillAndStroke(C.white, C.line);
    doc.save().roundedRect(x, y, 4, alto, 2).fill(t.color || C.blue).restore();
    doc.font(F.semibold).fontSize(6.8).fillColor(C.muted);
    doc.text(ajustar(doc, t.etiqueta.toUpperCase(), ancho - 24, { characterSpacing: 0.7 }), x + 13, y + 10, { characterSpacing: 0.7, lineBreak: false });
    // El valor se reduce hasta caber completo (nunca se recorta una cifra)
    let tam = 15;
    doc.font(F.bold).fontSize(tam);
    while (tam > 9 && doc.widthOfString(t.valor) > ancho - 22) doc.fontSize((tam -= 0.5));
    doc.fillColor(C.navy).text(t.valor, x + 13, y + 22 + (15 - tam) / 2, { lineBreak: false });
    if (t.nota) {
      doc.font(F.regular).fontSize(7).fillColor(t.notaColor || C.muted)
        .text(ajustar(doc, t.nota, ancho - 20), x + 13, y + 42, { lineBreak: false });
    }
  });
  doc.x = m;
  doc.y = y + alto + 14;
}

/**
 * Tabla con encabezado navy, filas cebra y fila de totales.
 * columnas: [{ titulo, ancho (peso relativo) | px (puntos fijos), align, fuente }]
 * filas: arrays de celdas; una celda puede ser { texto, color, negrita, pill: { bg, color } }
 */
function tabla(ctx, columnas, filas, { vacio = 'Sin registros', totales, altoFila = 18 } = {}) {
  const { doc } = ctx;
  const m = PAGINA.margen;
  // `px` = ancho fijo en puntos; `ancho` = peso relativo del espacio restante
  const fijos = columnas.reduce((s, c) => s + (c.px || 0), 0);
  const pesos = columnas.reduce((s, c) => s + (c.px ? 0 : c.ancho || 1), 0);
  const anchos = columnas.map(c => c.px || ((ANCHO_UTIL - fijos) * (c.ancho || 1)) / pesos);
  const pad = 6;

  const encabezado = () => {
    const y = doc.y;
    doc.rect(m, y, ANCHO_UTIL, 20).fill(C.navy);
    let x = m;
    columnas.forEach((c, i) => {
      doc.font(F.semibold).fontSize(7).fillColor(C.white);
      const titulo = ajustar(doc, c.titulo.toUpperCase(), anchos[i] - pad * 2 - 1, { characterSpacing: 0.5 });
      doc.text(titulo, x + pad, y + 7, { width: anchos[i] - pad * 2 + 2, align: c.align || 'left', characterSpacing: 0.5, lineBreak: false });
      x += anchos[i];
    });
    doc.y = y + 20;
  };

  const dibujarFila = (fila, { fondo, negrita, bordeSuperior } = {}) => {
    const y = doc.y;
    if (fondo) doc.rect(m, y, ANCHO_UTIL, altoFila).fill(fondo);
    if (bordeSuperior) doc.rect(m, y, ANCHO_UTIL, 1.2).fill(C.navy);
    let x = m;
    fila.forEach((celda, i) => {
      const c = typeof celda === 'object' && celda !== null ? celda : { texto: celda };
      const col = columnas[i];
      const ancho = anchos[i] - pad * 2;
      if (c.pill) doc.font(F.semibold).fontSize(6.8);
      else doc.font(c.negrita || negrita ? F.semibold : col.fuente === 'mono' ? F.medium : F.regular).fontSize(7.8);
      // En columnas numéricas (alineadas a la derecha) se reduce la letra antes de recortar una cifra
      if (!c.pill && col.align === 'right') {
        let tam = 7.8;
        while (tam > 6.4 && doc.widthOfString(String(c.texto ?? '')) > ancho) doc.fontSize((tam -= 0.2));
      }
      const texto = ajustar(doc, c.texto, ancho - (c.pill ? 12 : 0));
      if (c.pill) {
        const w = doc.widthOfString(texto) + 12;
        const xPill = col.align === 'right' ? x + anchos[i] - pad - w : col.align === 'center' ? x + (anchos[i] - w) / 2 : x + pad;
        doc.roundedRect(xPill, y + 3.5, w, altoFila - 7, (altoFila - 7) / 2).fill(c.pill.bg);
        doc.fillColor(c.pill.color).text(texto, xPill, y + 6.2, { width: w, align: 'center', lineBreak: false });
      } else {
        doc.fillColor(c.color || C.ink).text(texto, x + pad, y + (altoFila - 7.8) / 2, { width: ancho, align: col.align || 'left', lineBreak: false });
      }
      x += anchos[i];
    });
    doc.y = y + altoFila;
  };

  espacio(ctx, 20 + altoFila * 2);
  encabezado();
  if (filas.length === 0) {
    doc.rect(m, doc.y, ANCHO_UTIL, 30).fill(C.zebra);
    doc.font(F.regular).fontSize(8).fillColor(C.muted).text(vacio, m, doc.y + 11, { width: ANCHO_UTIL, align: 'center', lineBreak: false });
    doc.y += 30;
  }
  filas.forEach((fila, i) => {
    if (doc.y + altoFila > LIMITE_INFERIOR) {
      doc.addPage();
      encabezado();
    }
    dibujarFila(fila, { fondo: i % 2 === 1 ? C.zebra : null });
  });
  if (totales) {
    if (doc.y + altoFila > LIMITE_INFERIOR) doc.addPage();
    dibujarFila(totales, { fondo: C.mist, negrita: true, bordeSuperior: true });
  }
  doc.rect(m, doc.y, ANCHO_UTIL, 0.6).fill(C.line);
  doc.x = m;
  doc.y += 14;
}

/** Barras horizontales con valor y porcentaje: [{ etiqueta, valor, color }] */
function barrasHorizontales(ctx, datos, { formato = rd, ancho = ANCHO_UTIL } = {}) {
  const { doc } = ctx;
  const m = PAGINA.margen;
  const total = datos.reduce((s, d) => s + d.valor, 0);
  const max = Math.max(...datos.map(d => d.valor), 1);
  const etiquetaW = 105;
  const valorW = 130;
  const barraW = ancho - etiquetaW - valorW;
  espacio(ctx, datos.length * 20 + 10);
  for (const d of datos) {
    const y = doc.y;
    doc.font(F.medium).fontSize(8).fillColor(C.ink).text(ajustar(doc, d.etiqueta, etiquetaW - 8), m, y + 2, { lineBreak: false });
    doc.roundedRect(m + etiquetaW, y + 1, barraW, 10, 5).fill(C.mist);
    const w = Math.max((d.valor / max) * barraW, d.valor > 0 ? 6 : 0);
    if (w > 0) doc.roundedRect(m + etiquetaW, y + 1, w, 10, 5).fill(d.color || C.blue);
    const porcentaje = total > 0 ? ` · ${pct(d.valor / total)}` : '';
    doc.font(F.semibold).fontSize(8).fillColor(C.navy)
      .text(`${formato(d.valor)}${porcentaje}`, m + etiquetaW + barraW, y + 2, { width: valorW, align: 'right', lineBreak: false });
    doc.y = y + 19;
  }
  doc.x = m;
  doc.y += 8;
}

/** Columnas verticales (p. ej. ventas por día): [{ etiqueta, valor }] */
function columnasVerticales(ctx, datos, { alto = 120, formato = rd } = {}) {
  const { doc } = ctx;
  const m = PAGINA.margen;
  espacio(ctx, alto + 40);
  const y0 = doc.y;
  const ejeX = m + 46;
  const anchoGraf = ANCHO_UTIL - 46;
  const max = Math.max(...datos.map(d => d.valor), 1);
  // Escala "redonda" para el eje
  const paso = Math.pow(10, Math.floor(Math.log10(max)));
  const tope = Math.ceil(max / paso) * paso;

  for (let i = 0; i <= 4; i++) {
    const y = y0 + alto - (alto * i) / 4;
    doc.rect(ejeX, y, anchoGraf, 0.5).fill(i === 0 ? C.muted : C.line);
    const v = (tope * i) / 4;
    doc.font(F.regular).fontSize(6.5).fillColor(C.muted)
      .text(v >= 1000 ? `${num(Math.round(v / 1000))}k` : num(v), m, y - 3, { width: 40, align: 'right', lineBreak: false });
  }
  const slot = anchoGraf / datos.length;
  const barra = Math.min(slot * 0.62, 22);
  datos.forEach((d, i) => {
    const h = (d.valor / tope) * alto;
    const x = ejeX + i * slot + (slot - barra) / 2;
    if (h > 0) doc.roundedRect(x, y0 + alto - h, barra, h, Math.min(3, barra / 2)).fill(d.destacar ? C.orange : C.blue);
    if (datos.length <= 16 || i % 2 === 0) {
      doc.font(F.regular).fontSize(6.3).fillColor(C.muted)
        .text(d.etiqueta, ejeX + i * slot, y0 + alto + 4, { width: slot, align: 'center', lineBreak: false });
    }
  });
  doc.x = m;
  doc.y = y0 + alto + 22;
  void formato;
}

function parrafo(ctx, texto, { color = C.muted, tamano = 8 } = {}) {
  const { doc } = ctx;
  espacio(ctx, 30);
  doc.font(F.regular).fontSize(tamano).fillColor(color).text(texto, PAGINA.margen, doc.y, { width: ANCHO_UTIL, lineGap: 2 });
  doc.y += 6;
}

/** Bloque de firmas: ['Preparado por', 'Revisado por'] */
function firmas(ctx, etiquetas, nombres = []) {
  const { doc } = ctx;
  // Las firmas pueden ocupar la zona baja de la página, justo sobre el pie
  if (doc.y + 62 > PAGINA.alto - 48) doc.addPage();
  const m = PAGINA.margen;
  const y = doc.y + 34;
  const ancho = (ANCHO_UTIL - 40 * (etiquetas.length - 1)) / etiquetas.length;
  etiquetas.forEach((e, i) => {
    const x = m + i * (ancho + 40);
    doc.rect(x, y, ancho, 0.8).fill(C.navy);
    doc.font(F.semibold).fontSize(8).fillColor(C.navy).text(nombres[i] || ' ', x, y + 5, { width: ancho, align: 'center', lineBreak: false });
    doc.font(F.regular).fontSize(7).fillColor(C.muted).text(e, x, y + 16, { width: ancho, align: 'center', lineBreak: false });
  });
  doc.y = y + 34;
}

// Sello diagonal (p. ej. "ANULADA") en la página actual
function sello(ctx, texto, color = C.red) {
  const { doc } = ctx;
  doc.save();
  doc.rotate(-28, { origin: [PAGINA.ancho / 2, PAGINA.alto / 2] });
  doc.font(F.bold).fontSize(86).fillColor(color).opacity(0.1)
    .text(texto, 0, PAGINA.alto / 2 - 50, { width: PAGINA.ancho, align: 'center', lineBreak: false });
  doc.restore();
  doc.opacity(1);
}

function pieDePagina({ doc, empresa, titulo }, { leyenda } = {}) {
  const rango = doc.bufferedPageRange();
  const m = PAGINA.margen;
  for (let i = 0; i < rango.count; i++) {
    doc.switchToPage(rango.start + i);
    const margenPrevio = doc.page.margins.bottom;
    doc.page.margins.bottom = 0; // permite escribir en la zona del pie sin crear páginas
    const y = PAGINA.alto - 42;
    doc.rect(m, y, ANCHO_UTIL, 0.6).fill(C.line);
    doc.font(F.semibold).fontSize(7).fillColor(C.navy)
      .text(`${empresa.nombreEmpresa}`, m, y + 8, { lineBreak: false });
    doc.font(F.regular).fontSize(7).fillColor(C.muted)
      .text(`  ·  ${titulo}  ·  ${leyenda || 'Documento generado por SGI Automotriz'}`, m + doc.widthOfString(empresa.nombreEmpresa) + 4, y + 8, { lineBreak: false });
    doc.font(F.semibold).fontSize(7).fillColor(C.navy)
      .text(`Página ${i + 1} de ${rango.count}`, m, y + 8, { width: ANCHO_UTIL, align: 'right', lineBreak: false });
    doc.rect(m, PAGINA.alto - 24, 26, 2.5).fill(C.orange);
    doc.page.margins.bottom = margenPrevio;
  }
}

module.exports = {
  C, F, PAGINA, ANCHO_UTIL, LIMITE_INFERIOR, rd, num, pct, ajustar,
  crearDocumento, seccion, kpis, tabla, barrasHorizontales, columnasVerticales, parrafo, firmas, sello, espacio,
};
