import { useState, useEffect } from 'react';
import PageLayout from '../components/PageLayout';
import Modal from '../components/Modal';
import Alert from '../components/Alert';
import Spinner from '../components/Spinner';
import Field from '../components/Field';
import Receipt from '../components/Receipt';
import { crearOrden, listarOrdenes, cambiarEstado, facturarOrden } from '../services/workshopService';
import { listarProductos } from '../services/inventoryService';
import { useAuthStore, ROLES } from '../store/authStore';
import { rd, fecha, fechaHora } from '../lib/format';

const VACIO = { vehiculo: '', placa: '', cliente: '', telefono: '', descripcion: '' };
const LINEA = { tipo: 'SERVICIO', servicio: '', productoId: '', cantidad: '1', precioUnitario: '' };

// Mismas transiciones que el proceso principal (workshop.service.js)
const ACCIONES = {
  PENDIENTE:  [{ estado: 'EN_PROCESO', label: 'Iniciar', icon: 'ti-player-play' }],
  EN_PROCESO: [{ estado: 'COMPLETADA', label: 'Completar', icon: 'ti-check' }],
  COMPLETADA: [{ estado: 'EN_PROCESO', label: 'Reabrir', icon: 'ti-arrow-back-up' }],
};
const CANCELABLE = ['PENDIENTE', 'EN_PROCESO'];

const BADGE = { FACTURADA: 'bg-green', COMPLETADA: 'bg-purple', EN_PROCESO: 'bg-blue', CANCELADA: 'bg-red', PENDIENTE: 'bg-yellow' };
const METODOS = ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'];

