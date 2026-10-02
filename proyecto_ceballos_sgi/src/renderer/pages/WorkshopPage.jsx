import { useState, useEffect } from 'react';
import PageLayout from '../components/PageLayout';
import Modal from '../components/Modal';
import Alert from '../components/Alert';
import Spinner from '../components/Spinner';
import Field from '../components/Field';
import Receipt from '../components/Receipt';
import ComprobanteFields, { COMPROBANTE_VACIO, validarComprobante, datosComprobante } from '../components/ComprobanteFields';
import {
  crearOrden, listarOrdenes, listarTecnicos, asignarTecnico, agregarItem, quitarItem, cambiarEstado, facturarOrden,
} from '../services/workshopService';
import { listarProductos } from '../services/inventoryService';
import { facturaPdf, generarYAbrir } from '../services/reportsService';
import { useAuthStore, ROLES } from '../store/authStore';
import { useConfigStore } from '../store/configStore';
import { rd, fecha, fechaHora } from '../lib/format';

const VACIO = { vehiculo: '', placa: '', cliente: '', telefono: '', descripcion: '', tecnicoId: '' };
const LINEA = { tipo: 'SERVICIO', servicio: '', productoId: '', cantidad: '1', precioUnitario: '' };
const FILTROS = { estado: '', tecnicoId: '', desde: '', hasta: '' };

// Mismas transiciones que el proceso principal (workshop.service.js)
const ACCIONES = {
  PENDIENTE:  [{ estado: 'EN_PROCESO', label: 'Iniciar', icon: 'ti-player-play' }],
  EN_PROCESO: [{ estado: 'COMPLETADA', label: 'Completar', icon: 'ti-check' }],
  COMPLETADA: [{ estado: 'EN_PROCESO', label: 'Reabrir', icon: 'ti-arrow-back-up' }],
};
const CANCELABLE = ['PENDIENTE', 'EN_PROCESO'];
const EDITABLE = ['PENDIENTE', 'EN_PROCESO'];

const BADGE = { FACTURADA: 'bg-green', COMPLETADA: 'bg-purple', EN_PROCESO: 'bg-blue', CANCELADA: 'bg-red', PENDIENTE: 'bg-yellow' };
const METODOS = ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'];

// Valida una línea de servicio/repuesto. `pedido` acumula cantidades por repuesto.
function validarLinea(it, productos, pedido = {}) {
  const cant = Number(it.cantidad);
  if (!Number.isInteger(cant) || cant < 1) return 'Cantidad inválida';
  if (it.tipo === 'REPUESTO') {
    const p = productos.find(pr => pr.id === Number(it.productoId));
    if (!p) return 'Seleccione un repuesto';
    pedido[p.id] = (pedido[p.id] || 0) + cant;
    if (pedido[p.id] > p.stock) return `Stock insuficiente (disponible: ${p.stock})`;
    return '';
  }
  if (!it.servicio.trim()) return 'Describa el servicio';
  if (it.precioUnitario === '' || Number(it.precioUnitario) < 0) return 'Indique el precio';
  return '';
}

const lineaParaApi = (it) => (it.tipo === 'REPUESTO'
  ? { productoId: Number(it.productoId), cantidad: Number(it.cantidad), servicio: it.servicio || undefined }
  : { servicio: it.servicio, cantidad: Number(it.cantidad), precioUnitario: Number(it.precioUnitario) });

