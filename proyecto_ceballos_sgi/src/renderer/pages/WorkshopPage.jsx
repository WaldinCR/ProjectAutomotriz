import { useState, useEffect } from 'react';
import PageLayout from '../components/PageLayout';
import Modal from '../components/Modal';
import Alert from '../components/Alert';
import Spinner from '../components/Spinner';
import { crearOrden, listarOrdenes, cambiarEstado } from '../services/workshopService';
import { listarProductos } from '../services/inventoryService';
import { useAuthStore } from '../store/authStore';

const ESTADOS = ['PENDIENTE', 'EN_PROCESO', 'COMPLETADA', 'FACTURADA'];
const EMPTY = { vehiculo: '', cliente: '', telefono: '', descripcion: '' };

export default function WorkshopPage() {
  const { user } = useAuthStore();
  const [ordenes, setOrdenes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [filtro, setFiltro] = useState('');
  const [loading, setLoading] = useState(true);
  const [alerta, setAlerta] = useState(null);
  const [modalNueva, setModalNueva] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [items, setItems] = useState([{ servicio: '', productoId: '', cantidad: 1, precioUnitario: '', subtotal: 0 }]);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setLoading(true);
    try {
      const [ords, prods] = await Promise.all([listarOrdenes(), listarProductos()]);
      setOrdenes(ords || []);
      setProductos(prods || []);
    } catch {
      setAlerta({ type: 'error', msg: 'Error al cargar órdenes de trabajo' });
    } finally {
      setLoading(false);
    }
  }

  function updateItem(i, field, value) {
    setItems(prev => prev.map((it, idx) => {
      if (idx !== i) return it;
      const u = { ...it, [field]: value };
      if (field === 'productoId' && value) {
        const p = productos.find(prod => prod.id === parseInt(value));
        if (p) {
          u.precioUnitario = p.precioVenta;
          u.servicio = p.nombre;
          u.subtotal = p.precioVenta * (parseInt(u.cantidad) || 1);
        }
      }
      if (field === 'cantidad' || field === 'precioUnitario') {
        u.subtotal = (parseFloat(u.precioUnitario) || 0) * (parseInt(u.cantidad) || 1);
      }
      return u;
    }));
  }

  async function handleCrear() {
    const newErrors = {};
    if (!form.vehiculo || !form.vehiculo.trim()) newErrors.vehiculo = 'El vehículo es requerido';
    if (!form.cliente || !form.cliente.trim()) newErrors.cliente = 'El cliente es requerido';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      await crearOrden({
        ...form,
        usuarioId: user.id,
        items: items.map(i => ({
          ...i,
          productoId: i.productoId ? parseInt(i.productoId) : null,
          cantidad: parseInt(i.cantidad) || 1,
          precioUnitario: parseFloat(i.precioUnitario) || 0,
        }))
      });
      setAlerta({ type: 'success', msg: 'Orden de trabajo creada' });
      setModalNueva(false);
      setForm(EMPTY);
      setErrors({});
      setItems([{ servicio: '', productoId: '', cantidad: 1, precioUnitario: '', subtotal: 0 }]);
      cargar();
    } catch (e) {
      setAlerta({ type: 'error', msg: e.message });
    }
  }

  async function handleEstado(ordenId, estado) {
    try {
      await cambiarEstado({ ordenId, estado, usuarioId: user.id });
      cargar();
    } catch (e) {
      setAlerta({ type: 'error', msg: e.message });
    }
  }

  const ordenesFiltradas = ordenes.filter(o =>
    (o.vehiculo || '').toLowerCase().includes(filtro.toLowerCase()) ||
    (o.cliente || '').toLowerCase().includes(filtro.toLowerCase()) ||
    String(o.id).includes(filtro)
  );

  const totalFacturado = ordenes
    .filter(o => o.estado === 'FACTURADA')
    .reduce((sum, o) => sum + (o.total || 0), 0);
  const facturadasCount = ordenes.filter(o => o.estado === 'FACTURADA').length;
  const pendientesCount = ordenes.filter(o => o.estado === 'PENDIENTE').length;

  function getBadgeClass(estado) {
    switch (estado) {
      case 'FACTURADA': return 'bg-green';
      case 'COMPLETADA': return 'bg-purple';
      case 'EN_PROCESO': return 'bg-blue';
      default: return 'bg-yellow';
    }
  }

  return (
    <PageLayout
      title="Órdenes de trabajo"
      subtitle="Gestión y seguimiento de servicios del taller"
      icon="ti-tool"
      actions={
        <button className="btn btn-dark" onClick={() => setModalNueva(true)}>
          <i className="ti ti-plus"></i>Nueva OT
        </button>
      }
    >
      {alerta && (
        <div style={{ marginBottom: '14px' }}>
          <Alert type={alerta.type} message={alerta.msg} onClose={() => setAlerta(null)} />
        </div>
      )}

      {/* Stats row */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-icon-wrap" style={{ background: '#dbeafe' }}>
            <i className="ti ti-clipboard-list" style={{ color: '#1e40af' }}></i>
          </div>
          <div className="stat-val">{ordenes.length}</div>
          <div className="stat-label">Órdenes totales</div>
          <div className="stat-bar" style={{ background: '#bfdbfe' }}></div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrap" style={{ background: '#dcfce7' }}>
            <i className="ti ti-circle-check" style={{ color: '#166534' }}></i>
          </div>
          <div className="stat-val">{facturadasCount}</div>
          <div className="stat-label">Facturadas</div>
          <div className="stat-bar" style={{ background: '#86efac' }}></div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrap" style={{ background: '#fef9c3' }}>
            <i className="ti ti-clock" style={{ color: '#854d0e' }}></i>
          </div>
          <div className="stat-val">{pendientesCount}</div>
          <div className="stat-label">Pendientes</div>
          <div className="stat-bar" style={{ background: '#fde047' }}></div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrap" style={{ background: '#ede9fe' }}>
            <i className="ti ti-currency-dollar" style={{ color: '#5b21b6' }}></i>
          </div>
          <div className="stat-val" style={{ fontSize: '18px' }}>RD$ {totalFacturado.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</div>
          <div className="stat-label">Total facturado</div>
          <div className="stat-bar" style={{ background: '#c4b5fd' }}></div>
        </div>
      </div>

      {/* Search row */}
      <div className="search-row">
        <i className="ti ti-search"></i>
        <input
          type="text"
          placeholder="Buscar por vehículo, cliente o número de OT..."
          value={filtro}
          onChange={e => setFiltro(e.target.value)}
        />
        <i className="ti ti-calendar" style={{ color: '#94a3b8' }}></i>
      </div>

      {/* Table */}
      <div className="tbl-wrap">
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <Spinner />
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Vehículo</th>
                <th>Cliente</th>
                <th>Teléfono</th>
                <th>Estado</th>
                <th>Total</th>
                <th>Fecha</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ordenesFiltradas.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                    No se encontraron órdenes de trabajo
                  </td>
                </tr>
              ) : (
                ordenesFiltradas.map(o => {
                  const proxIdx = ESTADOS.indexOf(o.estado) + 1;
                  const puedeAvanzar = proxIdx < ESTADOS.length;
                  return (
                    <tr key={o.id}>
                      <td className="td-accent">#{o.id}</td>
                      <td>{o.vehiculo}</td>
                      <td>{o.cliente}</td>
                      <td style={{ color: '#64748b' }}>{o.telefono || '—'}</td>
                      <td>
                        <span className={`badge ${getBadgeClass(o.estado)}`}>
                          {o.estado}
                        </span>
                      </td>
                      <td className="td-bold">RD$ {o.total.toFixed(2)}</td>
                      <td style={{ color: '#64748b' }}>
                        {new Date(o.fechaCreacion).toLocaleDateString('es-DO')}
                      </td>
                      <td>
                        {puedeAvanzar && (
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleEstado(o.id, ESTADOS[proxIdx])}
                          >
                            <i className="ti ti-arrow-right" style={{ fontSize: '13px' }}></i>
                            {ESTADOS[proxIdx]}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Nueva OT */}
      <Modal open={modalNueva} title="Nueva Orden de Trabajo" onClose={() => { setModalNueva(false); setErrors({}); }} size="xl">
        <div style={{ padding: '8px 0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
            <div>
              <label className="lbl">Vehículo (ej: Toyota Corolla 2018)</label>
              <input
                className="inp"
                value={form.vehiculo}
                onChange={e => { setForm({ ...form, vehiculo: e.target.value }); setErrors({ ...errors, vehiculo: '' }); }}
              />
              {errors.vehiculo && <span style={{ color: '#dc2626', fontSize: '11px' }}>{errors.vehiculo}</span>}
            </div>
            <div>
              <label className="lbl">Cliente</label>
              <input
                className="inp"
                value={form.cliente}
                onChange={e => { setForm({ ...form, cliente: e.target.value }); setErrors({ ...errors, cliente: '' }); }}
              />
              {errors.cliente && <span style={{ color: '#dc2626', fontSize: '11px' }}>{errors.cliente}</span>}
            </div>
            <div>
              <label className="lbl">Teléfono</label>
              <input
                className="inp"
                value={form.telefono}
                onChange={e => setForm({ ...form, telefono: e.target.value })}
              />
            </div>
            <div>
              <label className="lbl">Descripción del problema</label>
              <input
                className="inp"
                value={form.descripcion}
                onChange={e => setForm({ ...form, descripcion: e.target.value })}
              />
            </div>
          </div>

          <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '10px' }}>
            Servicios y Repuestos
          </div>

          {items.map((item, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr', gap: '10px', marginBottom: '10px', alignItems: 'end' }}>
              <div>
                <label className="lbl">Servicio</label>
                <input
                  className="inp"
                  value={item.servicio}
                  placeholder="Descripción del servicio"
                  onChange={e => updateItem(i, 'servicio', e.target.value)}
                />
              </div>
              <div>
                <label className="lbl">Repuesto del inventario</label>
                <select
                  className="inp"
                  value={item.productoId}
                  onChange={e => updateItem(i, 'productoId', e.target.value)}
                >
                  <option value="">Sin repuesto</option>
                  {productos.map(p => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="lbl">Cant.</label>
                <input
                  className="inp"
                  type="number"
                  min="1"
                  value={item.cantidad}
                  onChange={e => updateItem(i, 'cantidad', e.target.value)}
                />
              </div>
              <div>
                <label className="lbl">Precio (RD$)</label>
                <input
                  className="inp"
                  type="number"
                  value={item.precioUnitario}
                  onChange={e => updateItem(i, 'precioUnitario', e.target.value)}
                />
              </div>
            </div>
          ))}

          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ marginBottom: '16px' }}
            onClick={() => setItems([...items, { servicio: '', productoId: '', cantidad: 1, precioUnitario: '', subtotal: 0 }])}
          >
            <i className="ti ti-plus"></i>Agregar línea
          </button>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '14px', borderTop: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#1e3a5f' }}>
              Total: RD$ {items.reduce((s, i) => s + (parseFloat(i.subtotal) || 0), 0).toFixed(2)}
            </span>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-ghost" onClick={() => setModalNueva(false)}>Cancelar</button>
              <button className="btn btn-dark" onClick={handleCrear}>Crear Orden</button>
            </div>
          </div>
        </div>
      </Modal>
    </PageLayout>
  );
}
