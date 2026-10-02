import { useState, useEffect } from 'react';
import PageLayout from '../components/PageLayout';
import Alert from '../components/Alert';
import Modal from '../components/Modal';
import Spinner from '../components/Spinner';
import Field from '../components/Field';
import Receipt from '../components/Receipt';
import { cierrePdf, generarYAbrir } from '../services/reportsService';
import { resumenTurno, confirmarCierre, historialCierres } from '../services/cashierService';
import { listarVentas, anularVenta } from '../services/posService';
import { useAuthStore, ROLES } from '../store/authStore';
import { rd, fechaHora } from '../lib/format';

export default function CashierPage() {
  const { user, tieneRol } = useAuthStore();
  const puedeCerrar = tieneRol(ROLES.ADMIN, ROLES.CAJERO);
  const puedeAnular = tieneRol(ROLES.ADMIN, ROLES.SUPERVISOR);
  const esAdmin = tieneRol(ROLES.ADMIN);

  const [tab, setTab] = useState('cierre');
  const [resumen, setResumen] = useState(null);
  const [ventas, setVentas] = useState([]);
  const [cierres, setCierres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [contado, setContado] = useState('');
  const [obs, setObs] = useState('');
  const [alerta, setAlerta] = useState(null);
  const [modal, setModal] = useState(false);
  const [anular, setAnular] = useState(null); // { venta, motivo, error }
  const [verVenta, setVerVenta] = useState(null);
  const [cierreReciente, setCierreReciente] = useState(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => { cargar(); }, [tab]);

  async function cargar() {
    setLoading(true);
    try {
      if (tab === 'historial') {
        setCierres(await historialCierres());
      } else {
        const [r, v] = await Promise.all([resumenTurno(), listarVentas()]);
        setResumen(r);
        setVentas(v);
      }
    } catch (e) {
      setAlerta({ type: 'error', msg: e.message });
    } finally {
      setLoading(false);
    }
  }

  const efectivoEsperado = resumen?.efectivoEsperado || 0;
  const numContado = parseFloat(contado);
  const hayContado = contado !== '' && !isNaN(numContado) && numContado >= 0;
  const diferencia = hayContado ? Math.round((numContado - efectivoEsperado) * 100) / 100 : 0;
  const esPositivo = diferencia >= 0;
  const faltaJustificacion = hayContado && diferencia !== 0 && !obs.trim();
  const turnoSinVentas = !!resumen?.ultimoCierre && resumen.cantidadVentas === 0;

  async function handleCierre() {
    setCargando(true);
    try {
      const cierre = await confirmarCierre({ efectivoContado: numContado, observaciones: obs.trim() || undefined });
      setAlerta({ type: 'success', msg: `Cierre de caja #${cierre.id} confirmado correctamente` });
      setCierreReciente(cierre.id);
      setContado('');
      setObs('');
      cargar();
    } catch (e) {
      setAlerta({ type: 'error', msg: e.message });
    } finally {
      setModal(false);
      setCargando(false);
    }
  }

  async function handleAnular() {
    setCargando(true);
    try {
      await anularVenta({ ventaId: anular.venta.id, motivoAnulacion: anular.motivo.trim() });
      setAlerta({ type: 'success', msg: `Venta ${anular.venta.numeroFactura} anulada` });
      setAnular(null);
      cargar();
    } catch (e) {
      setAnular(a => ({ ...a, error: e.message }));
    } finally {
      setCargando(false);
    }
  }

  const abrirCierre = (id) => generarYAbrir(() => cierrePdf(id)).catch(e => setAlerta({ type: 'error', msg: e.message }));

  // Una venta ya incluida en un cierre no puede anularse
  const ventaCerrada = (v) => resumen?.ultimoCierre && new Date(v.fecha) <= new Date(resumen.ultimoCierre.fecha);

  return (
    <PageLayout title="Cierre de caja" subtitle="Conciliación de ventas y efectivo del turno">
      {alerta && (
        <div style={{ marginBottom: '14px' }}>
          <Alert type={alerta.type} message={alerta.msg} onClose={() => setAlerta(null)} />
        </div>
      )}
      {cierreReciente && (
        <div className="info-box" style={{ marginBottom: '14px', justifyContent: 'space-between' }}>
          <span><i className="ti ti-file-check"></i> Comprobante del cierre #{cierreReciente} listo.</span>
          <button className="btn btn-dark btn-sm" onClick={() => abrirCierre(cierreReciente)}>
            <i className="ti ti-file-type-pdf"></i>Ver / imprimir arqueo
          </button>
        </div>
      )}

      <div className="tab-row">
        <button type="button" className={`tab-btn ${tab === 'cierre' ? 'on' : ''}`} onClick={() => setTab('cierre')}>
          <i className="ti ti-cash-register"></i>Turno actual
        </button>
        <button type="button" className={`tab-btn ${tab === 'ventas' ? 'on' : ''}`} onClick={() => setTab('ventas')}>
          <i className="ti ti-receipt"></i>Ventas del día
        </button>
        {esAdmin && (
          <button type="button" className={`tab-btn ${tab === 'historial' ? 'on' : ''}`} onClick={() => setTab('historial')}>
            <i className="ti ti-history"></i>Historial de cierres
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center' }}><Spinner /></div>
      ) : tab === 'cierre' ? (
        <>
          <div className="caja-grid">
            <div className="card" style={{ padding: '20px' }}>
              <div className="caja-card-head">
                <div className="caja-icon" style={{ background: '#dbeafe' }}><i className="ti ti-chart-bar" style={{ color: '#1e40af' }}></i></div>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>Resumen del turno</span>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Total ventas confirmadas</div>
                <div style={{ fontSize: '28px', fontWeight: 700, color: '#1e40af' }}>{rd(resumen?.totalVentas)}</div>
              </div>

              <div className="data-row"><span className="data-label">Cantidad de ventas</span><span className="data-val">{resumen?.cantidadVentas || 0}</span></div>
              <div className="data-row"><span className="data-label">Efectivo</span><span className="data-val">{rd(resumen?.porMetodo?.EFECTIVO)}</span></div>
              <div className="data-row"><span className="data-label">Tarjeta</span><span className="data-val">{rd(resumen?.porMetodo?.TARJETA)}</span></div>
              <div className="data-row"><span className="data-label">Transferencia</span><span className="data-val">{rd(resumen?.porMetodo?.TRANSFERENCIA)}</span></div>

              <div className="info-box">
                <i className="ti ti-info-circle" style={{ fontSize: '16px', flexShrink: 0 }}></i>
                Ventas desde {resumen?.ultimoCierre ? `el último cierre (${fechaHora(resumen.ultimoCierre.fecha)})` : 'el inicio del día'}.
                Solo el efectivo debe estar físicamente en caja.
              </div>
            </div>

            <div className="card" style={{ padding: '20px' }}>
              <div className="caja-card-head">
                <div className="caja-icon" style={{ background: '#dcfce7' }}><i className="ti ti-coins" style={{ color: '#166534' }}></i></div>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>Conteo de caja</span>
              </div>

              <div className="data-row" style={{ marginBottom: '12px' }}>
                <span className="data-label">Efectivo esperado</span>
                <span className="data-val" style={{ fontSize: '16px' }}>{rd(efectivoEsperado)}</span>
              </div>

              {!puedeCerrar ? (
                <div className="info-box">Su rol permite consultar el turno, pero no realizar el cierre.</div>
              ) : turnoSinVentas ? (
                <div className="info-box">
                  <i className="ti ti-circle-check" style={{ fontSize: '16px', flexShrink: 0 }}></i>
                  La caja ya fue cerrada y no hay ventas nuevas desde entonces.
                </div>
              ) : (
                <>
                  <Field label="Efectivo contado (RD$)" className="mb-3">
                    <input className="inp" type="number" min="0" step="0.01" placeholder="0.00" value={contado} onChange={e => setContado(e.target.value)} />
                  </Field>

                  {hayContado && (
                    <div className={`diff-box ${esPositivo ? 'diff-pos' : 'diff-neg'}`}>
                      <span style={{ fontSize: '13px', fontWeight: 500, color: esPositivo ? '#166534' : '#991b1b' }}>
                        {diferencia === 0 ? 'Cuadra' : diferencia > 0 ? 'Sobrante' : 'Faltante'}
                      </span>
                      <span style={{ fontSize: '19px', fontWeight: 700, color: esPositivo ? '#166534' : '#991b1b' }}>
                        {esPositivo ? '+' : ''}{rd(diferencia)}
                      </span>
                    </div>
                  )}

                  <Field
                    label={hayContado && diferencia !== 0 ? 'Justificación de la diferencia (obligatoria)' : 'Observaciones (opcional)'}
                    error={faltaJustificacion ? 'Explique el motivo de la diferencia' : ''}
                    className="mb-4"
                  >
                    <input className="inp" placeholder="Ej: Cambio mal entregado..." value={obs} onChange={e => setObs(e.target.value)} />
                  </Field>

                  <button
                    className="btn btn-dark"
                    style={{ width: '100%', padding: '12px', fontSize: '14px', justifyContent: 'center' }}
                    disabled={!hayContado || faltaJustificacion}
                    onClick={() => setModal(true)}
                  >
                    <i className="ti ti-circle-check"></i>
                    Confirmar cierre de caja
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="footer-meta">
            <div className="meta-item">
              <i className="ti ti-calendar"></i>
              <div><div className="meta-label">Fecha</div><div className="meta-val">{new Date().toLocaleDateString('es-DO')}</div></div>
            </div>
            <div className="meta-item">
              <i className="ti ti-user"></i>
              <div><div className="meta-label">Usuario</div><div className="meta-val">{user?.nombre}</div></div>
            </div>
            <div className="meta-item">
              <i className="ti ti-shield-check"></i>
              <div>
                <div className="meta-label">Cierre anterior (hoy)</div>
                <div className="meta-val">
                  {resumen?.ultimoCierre ? `${fechaHora(resumen.ultimoCierre.fecha)} · ${resumen.ultimoCierre.usuario}` : 'Ninguno'}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : tab === 'ventas' ? (
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr><th>Factura</th><th>NCF</th><th>Hora</th><th>Cajero</th><th>Método</th><th>Total</th><th>Estado</th><th></th></tr>
            </thead>
            <tbody>
              {ventas.length === 0 ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>No hay ventas registradas hoy</td></tr>
              ) : ventas.map(v => (
                <tr key={v.id}>
                  <td className="td-mono">{v.numeroFactura}</td>
                  <td className="td-mono">{v.ncf || '—'}</td>
                  <td>{new Date(v.fecha).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })}</td>
                  <td>{v.usuario?.nombre}</td>
                  <td>{v.metodoPago}</td>
                  <td className="td-bold">{rd(v.total)}</td>
                  <td>
                    <span className={`badge ${v.estado === 'ANULADA' ? 'bg-red' : 'bg-green'}`} title={v.motivoAnulacion || undefined}>{v.estado}</span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="btn btn-ghost btn-sm" title="Ver / reimprimir factura" onClick={() => setVerVenta(v)}>
                        <i className="ti ti-receipt" style={{ fontSize: '12px' }}></i>
                      </button>
                      {puedeAnular && v.estado === 'CONFIRMADA' && (
                        ventaCerrada(v)
                          ? <span className="muted" style={{ fontSize: '11px', alignSelf: 'center' }}>En cierre</span>
                          : <button className="btn btn-ghost btn-sm" style={{ color: '#dc2626' }} onClick={() => setAnular({ venta: v, motivo: '' })}>Anular</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr><th>Fecha</th><th>Cajero</th><th>Total ventas</th><th>Esperado</th><th>Contado</th><th>Diferencia</th><th>Observaciones</th><th></th></tr>
            </thead>
            <tbody>
              {cierres.length === 0 ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>No hay cierres registrados</td></tr>
              ) : cierres.map(c => (
                <tr key={c.id}>
                  <td>{fechaHora(c.fecha)}</td>
                  <td>{c.usuario?.nombre}</td>
                  <td>{rd(c.totalVentas)}</td>
                  <td>{rd(c.efectivoEsperado)}</td>
                  <td>{rd(c.efectivoContado)}</td>
                  <td className="td-bold" style={{ color: c.diferencia < 0 ? '#dc2626' : c.diferencia > 0 ? '#166534' : undefined }}>
                    {c.diferencia > 0 ? '+' : ''}{rd(c.diferencia)}
                  </td>
                  <td style={{ whiteSpace: 'normal', maxWidth: '240px' }}>{c.observaciones || '—'}</td>
                  <td>
                    <button className="btn btn-ghost btn-sm" title="Comprobante de arqueo (PDF)" onClick={() => abrirCierre(c.id)}>
                      <i className="ti ti-file-type-pdf" style={{ fontSize: '12px' }}></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modal} title="Confirmar cierre de caja" onClose={() => setModal(false)} size="sm">
        <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '14px' }}>
          Esta acción es irreversible y quedará registrada en el log de auditoría.
        </p>
        <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '14px', marginBottom: '16px', border: '1px solid #e2e8f0', fontSize: '13px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ color: '#64748b' }}>Ventas del turno:</span><span style={{ fontWeight: 600 }}>{rd(resumen?.totalVentas)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ color: '#64748b' }}>Efectivo esperado:</span><span style={{ fontWeight: 600 }}>{rd(efectivoEsperado)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ color: '#64748b' }}>Efectivo contado:</span><span style={{ fontWeight: 600 }}>{rd(numContado)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: esPositivo ? '#166534' : '#dc2626' }}>
            <span>Diferencia:</span><span>{esPositivo ? '+' : ''}{rd(diferencia)}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setModal(false)}>Cancelar</button>
          <button className="btn btn-dark" style={{ flex: 1, justifyContent: 'center' }} onClick={handleCierre} disabled={cargando}>
            {cargando ? 'Procesando...' : 'Confirmar'}
          </button>
        </div>
      </Modal>

      <Modal open={!!anular} title={`Anular venta ${anular?.venta.numeroFactura}`} onClose={() => setAnular(null)} size="sm">
        {anular && (
          <>
            {anular.error && <Alert type="error" message={anular.error} />}
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '12px' }}>
              Total: <strong>{rd(anular.venta.total)}</strong>. La venta se conserva en el historial como ANULADA
              y sus productos vuelven al inventario.
            </p>
            <Field label="Motivo de la anulación">
              <input className="inp" autoFocus value={anular.motivo} onChange={e => setAnular(a => ({ ...a, motivo: e.target.value, error: '' }))} />
            </Field>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setAnular(null)}>Volver</button>
              <button className="btn btn-danger" disabled={!anular.motivo.trim() || cargando} onClick={handleAnular}>Anular venta</button>
            </div>
          </>
        )}
      </Modal>
      <Receipt venta={verVenta} onClose={() => setVerVenta(null)} titulo={`Factura ${verVenta?.numeroFactura || ''}`} />
    </PageLayout>
  );
}