// Fila de captura de una línea (usada al crear la orden y al agregar en el detalle)
function EditorLinea({ item, onChange, productos, mostrarEtiquetas, onQuitar }) {
  const p = productos.find(pr => pr.id === Number(item.productoId));
  const precio = item.tipo === 'REPUESTO' ? (p?.precioVenta ?? 0) : (parseFloat(item.precioUnitario) || 0);
  const set = (campo, valor) => onChange({ ...item, [campo]: valor, ...(campo === 'tipo' && { productoId: '', precioUnitario: '' }) });
  const et = (t) => (mostrarEtiquetas ? t : null);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `120px 2fr 74px 116px 110px${onQuitar ? ' 34px' : ''}`, gap: '8px', alignItems: 'end' }}>
      <Field label={et('Tipo')}>
        <select className="inp" value={item.tipo} onChange={e => set('tipo', e.target.value)}>
          <option value="SERVICIO">Servicio</option>
          <option value="REPUESTO">Repuesto</option>
        </select>
      </Field>
      {item.tipo === 'REPUESTO' ? (
        <Field label={et('Repuesto del inventario')}>
          <select className="inp" value={item.productoId} onChange={e => set('productoId', e.target.value)}>
            <option value="">Seleccione...</option>
            {productos.map(pr => (
              <option key={pr.id} value={pr.id} disabled={pr.stock <= 0}>{pr.nombre} — stock {pr.stock}</option>
            ))}
          </select>
        </Field>
      ) : (
        <Field label={et('Descripción del servicio')}>
          <input className="inp" value={item.servicio} placeholder="Ej: Cambio de aceite, mano de obra..." onChange={e => set('servicio', e.target.value)} />
        </Field>
      )}
      <Field label={et('Cant.')}>
        <input className="inp" type="number" min="1" max={p?.stock} value={item.cantidad} onChange={e => set('cantidad', e.target.value)} />
      </Field>
      <Field label={et('Precio (RD$)')}>
        {item.tipo === 'REPUESTO'
          ? <input className="inp" value={p ? p.precioVenta.toFixed(2) : ''} disabled title="Precio del inventario" />
          : <input className="inp" type="number" min="0" step="0.01" value={item.precioUnitario} onChange={e => set('precioUnitario', e.target.value)} />}
      </Field>
      <Field label={et('Importe')}>
        <div className="inp" style={{ background: '#f8fafc' }}>{rd(precio * (parseInt(item.cantidad) || 0))}</div>
      </Field>
      {onQuitar && (
        <button type="button" className="btn btn-ghost btn-sm" title="Quitar línea" onClick={onQuitar} style={{ height: '36px', padding: '0 8px' }}>
          <i className="ti ti-trash"></i>
        </button>
      )}
    </div>
  );
}

