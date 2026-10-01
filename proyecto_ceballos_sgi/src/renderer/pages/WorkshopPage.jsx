import { useState, useEffect } from 'react';
import PageLayout from '../components/PageLayout';
import Alert from '../components/Alert';
import { listarOrdenes, crearOrden, cambiarEstado } from '../services/workshopService';
import { useAuthStore } from '../store/authStore';

const DEFAULT_ORDERS = [
  { id: 'OT-284', vehiculo: 'Toyota Hilux 2018', cliente: 'José Martínez', telefono: '809-555-1820', estado: 'EN_PROCESO', total: 8450, fecha: '01 oct. 2026' },
  { id: 'OT-283', vehiculo: 'Kia Sportage 2020', cliente: 'Ana Ramírez', telefono: '809-555-4916', estado: 'COMPLETADA', total: 12600, fecha: '01 oct. 2026' },
  { id: 'OT-282', vehiculo: 'Honda Civic 2015', cliente: 'Carlos Peña', telefono: '809-555-7721', estado: 'FACTURADA', total: 5350, fecha: '30 sep. 2026' },
];

export default function WorkshopPage() {
  const { user } = useAuthStore();
  const [ordenes, setOrdenes] = useState([]);
  const [search, setSearch] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [alerta, setAlerta] = useState(null);
  const [modalNueva, setModalNueva] = useState(false);
  const [form, setForm] = useState({
    vehiculo: '',
    cliente: '',
    telefono: '',
    total: '',
    estado: 'EN_PROCESO',
  });

  useEffect(() => {
    cargarOrdenes();
  }, []);

  async function cargarOrdenes() {
    try {
      if (window.api?.workshop?.listarOrdenes) {
        const res = await listarOrdenes();
        if (res && res.length > 0) {
          setOrdenes(res.map(o => ({
            id: `OT-${o.id}`,
            realId: o.id,
            vehiculo: o.vehiculo,
            cliente: o.cliente,
            telefono: o.telefono || '—',
            estado: o.estado,
            total: o.total || 0,
            fecha: new Date(o.createdAt).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' }),
          })));
          return;
        }
      }
      setOrdenes(DEFAULT_ORDERS);
    } catch {
      setOrdenes(DEFAULT_ORDERS);
    }
  }

  function formatMoney(amount) {
    return 'RD$ ' + Number(amount || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function getStatusBadge(estado) {
    if (estado === 'EN_PROCESO' || estado === 'En proceso') {
      return <span className="status process">En proceso</span>;
    }
    if (estado === 'COMPLETADA' || estado === 'Listo') {
      return <span className="status ready">Listo</span>;
    }
    return <span className="status closed">Cerrada</span>;
  }

  async function handleCrearOrden(e) {
    e.preventDefault();
    if (!form.vehiculo || !form.cliente) {
      setAlerta({ type: 'warning', message: 'Completa los campos obligatorios.' });
      return;
    }

    try {
      if (window.api?.workshop?.crearOrden) {
        await crearOrden({
          vehiculo: form.vehiculo,
          cliente: form.cliente,
          telefono: form.telefono,
          descripcion: 'Servicio registrado desde vista rápida',
          usuarioId: user?.id,
          items: [{
            servicio: 'Servicio general',
            cantidad: 1,
            precioUnitario: parseFloat(form.total) || 0,
            subtotal: parseFloat(form.total) || 0,
          }],
        });
      }
      const nueva = {
        id: `OT-${Math.floor(285 + Math.random() * 50)}`,
        vehiculo: form.vehiculo,
        cliente: form.cliente,
        telefono: form.telefono || '—',
        estado: form.estado,
        total: parseFloat(form.total) || 0,
        fecha: new Date().toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' }),
      };
      setOrdenes(prev => [nueva, ...prev]);
      setModalNueva(false);
      setForm({ vehiculo: '', cliente: '', telefono: '', total: '', estado: 'EN_PROCESO' });
      setAlerta({ type: 'success', message: 'Orden de trabajo creada exitosamente.' });
    } catch (err) {
      setAlerta({ type: 'error', message: err.message || 'Error al crear la orden.' });
    }
  }

  const ordenesFiltradas = ordenes.filter(o => {
    const q = search.toLowerCase();
    const matchSearch =
      (o.vehiculo || '').toLowerCase().includes(q) ||
      (o.cliente || '').toLowerCase().includes(q) ||
      (o.telefono || '').toLowerCase().includes(q) ||
      (o.id || '').toLowerCase().includes(q);

    if (!matchSearch) return false;
    if (!estadoFiltro) return true;
    if (estadoFiltro === 'En proceso') return o.estado === 'EN_PROCESO' || o.estado === 'En proceso';
    if (estadoFiltro === 'Listo') return o.estado === 'COMPLETADA' || o.estado === 'Listo';
    if (estadoFiltro === 'Cerrada') return o.estado === 'FACTURADA' || o.estado === 'Cerrada';
    return true;
  });

  return (
    <PageLayout
      title="Órdenes de Trabajo"
      subtitle="Seguimiento operativo de servicios, diagnósticos y reparaciones."
      actions={
        <button
          className="primary-btn"
          type="button"
          onClick={() => setModalNueva(true)}
        >
          <i className="ti ti-plus"></i> Nueva orden
        </button>
      }
    >
      {alerta && (
        <div style={{ marginBottom: '16px' }}>
          <Alert type={alerta.type} message={alerta.message} onClose={() => setAlerta(null)} />
        </div>
      )}

      {/* Filtros */}
      <div className="filters">
        <div className="search-box">
          <i className="ti ti-search"></i>
          <input
            type="search"
            placeholder="Buscar cliente, vehículo o teléfono"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="select-control"
          value={estadoFiltro}
          onChange={e => setEstadoFiltro(e.target.value)}
        >
          <option value="">Todos los estados</option>
          <option value="En proceso">En proceso</option>
          <option value="Listo">Listo</option>
          <option value="Cerrada">Cerrada</option>
        </select>
      </div>

      {/* Tabla */}
      <div className="card table-card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>OT</th>
                <th>Vehículo</th>
                <th>Cliente</th>
                <th>Teléfono</th>
                <th>Estado</th>
                <th>Total</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {ordenesFiltradas.map(o => (
                <tr key={o.id}>
                  <td style={{ fontWeight: 700, color: 'var(--blue)' }}>{o.id}</td>
                  <td>{o.vehiculo}</td>
                  <td>{o.cliente}</td>
                  <td>{o.telefono}</td>
                  <td>{getStatusBadge(o.estado)}</td>
                  <td style={{ fontWeight: 700 }}>{formatMoney(o.total)}</td>
                  <td>{o.fecha}</td>
                </tr>
              ))}
              {ordenesFiltradas.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: 'var(--muted)' }}>
                    No se encontraron órdenes de trabajo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Nueva Orden */}
      {modalNueva && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <form className="modal-dialog" onSubmit={handleCrearOrden}>
            <div className="modal-head">
              <h2>Nueva orden de trabajo</h2>
              <button
                className="icon-btn"
                type="button"
                onClick={() => setModalNueva(false)}
                title="Cerrar"
              >
                <i className="ti ti-x"></i>
              </button>
            </div>
            <div className="modal-grid">
              <div>
                <label htmlFor="ot-vehicle">Vehículo</label>
                <input
                  id="ot-vehicle"
                  required
                  placeholder="Ej. Toyota Corolla 2016"
                  value={form.vehiculo}
                  onChange={e => setForm({ ...form, vehiculo: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="ot-client">Cliente</label>
                <input
                  id="ot-client"
                  required
                  placeholder="Nombre completo"
                  value={form.cliente}
                  onChange={e => setForm({ ...form, cliente: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="ot-phone">Teléfono</label>
                <input
                  id="ot-phone"
                  required
                  placeholder="809-000-0000"
                  value={form.telefono}
                  onChange={e => setForm({ ...form, telefono: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="ot-total">Total estimado</label>
                <input
                  id="ot-total"
                  type="number"
                  min="0"
                  required
                  placeholder="0.00"
                  value={form.total}
                  onChange={e => setForm({ ...form, total: e.target.value })}
                />
              </div>
              <div className="full">
                <label htmlFor="ot-status">Estado inicial</label>
                <select
                  id="ot-status"
                  value={form.estado}
                  onChange={e => setForm({ ...form, estado: e.target.value })}
                >
                  <option value="EN_PROCESO">En proceso</option>
                  <option value="COMPLETADA">Listo</option>
                </select>
              </div>
            </div>
            <div className="modal-actions">
              <button
                className="secondary-btn"
                type="button"
                onClick={() => setModalNueva(false)}
              >
                Cancelar
              </button>
              <button className="primary-btn" type="submit">
                Crear orden
              </button>
            </div>
          </form>
        </div>
      )}
    </PageLayout>
  );
}
