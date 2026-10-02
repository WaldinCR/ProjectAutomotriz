// Datos del comprobante fiscal: tipo de NCF y cliente (RNC / cédula).
// Si la empresa no emite NCF, solo se piden los datos opcionales del cliente.
import Field from './Field';

export const TIPOS_COMPROBANTE = [
  { tipo: 'B02', nombre: 'Consumo', requiereRnc: false },
  { tipo: 'B01', nombre: 'Crédito fiscal', requiereRnc: true },
  { tipo: 'B14', nombre: 'Régimen especial', requiereRnc: true },
  { tipo: 'B15', nombre: 'Gubernamental', requiereRnc: true },
];

export const COMPROBANTE_VACIO = { tipoComprobante: 'B02', clienteNombre: '', clienteRnc: '' };

// Devuelve un mensaje de error o '' si los datos son suficientes
export function validarComprobante(c, emitirNcf) {
  const tipo = TIPOS_COMPROBANTE.find(t => t.tipo === c.tipoComprobante);
  const rnc = c.clienteRnc.replace(/[\s-]/g, '');
  if (rnc && !/^\d{9}$|^\d{11}$/.test(rnc)) return 'El RNC debe tener 9 dígitos o la cédula 11';
  if (emitirNcf && tipo?.requiereRnc) {
    if (!rnc) return `El comprobante de ${tipo.nombre} requiere RNC o cédula`;
    if (!c.clienteNombre.trim()) return `El comprobante de ${tipo.nombre} requiere la razón social`;
  }
  return '';
}

// Datos que se envían al backend
export function datosComprobante(c, emitirNcf) {
  return {
    ...(emitirNcf && { tipoComprobante: c.tipoComprobante }),
    clienteNombre: c.clienteNombre.trim() || undefined,
    clienteRnc: c.clienteRnc.trim() || undefined,
  };
}

export default function ComprobanteFields({ valor, onChange, emitirNcf }) {
  const tipo = TIPOS_COMPROBANTE.find(t => t.tipo === valor.tipoComprobante);
  const set = (campo) => (e) => onChange({ ...valor, [campo]: e.target.value });
  const obligatorio = emitirNcf && tipo?.requiereRnc;

  return (
    <div style={{ display: 'grid', gap: '8px' }}>
      {emitirNcf && (
        <Field label="Comprobante fiscal (NCF)">
          <select className="inp" value={valor.tipoComprobante} onChange={set('tipoComprobante')}>
            {TIPOS_COMPROBANTE.map(t => <option key={t.tipo} value={t.tipo}>{t.tipo} · {t.nombre}</option>)}
          </select>
        </Field>
      )}
      <Field label={obligatorio ? 'Razón social / nombre' : 'Cliente (opcional)'}>
        <input className="inp" value={valor.clienteNombre} placeholder="Consumidor final" onChange={set('clienteNombre')} />
      </Field>
      <Field label={obligatorio ? 'RNC o cédula' : 'RNC o cédula (opcional)'}>
        <input className="inp" value={valor.clienteRnc} placeholder="9 u 11 dígitos" inputMode="numeric" onChange={set('clienteRnc')} />
      </Field>
    </div>
  );
}