export default function WorkshopPage() {
  const { tieneRol, user } = useAuthStore();
  const { config } = useConfigStore();
  const emitirNcf = !!config?.emitirNcf;
  const puedeOperar = tieneRol(ROLES.ADMIN, ROLES.CAJERO);
  const esTecnico = tieneRol(ROLES.TECNICO);
  const puedeTrabajar = puedeOperar || esTecnico;

  const [ordenes, setOrdenes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [tecnicos, setTecnicos] = useState([]);
  const [filtro, setFiltro] = useState('');
  const [filtros, setFiltros] = useState(FILTROS);
  const [loading, setLoading] = useState(true);
  const [alerta, setAlerta] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const [modalNueva, setModalNueva] = useState(false);
  const [form, setForm] = useState(VACIO);
  const [items, setItems] = useState([LINEA]);
  const [errors, setErrors] = useState({});
  const [errorModal, setErrorModal] = useState('');

  const [detalle, setDetalle] = useState(null);       // orden abierta en el modal de detalle
  const [nuevaLinea, setNuevaLinea] = useState(LINEA);
  const [errorDetalle, setErrorDetalle] = useState('');
  const [cancelar, setCancelar] = useState(null);     // { orden, motivo, error }
  const [facturar, setFacturar] = useState(null);     // { orden, metodoPago, comprobante, error }
  const [factura, setFactura] = useState(null);

  useEffect(() => { cargar(); }, [filtros]);

  async function cargar() {
    setLoading(true);
    try {
      const [ords, prods, tecs] = await Promise.all([
        listarOrdenes({ ...filtros, tecnicoId: filtros.tecnicoId ? Number(filtros.tecnicoId) : undefined }),
        listarProductos(),
        listarTecnicos(),
      ]);
      setOrdenes(ords);
      setProductos(prods);
      setTecnicos(tecs);
      // Mantiene el detalle abierto sincronizado
      setDetalle(d => (d ? ords.find(o => o.id === d.id) || d : d));
    } catch (e) {
      setAlerta({ type: 'error', msg: e.message });
    } finally {
      setLoading(false);
    }
  }

  const totalNueva = items.reduce((s, it) => {
    const p = productos.find(pr => pr.id === Number(it.productoId));
    const precio = it.tipo === 'REPUESTO' ? (p?.precioVenta ?? 0) : (parseFloat(it.precioUnitario) || 0);
    return s + precio * (parseInt(it.cantidad) || 0);
  }, 0);

  function cerrarNueva() {
    setModalNueva(false);
    setForm(VACIO);
    setItems([LINEA]);
    setErrors({});
    setErrorModal('');
  }

  async function handleCrear() {
    const err = {};
    if (!form.vehiculo.trim()) err.vehiculo = 'El vehículo es requerido';
    if (!form.cliente.trim()) err.cliente = 'El cliente es requerido';
    if (form.telefono && !/^[0-9+()\-\s]{7,20}$/.test(form.telefono)) err.telefono = 'Teléfono no válido';
    const pedido = {};
    items.forEach((it, i) => {
      const m = validarLinea(it, productos, pedido);
      if (m) err[`item${i}`] = m;
    });
    setErrors(err);
    if (Object.keys(err).length) return;

    setGuardando(true);
    try {
      const orden = await crearOrden({
        ...form,
        tecnicoId: form.tecnicoId ? Number(form.tecnicoId) : null,
        items: items.map(lineaParaApi),
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
      setAlerta({ type: 'success', msg: `Orden #${orden.id} actualizada a ${estado.replace('_', ' ')}` });
      setCancelar(null);
      cargar();
    } catch (e) {
      if (cancelar) setCancelar(c => ({ ...c, error: e.message }));
      else setAlerta({ type: 'error', msg: e.message });
    }
  }

  // Operaciones dentro del detalle: devuelven la orden actualizada
  async function enDetalle(fn) {
    setGuardando(true);
    setErrorDetalle('');
    try {
      const orden = await fn();
      if (orden?.id) setDetalle(orden);
      cargar();
    } catch (e) {
      setErrorDetalle(e.message);
    } finally {
      setGuardando(false);
    }
  }

  function handleAgregarLinea() {
    const m = validarLinea(nuevaLinea, productos);
    if (m) return setErrorDetalle(m);
    return enDetalle(async () => {
      const orden = await agregarItem({ ordenId: detalle.id, item: lineaParaApi(nuevaLinea) });
      setNuevaLinea(LINEA);
      return orden;
    });
  }

  async function handleFacturar() {
    const error = validarComprobante(facturar.comprobante, emitirNcf);
    if (error) return setFacturar(f => ({ ...f, error }));
    setGuardando(true);
    try {
      const venta = await facturarOrden({
        ordenId: facturar.orden.id,
        metodoPago: facturar.metodoPago,
        ...datosComprobante(facturar.comprobante, emitirNcf),
      });
      setAlerta({ type: 'success', msg: `Orden #${facturar.orden.id} facturada (${venta.numeroFactura}${venta.ncf ? ` · NCF ${venta.ncf}` : ''})` });
      setFacturar(null);
      setFactura(venta);
      cargar();
    } catch (e) {
      setFacturar(f => ({ ...f, error: e.message }));
    } finally {
      setGuardando(false);
    }
  }

  const q = filtro.toLowerCase();
  const ordenesFiltradas = ordenes.filter(o =>
    o.vehiculo.toLowerCase().includes(q) ||
    o.cliente.toLowerCase().includes(q) ||
    (o.placa || '').toLowerCase().includes(q) ||
    String(o.id).includes(filtro));

  const facturadas = ordenes.filter(o => o.estado === 'FACTURADA');
  const abiertas = ordenes.filter(o => ['PENDIENTE', 'EN_PROCESO', 'COMPLETADA'].includes(o.estado)).length;
  const editable = detalle && EDITABLE.includes(detalle.estado);

  return (
    <PageLayout
      title={esTecnico ? 'Mis órdenes de trabajo' : 'Órdenes de trabajo'}
      subtitle={esTecnico ? `Órdenes asignadas a ${user?.nombre}` : 'Gestión y seguimiento de servicios del taller'}
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
          <div className="stat-label">Órdenes {filtros.estado || filtros.desde || filtros.tecnicoId ? 'filtradas' : 'totales'}</div>
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

      {/* RF-35: historial por estado, técnico y fecha */}
      <div className="card" style={{ padding: '12px 14px', marginBottom: '14px', display: 'grid', gridTemplateColumns: `2fr 1fr ${esTecnico ? '' : '1fr '}140px 140px auto`, gap: '10px', alignItems: 'end' }}>
        <Field label="Buscar">
          <input className="inp" placeholder="Vehículo, placa, cliente o # de OT" value={filtro} onChange={e => setFiltro(e.target.value)} />
        </Field>
        <Field label="Estado">
          <select className="inp" value={filtros.estado} onChange={e => setFiltros({ ...filtros, estado: e.target.value })}>
            <option value="">Todos</option>
            {Object.keys(BADGE).map(es => <option key={es} value={es}>{es.replace('_', ' ')}</option>)}
          </select>
        </Field>
        {!esTecnico && (
          <Field label="Técnico">
            <select className="inp" value={filtros.tecnicoId} onChange={e => setFiltros({ ...filtros, tecnicoId: e.target.value })}>
              <option value="">Todos</option>
              {tecnicos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </Field>
        )}
        <Field label="Desde">
          <input className="inp" type="date" value={filtros.desde} onChange={e => setFiltros({ ...filtros, desde: e.target.value })} />
        </Field>
        <Field label="Hasta">
          <input className="inp" type="date" value={filtros.hasta} onChange={e => setFiltros({ ...filtros, hasta: e.target.value })} />
        </Field>
        <button className="btn btn-ghost" onClick={() => { setFiltros(FILTROS); setFiltro(''); }}>Limpiar</button>
      </div>

      <div className="tbl-wrap">
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center' }}><Spinner /></div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th><th>Vehículo</th><th>Cliente</th><th>Técnico</th><th>Estado</th><th>Total</th><th>Fecha</th><th></th>
              </tr>
            </thead>
            <tbody>
              {ordenesFiltradas.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                    {esTecnico ? 'No tiene órdenes asignadas' : 'No se encontraron órdenes de trabajo'}
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
                  <td>{o.tecnico?.nombre || <span className="muted">Sin asignar</span>}</td>
                  <td><span className={`badge ${BADGE[o.estado] || 'bg-gray'}`}>{o.estado.replace('_', ' ')}</span></td>
                  <td className="td-bold">{rd(o.total)}</td>
                  <td style={{ color: '#64748b' }}>{fecha(o.fechaCreacion)}</td>
                  <td>
                    <div className="row-actions">
                      {puedeTrabajar && (ACCIONES[o.estado] || []).map(a => (
                        <button key={a.estado} className="btn btn-ghost btn-sm" onClick={() => handleEstado(o, a.estado)}>
                          <i className={`ti ${a.icon}`} style={{ fontSize: '12px' }}></i>{a.label}
                        </button>
                      ))}
                      {puedeOperar && o.estado === 'COMPLETADA' && (
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => setFacturar({ orden: o, metodoPago: 'EFECTIVO', comprobante: { ...COMPROBANTE_VACIO, clienteNombre: o.cliente } })}
                        >
                          <i className="ti ti-receipt" style={{ fontSize: '12px' }}></i>Facturar
                        </button>
                      )}
                      {puedeOperar && CANCELABLE.includes(o.estado) && (
                        <button className="btn btn-ghost btn-sm" style={{ color: '#dc2626' }} onClick={() => setCancelar({ orden: o, motivo: '' })} title="Cancelar orden">
                          <i className="ti ti-x" style={{ fontSize: '12px' }}></i>
                        </button>
                      )}
                      <button className="btn btn-ghost btn-sm" onClick={() => { setDetalle(o); setErrorDetalle(''); setNuevaLinea(LINEA); }} title="Ver y editar detalle">
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
        <div className="form-grid" style={{ marginBottom: '12px' }}>
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
          <Field label="Técnico asignado">
            <select className="inp" value={form.tecnicoId} onChange={e => setForm({ ...form, tecnicoId: e.target.value })}>
              <option value="">Sin asignar</option>
              {tecnicos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </Field>
          <Field label="Descripción del problema">
            <input className="inp" value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} />
          </Field>
        </div>

        <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155', margin: '6px 0 10px' }}>Servicios y repuestos</div>
        {items.map((it, i) => (
          <div key={i} style={{ marginBottom: '10px' }}>
            <EditorLinea
              item={it}
              productos={productos}
              mostrarEtiquetas={i === 0}
              onChange={(nuevo) => { setItems(prev => prev.map((x, idx) => (idx === i ? nuevo : x))); setErrors(er => ({ ...er, [`item${i}`]: '' })); }}
              onQuitar={items.length > 1 ? () => setItems(prev => prev.filter((_, idx) => idx !== i)) : null}
            />
            {errors[`item${i}`] && <span className="field-err">{errors[`item${i}`]}</span>}
          </div>
        ))}
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

      {/* Detalle: asignación de técnico y repuestos usados (RF-30) */}
      <Modal open={!!detalle} title={`Orden #${detalle?.id}`} onClose={() => setDetalle(null)} size="xl">
        {detalle && (
          <>
            {errorDetalle && <Alert type="error" message={errorDetalle} onClose={() => setErrorDetalle('')} />}
            <div className="form-grid" style={{ fontSize: '13px', marginBottom: '14px' }}>
              <div><span className="muted">Vehículo:</span> {detalle.vehiculo} {detalle.placa && `(${detalle.placa})`}</div>
              <div><span className="muted">Estado:</span> <span className={`badge ${BADGE[detalle.estado]}`}>{detalle.estado.replace('_', ' ')}</span></div>
              <div><span className="muted">Cliente:</span> {detalle.cliente} {detalle.telefono && `· ${detalle.telefono}`}</div>
              <div><span className="muted">Creada:</span> {fechaHora(detalle.fechaCreacion)} por {detalle.usuario?.nombre}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="muted">Técnico:</span>
                {puedeOperar && !['FACTURADA', 'CANCELADA'].includes(detalle.estado) ? (
                  <select
                    className="inp" style={{ maxWidth: '220px', padding: '5px 8px' }}
                    value={detalle.tecnico?.id || ''}
                    disabled={guardando}
                    onChange={e => enDetalle(() => asignarTecnico({ ordenId: detalle.id, tecnicoId: e.target.value ? Number(e.target.value) : null }))}
                  >
                    <option value="">Sin asignar</option>
                    {tecnicos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                  </select>
                ) : (detalle.tecnico?.nombre || 'Sin asignar')}
              </div>
              {detalle.venta && (
                <div>
                  <span className="muted">Factura:</span> {detalle.venta.numeroFactura}{detalle.venta.ncf && ` · NCF ${detalle.venta.ncf}`}{' '}
                  {puedeOperar && (
                    <button className="btn btn-ghost btn-sm" onClick={() => generarYAbrir(() => facturaPdf(detalle.venta.id)).catch(e => setErrorDetalle(e.message))}>
                      <i className="ti ti-file-type-pdf"></i>PDF
                    </button>
                  )}
                </div>
              )}
            </div>
            {detalle.descripcion && <p style={{ fontSize: '13px', marginBottom: '14px' }}><span className="muted">Problema:</span> {detalle.descripcion}</p>}

            <div className="tbl-wrap">
              <table>
                <thead><tr><th>Concepto</th><th>Tipo</th><th>Cant.</th><th>Precio</th><th>Importe</th><th></th></tr></thead>
                <tbody>
                  {detalle.detalles.map(d => (
                    <tr key={d.id}>
                      <td>{d.servicio}</td>
                      <td><span className={`badge ${d.productoId ? 'bg-blue' : 'bg-gray'}`}>{d.productoId ? 'Repuesto' : 'Servicio'}</span></td>
                      <td>{d.cantidad}</td>
                      <td>{rd(d.precioUnitario)}</td>
                      <td className="td-bold">{rd(d.subtotal)}</td>
                      <td>
                        {puedeTrabajar && editable && detalle.detalles.length > 1 && (
                          <button
                            className="btn btn-ghost btn-sm" style={{ color: '#dc2626' }} disabled={guardando}
                            title={d.productoId ? 'Quitar (el repuesto vuelve al inventario)' : 'Quitar'}
                            onClick={() => enDetalle(() => quitarItem({ ordenId: detalle.id, detalleId: d.id }))}
                          >
                            <i className="ti ti-trash" style={{ fontSize: '12px' }}></i>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ textAlign: 'right', fontWeight: 700, fontSize: '15px', margin: '10px 0' }}>Total: {rd(detalle.total)}</div>

            {puedeTrabajar && editable && (
              <div className="card" style={{ padding: '12px', background: '#f8fafc' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                  Registrar repuesto o servicio utilizado
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'end' }}>
                  <div style={{ flex: 1 }}>
                    <EditorLinea item={nuevaLinea} productos={productos} mostrarEtiquetas onChange={(v) => { setNuevaLinea(v); setErrorDetalle(''); }} />
                  </div>
                  <button className="btn btn-dark" onClick={handleAgregarLinea} disabled={guardando} style={{ height: '38px' }}>
                    <i className="ti ti-plus"></i>Agregar
                  </button>
                </div>
              </div>
            )}
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
              <button className="btn btn-danger" disabled={!cancelar.motivo.trim()} onClick={() => handleEstado(cancelar.orden, 'CANCELADA', cancelar.motivo.trim())}>
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
              <p style={{ fontSize: '12px', color: '#64748b' }}>Total de la orden</p>
              <p style={{ fontSize: '28px', fontWeight: 700, color: '#1e3a5f' }}>{rd(facturar.orden.total)}</p>
              <p style={{ fontSize: '11px', color: '#64748b' }}>
                {config?.preciosIncluyenItbis === false ? `Se agregará ITBIS (${Math.round(config.tasaItbis * 100)}%)` : 'ITBIS incluido en los precios'}
              </p>
            </div>
            <label className="lbl">Método de pago</label>
            {METODOS.map(m => (
              <button key={m} className={`method-btn ${facturar.metodoPago === m ? 'sel' : ''}`} onClick={() => setFacturar(f => ({ ...f, metodoPago: m }))}>
                {m}
              </button>
            ))}
            <div style={{ marginTop: '10px' }}>
              <ComprobanteFields
                valor={facturar.comprobante}
                emitirNcf={emitirNcf}
                onChange={(c) => setFacturar(f => ({ ...f, comprobante: c, error: '' }))}
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setFacturar(null)}>Cancelar</button>
              <button className="btn btn-dark" onClick={handleFacturar} disabled={guardando}>{guardando ? 'Procesando...' : 'Confirmar factura'}</button>
            </div>
          </>
        )}
      </Modal>

      <Receipt venta={factura} onClose={() => setFactura(null)} titulo="Orden facturada" />
    </PageLayout>
  );
}
