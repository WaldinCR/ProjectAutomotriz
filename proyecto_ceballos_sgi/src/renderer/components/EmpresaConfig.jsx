// Admin › Empresa: datos de la empresa, ITBIS, secuencias NCF e impresora térmica
import { useState, useEffect } from 'react';
import Alert from './Alert';
import Field from './Field';
import Spinner from './Spinner';
import { TIPOS_COMPROBANTE } from './ComprobanteFields';
import { actualizarConfig, listarSecuencias, guardarSecuencia, imprimirPrueba } from '../services/configService';
import { useConfigStore } from '../store/configStore';
import { fecha } from '../lib/format';

const SEC_VACIA = { tipo: 'B02', siguiente: '1', hasta: '', vencimiento: '', activo: true };

function Seccion({ icono, titulo, descripcion, children }) {
  return (
    <div className="card" style={{ padding: '18px', marginBottom: '14px' }}>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '14px' }}>
        <div className="caja-icon" style={{ background: '#e7f2fc' }}><i className={`ti ${icono}`} style={{ color: '#0677dd' }}></i></div>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>{titulo}</div>
          {descripcion && <div style={{ fontSize: '12px', color: '#64748b' }}>{descripcion}</div>}
        </div>
      </div>
      {children}
    </div>
  );
}

