import { useState, useEffect } from 'react';
import PageLayout from '../components/PageLayout';
import Button from '../components/Button';
import Input from '../components/Input';
import Modal from '../components/Modal';
import Table from '../components/Table';
import Alert from '../components/Alert';
import Badge from '../components/Badge';
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
      setOrdenes(ords); setProductos(prods);
    } catch { setAlerta({ type: 'error', msg: 'Error al cargar' }); }
    finally { setLoading(false); }
  }

  function updateItem(i, field, value) {
    setItems(prev => prev.map((it, idx) => {
      if (idx !== i) return it;
      const u = { ...it, [field]: value };
      if (u.error && u.error[field]) {
        u.error = { ...u.error, [field]: '' };
      }
      if (field === 'productoId' && value) {
        const p = productos.find(p => p.id === parseInt(value));
        if (p) { u.precioUnitario = p.precioVenta; u.servicio = p.nombre; u.subtotal = p.precioVenta * (parseInt(u.cantidad) || 1); }
      }
      if (field === 'cantidad' || field === 'precioUnitario')
        u.subtotal = (parseFloat(u.precioUnitario) || 0) * (parseInt(u.cantidad) || 1);
      return u;
    }));
  }

  async function handleCrear() {
    // Validaciones locales obligatorias en el frontend
    const newErrors = {};
    if (!form.vehiculo || !form.vehiculo.trim()) {
      newErrors.vehiculo = 'El vehículo es requerido';
    }
    if (!form.cliente || !form.cliente.trim()) {
      newErrors.cliente = 'El cliente es requerido';
    }

    let itemsError = false;
    const validatedItems = items.map(item => {
      const err = {};
      if (!item.servicio || !item.servicio.trim()) {
        err.servicio = 'El servicio o repuesto es requerido';
        itemsError = true;
      }
      if (item.cantidad === undefined || item.cantidad === null || isNaN(Number(item.cantidad)) || Number(item.cantidad) <= 0) {
        err.cantidad = 'Debe ser mayor a 0';
        itemsError = true;
      }
      if (item.precioUnitario === undefined || item.precioUnitario === null || isNaN(Number(item.precioUnitario)) || Number(item.precioUnitario) < 0) {
        err.precioUnitario = 'Precio no válido';
        itemsError = true;
      }
      return { ...item, error: err };
    });

    if (Object.keys(newErrors).length > 0 || itemsError) {
      setErrors(newErrors);
      setItems(validatedItems);
      return;
    }

    try {
      await crearOrden({
        ...form, usuarioId: user.id,
        items: items.map(i => ({
          ...i, productoId: i.productoId ? parseInt(i.productoId) : null,
          cantidad: parseInt(i.cantidad), precioUnitario: parseFloat(i.precioUnitario),
        }))
      });
      setAlerta({ type: 'success', msg: 'Orden de trabajo creada' });
      setModalNueva(false); setForm(EMPTY); setErrors({});
      setItems([{ servicio: '', productoId: '', cantidad: 1, precioUnitario: '', subtotal: 0 }]);
      cargar();
    } catch (e) { setAlerta({ type: 'error', msg: e.message }); }
  }

  async function handleEstado(ordenId, estado) {
    try { await cambiarEstado({ ordenId, estado, usuarioId: user.id }); cargar(); }
    catch (e) { setAlerta({ type: 'error', msg: e.message }); }
  }

  const rows = ordenes.map(o => [
    `#${o.id}`, o.vehiculo, o.cliente, o.telefono || '—',
    <Badge label={o.estado} />,
    `RD$ ${o.total.toFixed(2)}`,
    new Date(o.fechaCreacion).toLocaleDateString('es-DO'),
    ESTADOS.indexOf(o.estado) < ESTADOS.length - 1 && (
      <Button size="sm" variant="warning"
        onClick={() => handleEstado(o.id, ESTADOS[ESTADOS.indexOf(o.estado) + 1])}>
        ▶ {ESTADOS[ESTADOS.indexOf(o.estado) + 1]}
      </Button>
    )
  ]);

  return (
    <PageLayout title="🔧 Órdenes de Trabajo" actions={<Button onClick={() => setModalNueva(true)}>+ Nueva OT</Button>}>
      {alerta && <Alert type={alerta.type} message={alerta.msg} onClose={() => setAlerta(null)} />}
      {loading ? <Spinner /> : <Table headers={['#', 'Vehículo', 'Cliente', 'Tel.', 'Estado', 'Total', 'Fecha', '']} rows={rows} />}
      <Modal open={modalNueva} title="Nueva Orden de Trabajo" onClose={() => { setModalNueva(false); setErrors({}); }} size="xl">
        <div className="grid grid-cols-2 gap-4 mb-4">
          {[['vehiculo', 'Vehículo (ej: Toyota Corolla 2018)'], ['cliente', 'Cliente'],
          ['telefono', 'Teléfono'], ['descripcion', 'Descripción del problema']].map(([k, l]) => (
            <Input
              key={k}
              label={l}
              value={form[k]}
              error={errors[k]}
              onChange={e => {
                setForm({ ...form, [k]: e.target.value });
                setErrors(prev => ({ ...prev, [k]: '' }));
              }}
            />
          ))}
        </div>
        <h3 className="font-semibold text-gray-700 mb-2">Servicios y Repuestos</h3>
        {items.map((item, i) => (
          <div key={i} className="grid grid-cols-5 gap-2 mb-2 items-start">
            <div className="col-span-2">
              <Input
                label="Servicio"
                value={item.servicio}
                error={item.error?.servicio}
                onChange={e => updateItem(i, 'servicio', e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Repuesto</label>
              <select className="border border-slate-200 rounded-xl px-2 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#111827]/10" value={item.productoId}
                onChange={e => updateItem(i, 'productoId', e.target.value)}>
                <option value="">Sin repuesto</option>
                {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            <Input
              label="Cant."
              type="number"
              value={item.cantidad}
              error={item.error?.cantidad}
              onChange={e => updateItem(i, 'cantidad', e.target.value)}
            />
            <Input
              label="Precio"
              type="number"
              value={item.precioUnitario}
              error={item.error?.precioUnitario}
              onChange={e => updateItem(i, 'precioUnitario', e.target.value)}
            />
          </div>
        ))}
        <Button variant="ghost" size="sm"
          onClick={() => setItems([...items, { servicio: '', productoId: '', cantidad: 1, precioUnitario: '', subtotal: 0 }])}>
          + Agregar línea
        </Button>
        <div className="flex justify-between items-center mt-4 pt-4 border-t">
          <span className="font-bold text-lg">Total: RD$ {items.reduce((s, i) => s + (parseFloat(i.subtotal) || 0), 0).toFixed(2)}</span>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setModalNueva(false)}>Cancelar</Button>
            <Button onClick={handleCrear}>Crear Orden</Button>
          </div>
        </div>
      </Modal>
    </PageLayout>
  );
}