export default function WorkshopPage() {
  const { tieneRol } = useAuthStore();
  const puedeOperar = tieneRol(ROLES.ADMIN, ROLES.CAJERO);

  const [ordenes, setOrdenes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [filtro, setFiltro] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [loading, setLoading] = useState(true);
  const [alerta, setAlerta] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const [modalNueva, setModalNueva] = useState(false);
  const [form, setForm] = useState(VACIO);
  const [items, setItems] = useState([LINEA]);
  const [errors, setErrors] = useState({});
  const [errorModal, setErrorModal] = useState('');

  const [detalle, setDetalle] = useState(null);
  const [cancelar, setCancelar] = useState(null);   // { orden, motivo, error }
  const [facturar, setFacturar] = useState(null);   // { orden, metodoPago, error }
  const [factura, setFactura] = useState(null);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setLoading(true);
    try {
      const [ords, prods] = await Promise.all([listarOrdenes(), listarProductos()]);
      setOrdenes(ords);
      setProductos(prods);
    } catch (e) {
      setAlerta({ type: 'error', msg: e.message });
    } finally {
      setLoading(false);
    }
  }

  const productoDe = (it) => productos.find(p => p.id === Number(it.productoId));
  const precioDe = (it) => it.tipo === 'REPUESTO' ? (productoDe(it)?.precioVenta ?? 0) : (parseFloat(it.precioUnitario) || 0);
  const subtotalDe = (it) => precioDe(it) * (parseInt(it.cantidad) || 0);
  const totalNueva = items.reduce((s, it) => s + subtotalDe(it), 0);

  function updateItem(i, campo, valor) {
    setItems(prev => prev.map((it, idx) => {
      if (idx !== i) return it;
      const u = { ...it, [campo]: valor };
      if (campo === 'tipo') { u.productoId = ''; u.precioUnitario = ''; }
      return u;
    }));
    setErrors(er => ({ ...er, [`item${i}`]: '' }));
  }

  function cerrarNueva() {
    setModalNueva(false);
    setForm(VACIO);
    setItems([LINEA]);
    setErrors({});
    setErrorModal('');
  }

  function validar() {
    const err = {};
    if (!form.vehiculo.trim()) err.vehiculo = 'El vehículo es requerido';
    if (!form.cliente.trim()) err.cliente = 'El cliente es requerido';
    if (form.telefono && !/^[0-9+()\-\s]{7,20}$/.test(form.telefono)) err.telefono = 'Teléfono no válido';

    // Cantidad total pedida por repuesto (puede repetirse en varias líneas)
    const pedido = {};
    items.forEach((it, i) => {
      const cant = Number(it.cantidad);
      if (!Number.isInteger(cant) || cant < 1) err[`item${i}`] = 'Cantidad inválida';
      else if (it.tipo === 'REPUESTO') {
        const p = productoDe(it);
        if (!p) err[`item${i}`] = 'Seleccione un repuesto';
        else {
          pedido[p.id] = (pedido[p.id] || 0) + cant;
          if (pedido[p.id] > p.stock) err[`item${i}`] = `Stock insuficiente (disponible: ${p.stock})`;
        }
      } else {
        if (!it.servicio.trim()) err[`item${i}`] = 'Describa el servicio';
        else if (it.precioUnitario === '' || Number(it.precioUnitario) < 0) err[`item${i}`] = 'Indique el precio';
      }
    });
    return err;
  }

  async function handleCrear() {
    const err = validar();
    setErrors(err);
    if (Object.keys(err).length) return;

    setGuardando(true);
    try {
      const orden = await crearOrden({
        ...form,
        items: items.map(it => it.tipo === 'REPUESTO'
          ? { productoId: Number(it.productoId), cantidad: Number(it.cantidad), servicio: it.servicio || undefined }
          : { servicio: it.servicio, cantidad: Number(it.cantidad), precioUnitario: Number(it.precioUnitario) }),
      });
      setAlerta({ type: 'success', msg: `Orden de trabajo #${orden.id} creada` });
      cerrarNueva();
      cargar();
    } catch (e) {
      setErrorModal(e.message);
    } finally {
      setGuardando(false);
    }
  }

  async function handleEstado(orden, estado, motivo) {
    try {
      await cambiarEstado({ ordenId: orden.id, estado, motivo });
      setAlerta({ type: 'success', msg: `Orden #${orden.id} actualizada a ${estado}` });
      setCancelar(null);
      cargar();
    } catch (e) {
      if (cancelar) setCancelar(c => ({ ...c, error: e.message }));
      else setAlerta({ type: 'error', msg: e.message });
    }
  }

  async function handleFacturar() {
    setGuardando(true);
    try {
      const venta = await facturarOrden({ ordenId: facturar.orden.id, metodoPago: facturar.metodoPago });
      setFacturar(null);
      setFactura(venta);
      setAlerta({ type: 'success', msg: `Orden #${facturar.orden.id} facturada (${venta.numeroFactura})` });
      cargar();
    } catch (e) {
      setFacturar(f => ({ ...f, error: e.message }));
    } finally {
      setGuardando(false);
    }
  }

  const q = filtro.toLowerCase();
  const ordenesFiltradas = ordenes.filter(o =>
    (!filtroEstado || o.estado === filtroEstado) && (
      o.vehiculo.toLowerCase().includes(q) ||
      o.cliente.toLowerCase().includes(q) ||
      (o.placa || '').toLowerCase().includes(q) ||
      String(o.id).includes(filtro)
    ));

  const facturadas = ordenes.filter(o => o.estado === 'FACTURADA');
  const abiertas = ordenes.filter(o => ['PENDIENTE', 'EN_PROCESO', 'COMPLETADA'].includes(o.estado)).length;

  return (
    <PageLayout
      title="Órdenes de trabajo"
      subtitle="Gestión y seguimiento de servicios del taller"
      actions={puedeOperar && (
        <button className="btn btn-dark" onClick={() => setModalNueva(true)}>
          <i className="ti ti-plus"></i>Nueva OT
        </button>
      )}
    >
      {alerta && (
        <div style={{ marginBottom: '14px' }}>
          <Alert type={alerta.type} message={alerta.msg} onClose={() => setAlerta(null)} />
        </div>
      )}

      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-icon-wrap" style={{ background: '#dbeafe' }}><i className="ti ti-clipboard-list" style={{ color: '#1e40af' }}></i></div>
          <div className="stat-val">{ordenes.length}</div>
          <div className="stat-label">Órdenes totales</div>
          <div className="stat-bar" style={{ background: '#bfdbfe' }}></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon-wrap" style={{ background: '#fef9c3' }}><i className="ti ti-clock" style={{ color: '#854d0e' }}></i></div>
          <div className="stat-val">{abiertas}</div>
          <div className="stat-label">Abiertas (sin facturar)</div>
          <div className="stat-bar" style={{ background: '#fde047' }}></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon-wrap" style={{ background: '#dcfce7' }}><i className="ti ti-circle-check" style={{ color: '#166534' }}></i></div>
          <div className="stat-val">{facturadas.length}</div>
          <div className="stat-label">Facturadas</div>
          <div className="stat-bar" style={{ background: '#86efac' }}></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon-wrap" style={{ background: '#ede9fe' }}><i className="ti ti-currency-dollar" style={{ color: '#5b21b6' }}></i></div>
          <div className="stat-val" style={{ fontSize: '18px' }}>{rd(facturadas.reduce((s, o) => s + o.total, 0))}</div>
          <div className="stat-label">Total facturado</div>
          <div className="stat-bar" style={{ background: '#c4b5fd' }}></div>
        </div>
      </div>

      <div className="search-row">
        <i className="ti ti-search"></i>
        <input
          type="text"
          placeholder="Buscar por vehículo, placa, cliente o número de OT..."
          value={filtro}
          onChange={e => setFiltro(e.target.value)}
        />
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} style={{ border: 'none', background: 'transparent', fontSize: '12px', color: '#64748b' }}>
          <option value="">Todos los estados</option>
          {Object.keys(BADGE).map(es => <option key={es} value={es}>{es}</option>)}
        </select>
      </div>

      <div className="tbl-wrap">
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center' }}><Spinner /></div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Vehículo</th>
                <th>Cliente</th>
                <th>Estado</th>
                <th>Total</th>
                <th>Fecha</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ordenesFiltradas.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                    No se encontraron órdenes de trabajo
                  </td>
                </tr>
              ) : ordenesFiltradas.map(o => (
                <tr key={o.id}>
                  <td className="td-accent">#{o.id}</td>
                  <td>
                    {o.vehiculo}
                    {o.placa && <div className="td-mono muted" style={{ fontSize: '11px' }}>{o.placa}</div>}
                  </td>
                  <td>
                    {o.cliente}
                    {o.telefono && <div className="muted" style={{ fontSize: '11px' }}>{o.telefono}</div>}
                  </td>
                  <td><span className={`badge ${BADGE[o.estado] || 'bg-gray'}`}>{o.estado}</span></td>
                  <td className="td-bold">{rd(o.total)}</td>
                  <td style={{ color: '#64748b' }}>{fecha(o.fechaCreacion)}</td>
                  <td>
                    <div className="row-actions">
                      {puedeOperar && (ACCIONES[o.estado] || []).map(a => (
                        <button key={a.estado} className="btn btn-ghost btn-sm" onClick={() => handleEstado(o, a.estado)}>
                          <i className={`ti ${a.icon}`} style={{ fontSize: '12px' }}></i>{a.label}
                        </button>
                      ))}
                      {puedeOperar && o.estado === 'COMPLETADA' && (
                        <button className="btn btn-success btn-sm" onClick={() => setFacturar({ orden: o, metodoPago: 'EFECTIVO' })}>
                          <i className="ti ti-receipt" style={{ fontSize: '12px' }}></i>Facturar
                        </button>
                      )}
                      {puedeOperar && CANCELABLE.includes(o.estado) && (
                        <button className="btn btn-ghost btn-sm" style={{ color: '#dc2626' }} onClick={() => setCancelar({ orden: o, motivo: '' })} title="Cancelar orden">
                          <i className="ti ti-x" style={{ fontSize: '12px' }}></i>
                        </button>
                      )}
                      <button className="btn btn-ghost btn-sm" onClick={() => setDetalle(o)} title="Ver detalle">
                        <i className="ti ti-eye" style={{ fontSize: '12px' }}></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Nueva OT */}
      <Modal open={modalNueva} title="Nueva orden de trabajo" onClose={cerrarNueva} size="xl">
        {errorModal && <Alert type="error" message={errorModal} onClose={() => setErrorModal('')} />}
        <div className="form-grid" style={{ marginBottom: '16px' }}>
          <Field label="Vehículo (ej: Toyota Corolla 2018)" error={errors.vehiculo}>
            <input className="inp" value={form.vehiculo} autoFocus onChange={e => { setForm({ ...form, vehiculo: e.target.value }); setErrors({ ...errors, vehiculo: '' }); }} />
          </Field>
          <Field label="Placa">
            <input className="inp" value={form.placa} style={{ textTransform: 'uppercase' }} onChange={e => setForm({ ...form, placa: e.target.value })} />
          </Field>
          <Field label="Cliente" error={errors.cliente}>
            <input className="inp" value={form.cliente} onChange={e => { setForm({ ...form, cliente: e.target.value }); setErrors({ ...errors, cliente: '' }); }} />
          </Field>
          <Field label="Teléfono" error={errors.telefono}>
            <input className="inp" value={form.telefono} placeholder="809-000-0000" onChange={e => { setForm({ ...form, telefono: e.target.value }); setErrors({ ...errors, telefono: '' }); }} />
          </Field>
        </div>
        <Field label="Descripción del problema" className="mb-4">
          <textarea className="inp" rows={2} value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} />
        </Field>

        <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155', margin: '6px 0 10px' }}>Servicios y repuestos</div>

        {items.map((it, i) => {
          const p = productoDe(it);
          return (
            <div key={i} style={{ marginBottom: '10px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '130px 2fr 80px 120px 110px 32px', gap: '8px', alignItems: 'end' }}>
                <Field label={i === 0 ? 'Tipo' : null}>
                  <select className="inp" value={it.tipo} onChange={e => updateItem(i, 'tipo', e.target.value)}>
                    <option value="SERVICIO">Servicio</option>
                    <option value="REPUESTO">Repuesto</option>
                  </select>
                </Field>
                {it.tipo === 'REPUESTO' ? (
                  <Field label={i === 0 ? 'Repuesto del inventario' : null}>
                    <select className="inp" value={it.productoId} onChange={e => updateItem(i, 'productoId', e.target.value)}>
                      <option value="">Seleccione...</option>
                      {productos.map(pr => (
                        <option key={pr.id} value={pr.id} disabled={pr.stock <= 0}>
                          {pr.nombre} — stock {pr.stock}
                        </option>
                      ))}
                    </select>
                  </Field>
                ) : (
                  <Field label={i === 0 ? 'Descripción del servicio' : null}>
                    <input className="inp" value={it.servicio} placeholder="Ej: Cambio de aceite, mano de obra..." onChange={e => updateItem(i, 'servicio', e.target.value)} />
                  </Field>
                )}
                <Field label={i === 0 ? 'Cant.' : null}>
                  <input className="inp" type="number" min="1" max={p?.stock} value={it.cantidad} onChange={e => updateItem(i, 'cantidad', e.target.value)} />
                </Field>
                <Field label={i === 0 ? 'Precio (RD$)' : null}>
                  {it.tipo === 'REPUESTO' ? (
                    <input className="inp" value={p ? p.precioVenta.toFixed(2) : ''} disabled title="Precio del inventario" />
                  ) : (
                    <input className="inp" type="number" min="0" step="0.01" value={it.precioUnitario} onChange={e => updateItem(i, 'precioUnitario', e.target.value)} />
                  )}
                </Field>
                <Field label={i === 0 ? 'Subtotal' : null}>
                  <div className="inp" style={{ background: '#f8fafc' }}>{rd(subtotalDe(it))}</div>
                </Field>
                <button
                  type="button" className="btn btn-ghost btn-sm" title="Quitar línea"
                  disabled={items.length === 1}
                  onClick={() => setItems(prev => prev.filter((_, idx) => idx !== i))}
                  style={{ height: '36px', padding: '0 8px' }}
                >
                  <i className="ti ti-trash"></i>
                </button>
              </div>
              {errors[`item${i}`] && <span className="field-err">{errors[`item${i}`]}</span>}
            </div>
          );
        })}

        <button type="button" className="btn btn-ghost btn-sm" style={{ marginBottom: '6px' }} onClick={() => setItems([...items, LINEA])}>
          <i className="ti ti-plus"></i>Agregar línea
        </button>

        <div className="modal-actions" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '16px', fontWeight: 700, color: '#1e3a5f' }}>Total: {rd(totalNueva)}</span>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-ghost" onClick={cerrarNueva}>Cancelar</button>
            <button className="btn btn-dark" onClick={handleCrear} disabled={guardando}>{guardando ? 'Guardando...' : 'Crear orden'}</button>
          </div>
        </div>
      </Modal>

      {/* Detalle */}
      <Modal open={!!detalle} title={`Orden #${detalle?.id}`} onClose={() => setDetalle(null)} size="lg">
        {detalle && (
          <>
            <div className="form-grid" style={{ fontSize: '13px', marginBottom: '14px' }}>
              <div><span className="muted">Vehículo:</span> {detalle.vehiculo} {detalle.placa && `(${detalle.placa})`}</div>
              <div><span className="muted">Estado:</span> <span className={`badge ${BADGE[detalle.estado]}`}>{detalle.estado}</span></div>
              <div><span className="muted">Cliente:</span> {detalle.cliente} {detalle.telefono && `· ${detalle.telefono}`}</div>
              <div><span className="muted">Creada:</span> {fechaHora(detalle.fechaCreacion)} por {detalle.usuario?.nombre}</div>
              {detalle.venta && <div><span className="muted">Factura:</span> {detalle.venta.numeroFactura} ({detalle.venta.metodoPago})</div>}
            </div>
            {detalle.descripcion && <p style={{ fontSize: '13px', marginBottom: '14px' }}><span className="muted">Problema:</span> {detalle.descripcion}</p>}
            <div className="tbl-wrap">
              <table>
                <thead><tr><th>Concepto</th><th>Tipo</th><th>Cant.</th><th>Precio</th><th>Subtotal</th></tr></thead>
                <tbody>
                  {detalle.detalles.map(d => (
                    <tr key={d.id}>
                      <td>{d.servicio}</td>
                      <td><span className={`badge ${d.productoId ? 'bg-blue' : 'bg-gray'}`}>{d.productoId ? 'Repuesto' : 'Servicio'}</span></td>
                      <td>{d.cantidad}</td>
                      <td>{rd(d.precioUnitario)}</td>
                      <td className="td-bold">{rd(d.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ textAlign: 'right', fontWeight: 700, fontSize: '15px', marginTop: '10px' }}>Total: {rd(detalle.total)}</div>
          </>
        )}
      </Modal>

      {/* Cancelar */}
      <Modal open={!!cancelar} title={`Cancelar orden #${cancelar?.orden.id}`} onClose={() => setCancelar(null)} size="sm">
        {cancelar && (
          <>
            {cancelar.error && <Alert type="error" message={cancelar.error} />}
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '12px' }}>
              Los repuestos de esta orden volverán al inventario. Esta acción queda registrada en auditoría.
            </p>
            <Field label="Motivo de la cancelación">
              <input className="inp" autoFocus value={cancelar.motivo} onChange={e => setCancelar(c => ({ ...c, motivo: e.target.value, error: '' }))} />
            </Field>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setCancelar(null)}>Volver</button>
              <button
                className="btn btn-danger"
                disabled={!cancelar.motivo.trim()}
                onClick={() => handleEstado(cancelar.orden, 'CANCELADA', cancelar.motivo.trim())}
              >
                Cancelar orden
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* Facturar */}
      <Modal open={!!facturar} title={`Facturar orden #${facturar?.orden.id}`} onClose={() => setFacturar(null)} size="sm">
        {facturar && (
          <>
            {facturar.error && <Alert type="error" message={facturar.error} />}
            <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '16px', textAlign: 'center', marginBottom: '14px', border: '1px solid #e2e8f0' }}>
              <p style={{ fontSize: '12px', color: '#64748b' }}>Total a cobrar</p>
              <p style={{ fontSize: '28px', fontWeight: 700, color: '#1e3a5f' }}>{rd(facturar.orden.total)}</p>
            </div>
            <label className="lbl">Método de pago</label>
            {METODOS.map(m => (
              <button key={m} className={`method-btn ${facturar.metodoPago === m ? 'sel' : ''}`} onClick={() => setFacturar(f => ({ ...f, metodoPago: m }))}>
                {m}
              </button>
            ))}
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setFacturar(null)}>Cancelar</button>
              <button className="btn btn-dark" onClick={handleFacturar} disabled={guardando}>{guardando ? 'Procesando...' : 'Confirmar factura'}</button>
            </div>
          </>
        )}
      </Modal>

      <Receipt venta={factura} onClose={() => setFactura(null)} />
    </PageLayout>
  );
}