export default function EmpresaConfig() {
  const { cargar, establecer } = useConfigStore();
  const [form, setForm] = useState(null);
  const [secuencias, setSecuencias] = useState([]);
  const [sec, setSec] = useState(SEC_VACIA);
  const [alerta, setAlerta] = useState(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    Promise.all([cargar(true), listarSecuencias()])
      .then(([c, s]) => {
        setForm({ ...c, tasaItbis: String(Math.round(c.tasaItbis * 10000) / 100) });
        setSecuencias(s);
      })
      .catch(e => setAlerta({ type: 'error', msg: e.message }));
  }, [cargar]);

  if (!form) return alerta ? <Alert type="error" message={alerta.msg} /> : <Spinner />;

  const set = (campo) => (e) => setForm({ ...form, [campo]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const b02 = secuencias.find(s => s.tipo === 'B02');
  const sinB02 = form.emitirNcf && (!b02 || !b02.activo || b02.vencida || b02.disponibles === 0);

  async function guardarConfig() {
    const tasa = Number(form.tasaItbis);
    if (!form.nombreEmpresa.trim()) return setAlerta({ type: 'error', msg: 'El nombre de la empresa es requerido' });
    if (Number.isNaN(tasa) || tasa < 0 || tasa > 50) return setAlerta({ type: 'error', msg: 'La tasa de ITBIS debe estar entre 0 y 50 %' });
    if (form.impresoraTipo !== 'NINGUNA' && !form.impresoraDestino?.trim()) {
      return setAlerta({ type: 'error', msg: 'Indique la dirección o ruta de la impresora' });
    }
    setGuardando(true);
    try {
      const c = await actualizarConfig({
        nombreEmpresa: form.nombreEmpresa, eslogan: form.eslogan, rnc: form.rnc, direccion: form.direccion,
        telefono: form.telefono, email: form.email, piePagina: form.piePagina,
        tasaItbis: tasa / 100, preciosIncluyenItbis: form.preciosIncluyenItbis, emitirNcf: form.emitirNcf,
        impresoraTipo: form.impresoraTipo, impresoraDestino: form.impresoraDestino,
        impresoraAncho: Number(form.impresoraAncho), imprimirAutomatico: form.imprimirAutomatico,
      });
      establecer(c);
      setForm({ ...c, tasaItbis: String(Math.round(c.tasaItbis * 10000) / 100) });
      setAlerta({ type: 'success', msg: 'Configuración guardada' });
    } catch (e) {
      setAlerta({ type: 'error', msg: e.message });
    } finally {
      setGuardando(false);
    }
  }

  async function guardarSec() {
    const desde = Number(sec.siguiente);
    const hasta = Number(sec.hasta);
    if (!Number.isInteger(desde) || desde < 1 || !Number.isInteger(hasta) || hasta < desde) {
      return setAlerta({ type: 'error', msg: 'Indique un rango válido: el número final debe ser mayor o igual al inicial' });
    }
    setGuardando(true);
    try {
      await guardarSecuencia({ ...sec, siguiente: desde, hasta });
      setSecuencias(await listarSecuencias());
      setSec(SEC_VACIA);
      setAlerta({ type: 'success', msg: `Secuencia ${sec.tipo} guardada` });
    } catch (e) {
      setAlerta({ type: 'error', msg: e.message });
    } finally {
      setGuardando(false);
    }
  }

  async function probarImpresora() {
    setGuardando(true);
    try {
      await imprimirPrueba();
      setAlerta({ type: 'success', msg: 'Página de prueba enviada a la impresora' });
    } catch (e) {
      setAlerta({ type: 'error', msg: e.message });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div>
      {alerta && <Alert type={alerta.type} message={alerta.msg} onClose={() => setAlerta(null)} />}

      <Seccion icono="ti-building-store" titulo="Datos de la empresa" descripcion="Aparecen en facturas, tickets y reportes PDF">
        <div className="form-grid">
          <Field label="Nombre comercial"><input className="inp" value={form.nombreEmpresa} onChange={set('nombreEmpresa')} /></Field>
          <Field label="Eslogan"><input className="inp" value={form.eslogan || ''} onChange={set('eslogan')} /></Field>
          <Field label="RNC"><input className="inp" value={form.rnc || ''} placeholder="9 dígitos" onChange={set('rnc')} /></Field>
          <Field label="Teléfono"><input className="inp" value={form.telefono || ''} onChange={set('telefono')} /></Field>
          <Field label="Correo electrónico"><input className="inp" value={form.email || ''} onChange={set('email')} /></Field>
          <Field label="Dirección"><input className="inp" value={form.direccion || ''} onChange={set('direccion')} /></Field>
        </div>
        <Field label="Mensaje al pie de facturas y tickets" className="mt-3">
          <input className="inp" value={form.piePagina || ''} onChange={set('piePagina')} />
        </Field>
      </Seccion>

      <Seccion icono="ti-receipt-tax" titulo="Impuestos y comprobantes fiscales" descripcion="ITBIS y emisión de NCF según la DGII">
        <div className="form-grid">
          <Field label="Tasa de ITBIS (%)">
            <input className="inp" type="number" min="0" max="50" step="0.01" value={form.tasaItbis} onChange={set('tasaItbis')} />
          </Field>
          <div style={{ display: 'grid', gap: '8px', alignContent: 'end', fontSize: '13px' }}>
            <label style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input type="checkbox" checked={form.preciosIncluyenItbis} onChange={set('preciosIncluyenItbis')} />
              Los precios de venta ya incluyen ITBIS
            </label>
            <label style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input type="checkbox" checked={form.emitirNcf} onChange={set('emitirNcf')} />
              Emitir comprobantes fiscales (NCF)
            </label>
          </div>
        </div>
        {sinB02 && (
          <div className="warn-strip" style={{ marginTop: '12px', marginBottom: 0 }}>
            <i className="ti ti-alert-triangle"></i>
            Con NCF activado, las ventas de consumo necesitan una secuencia B02 vigente con números disponibles.
          </div>
        )}

        <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155', margin: '16px 0 8px' }}>Secuencias autorizadas</div>
        <div className="tbl-wrap" style={{ marginBottom: '12px' }}>
          <table>
            <thead><tr><th>Tipo</th><th>Próximo NCF</th><th>Hasta</th><th>Disponibles</th><th>Vence</th><th>Estado</th></tr></thead>
            <tbody>
              {secuencias.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '18px', color: '#94a3b8' }}>No hay secuencias registradas</td></tr>
              ) : secuencias.map(s => (
                <tr key={s.id}>
                  <td className="td-bold">{s.tipo} · {s.nombre}</td>
                  <td className="td-mono">{s.proximo}</td>
                  <td>{s.hasta.toLocaleString('es-DO')}</td>
                  <td style={{ color: s.disponibles < 50 ? '#dc2626' : undefined, fontWeight: 600 }}>{s.disponibles.toLocaleString('es-DO')}</td>
                  <td>{s.vencimiento ? fecha(s.vencimiento) : '—'}</td>
                  <td>
                    {!s.activo ? <span className="badge bg-gray">Inactiva</span>
                      : s.vencida ? <span className="badge bg-red">Vencida</span>
                        : s.disponibles === 0 ? <span className="badge bg-red">Agotada</span>
                          : <span className="badge bg-green">Vigente</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr auto auto', gap: '8px', alignItems: 'end' }}>
          <Field label="Tipo">
            <select className="inp" value={sec.tipo} onChange={e => setSec({ ...sec, tipo: e.target.value })}>
              {TIPOS_COMPROBANTE.map(t => <option key={t.tipo} value={t.tipo}>{t.tipo} · {t.nombre}</option>)}
            </select>
          </Field>
          <Field label="Desde (número)"><input className="inp" type="number" min="1" value={sec.siguiente} onChange={e => setSec({ ...sec, siguiente: e.target.value })} /></Field>
          <Field label="Hasta (número)"><input className="inp" type="number" min="1" value={sec.hasta} onChange={e => setSec({ ...sec, hasta: e.target.value })} /></Field>
          <Field label="Vencimiento"><input className="inp" type="date" value={sec.vencimiento} onChange={e => setSec({ ...sec, vencimiento: e.target.value })} /></Field>
          <label style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12px', paddingBottom: '10px' }}>
            <input type="checkbox" checked={sec.activo} onChange={e => setSec({ ...sec, activo: e.target.checked })} />Activa
          </label>
          <button className="btn btn-dark" onClick={guardarSec} disabled={guardando}>Guardar secuencia</button>
        </div>
        <p className="muted" style={{ fontSize: '11px', marginTop: '6px' }}>
          Registre el rango autorizado por la DGII. Guardar un tipo existente reemplaza su rango; no se permite reutilizar números ya emitidos.
        </p>
      </Seccion>

      <Seccion icono="ti-printer" titulo="Impresora de tickets" descripcion="Impresora térmica ESC/POS (80 mm o 58 mm)">
        <div className="form-grid">
          <Field label="Conexión">
            <select className="inp" value={form.impresoraTipo} onChange={set('impresoraTipo')}>
              <option value="NINGUNA">Sin impresora térmica (usar diálogo de impresión)</option>
              <option value="RED">Impresora de red (IP)</option>
              <option value="COMPARTIDA">Impresora compartida de Windows</option>
            </select>
          </Field>
          <Field label={form.impresoraTipo === 'RED' ? 'Dirección IP (puerto 9100 por defecto)' : 'Ruta de la impresora compartida'}>
            <input
              className="inp" disabled={form.impresoraTipo === 'NINGUNA'} value={form.impresoraDestino || ''}
              placeholder={form.impresoraTipo === 'RED' ? '192.168.1.50' : '\\\\localhost\\Ticketera'}
              onChange={set('impresoraDestino')}
            />
          </Field>
          <Field label="Ancho del papel">
            <select className="inp" value={form.impresoraAncho} onChange={set('impresoraAncho')}>
              <option value={48}>80 mm (48 caracteres)</option>
              <option value={42}>80 mm fuente B (42 caracteres)</option>
              <option value={32}>58 mm (32 caracteres)</option>
            </select>
          </Field>
          <label style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px', paddingTop: '18px' }}>
            <input type="checkbox" checked={form.imprimirAutomatico} disabled={form.impresoraTipo === 'NINGUNA'} onChange={set('imprimirAutomatico')} />
            Imprimir el ticket automáticamente al cobrar
          </label>
        </div>
        <button className="btn btn-ghost" style={{ marginTop: '12px' }} onClick={probarImpresora} disabled={guardando || form.impresoraTipo === 'NINGUNA'}>
          <i className="ti ti-printer"></i>Imprimir página de prueba
        </button>
        <span className="muted" style={{ fontSize: '11px', marginLeft: '8px' }}>Guarde los cambios antes de probar.</span>
      </Seccion>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-dark" onClick={guardarConfig} disabled={guardando}>
          <i className="ti ti-device-floppy"></i>{guardando ? 'Guardando...' : 'Guardar configuración'}
        </button>
      </div>
    </div>
  );
}
