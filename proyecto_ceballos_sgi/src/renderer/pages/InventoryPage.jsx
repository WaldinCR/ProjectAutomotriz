import { useState, useEffect } from 'react';
import PageLayout from '../components/PageLayout';
import Modal from '../components/Modal';
import Alert from '../components/Alert';
import Spinner from '../components/Spinner';
import { listarProductos, crearProducto, registrarEntrada } from '../services/inventoryService';
import { useAuthStore } from '../store/authStore';

const EMPTY = { nombre: '', codigoBarras: '', categoria: '', precioCompra: '', precioVenta: '', stock: '', stockMinimo: '5' };

export default function InventoryPage() {
  const { user } = useAuthStore();
  const [productos, setProductos] = useState([]);
  const [filtro, setFiltro] = useState('');
  const [loading, setLoading] = useState(true);
  const [alerta, setAlerta] = useState(null);
  const [modalNuevo, setModalNuevo] = useState(false);
  const [modalEntrada, setModalEntrada] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [entrada, setEntrada] = useState({ cantidad: '', motivo: '' });
  const [entradaErrors, setEntradaErrors] = useState({});

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setLoading(true);
    try {
      setProductos(await listarProductos());
    } catch {
      setAlerta({ type: 'error', msg: 'Error al cargar productos' });
    } finally {
      setLoading(false);
    }
  }

  async function handleCrear() {
    const err = {};
    if (!form.nombre || !form.nombre.trim()) err.nombre = 'El nombre es requerido';
    if (!form.categoria || !form.categoria.trim()) err.categoria = 'La categoría es requerida';
    if (!form.precioCompra || isNaN(Number(form.precioCompra))) err.precioCompra = 'Precio inválido';
    if (!form.precioVenta || isNaN(Number(form.precioVenta))) err.precioVenta = 'Precio inválido';
    if (!form.stock || isNaN(Number(form.stock))) err.stock = 'Stock inválido';

    if (Object.keys(err).length > 0) {
      setErrors(err);
      return;
    }

    try {
      await crearProducto({
        ...form,
        precioCompra: parseFloat(form.precioCompra),
        precioVenta: parseFloat(form.precioVenta),
        stock: parseInt(form.stock),
        stockMinimo: parseInt(form.stockMinimo) || 5,
      });
      setAlerta({ type: 'success', msg: 'Producto creado' });
      setModalNuevo(false);
      setForm(EMPTY);
      setErrors({});
      cargar();
    } catch (e) {
      setAlerta({ type: 'error', msg: e.message });
    }
  }

  async function handleEntrada() {
    const err = {};
    if (!entrada.cantidad || isNaN(Number(entrada.cantidad)) || Number(entrada.cantidad) <= 0) {
      err.cantidad = 'Cantidad mayor a 0 requerida';
    }
    if (Object.keys(err).length > 0) {
      setEntradaErrors(err);
      return;
    }

    try {
      await registrarEntrada({
        productoId: modalEntrada.id,
        ...entrada,
        cantidad: parseInt(entrada.cantidad),
        usuarioId: user.id
      });
      setAlerta({ type: 'success', msg: 'Entrada registrada' });
      setModalEntrada(null);
      setEntrada({ cantidad: '', motivo: '' });
      setEntradaErrors({});
      cargar();
    } catch (e) {
      setAlerta({ type: 'error', msg: e.message });
    }
  }

  const filtrados = productos.filter(p =>
    (p.nombre || '').toLowerCase().includes(filtro.toLowerCase()) ||
    (p.codigoBarras || '').includes(filtro) ||
    (p.codigoInterno || '').toLowerCase().includes(filtro.toLowerCase()) ||
    (p.categoria || '').toLowerCase().includes(filtro.toLowerCase())
  );

  function getCategoryBadge(categoria) {
    const cat = (categoria || '').toLowerCase();
    if (cat.includes('lubricant')) return 'bg-blue';
    if (cat.includes('freno')) return 'bg-red';
    if (cat.includes('electr')) return 'bg-purple';
    if (cat.includes('ignic')) return 'bg-orange';
    return 'bg-gray';
  }

  return (
    <PageLayout
      title="Inventario"
      subtitle="Gestión y control de productos en stock"
      icon="ti-package"
      actions={
        <button className="btn btn-dark" onClick={() => setModalNuevo(true)}>
          <i className="ti ti-plus"></i>Nuevo producto
        </button>
      }
    >
      {alerta && (
        <div style={{ marginBottom: '14px' }}>
          <Alert type={alerta.type} message={alerta.msg} onClose={() => setAlerta(null)} />
        </div>
      )}

      {/* Search row */}
      <div className="search-row">
        <i className="ti ti-search"></i>
        <input
          type="text"
          placeholder="Buscar por nombre, código de barras..."
          value={filtro}
          onChange={e => setFiltro(e.target.value)}
        />
        <i className="ti ti-adjustments-horizontal" style={{ color: '#94a3b8' }}></i>
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
                <th>Cód. interno</th>
                <th>Cód. barras</th>
                <th>Nombre</th>
                <th>Categoría</th>
                <th>Precio</th>
                <th>Stock</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                    No hay productos disponibles
                  </td>
                </tr>
              ) : (
                filtrados.map(p => {
                  const stockOptimo = p.stock > 20;
                  const stockBajo = p.stock > 0 && p.stock <= 20;
                  const sinStock = p.stock <= 0;

                  return (
                    <tr key={p.id}>
                      <td className="td-mono">{p.codigoInterno}</td>
                      <td className="td-mono" style={{ color: p.codigoBarras ? '#64748b' : '#94a3b8' }}>
                        {p.codigoBarras || '—'}
                      </td>
                      <td className="td-bold">{p.nombre}</td>
                      <td>
                        <span className={`badge ${getCategoryBadge(p.categoria)}`}>
                          {p.categoria}
                        </span>
                      </td>
                      <td>RD$ {p.precioVenta.toFixed(2)}</td>
                      <td>
                        {stockOptimo && (
                          <span style={{ color: '#166534', fontWeight: 600 }}>{p.stock}</span>
                        )}
                        {stockBajo && (
                          <span style={{ color: '#b45309', fontWeight: 600 }}>
                            {p.stock} <i className="ti ti-alert-triangle" style={{ fontSize: '13px' }}></i>
                          </span>
                        )}
                        {sinStock && (
                          <span style={{ color: '#dc2626', fontWeight: 600 }}>0 (Agotado)</span>
                        )}
                      </td>
                      <td>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setModalEntrada(p)}
                        >
                          <i className="ti ti-plus" style={{ fontSize: '12px' }}></i>
                          Entrada
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Stock Legend */}
      <div style={{ display: 'flex', gap: '18px', marginTop: '12px', padding: '10px 16px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '9px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: '#475569' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#166534', display: 'inline-block' }}></span>
          Stock óptimo (&gt; 20)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: '#475569' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#b45309', display: 'inline-block' }}></span>
          Stock bajo (1–20)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: '#475569' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#dc2626', display: 'inline-block' }}></span>
          Sin stock
        </div>
      </div>

      {/* Modal Nuevo Producto */}
      <Modal open={modalNuevo} title="Nuevo Producto" onClose={() => setModalNuevo(false)} size="lg">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', padding: '8px 0' }}>
          <div>
            <label className="lbl">Nombre del producto</label>
            <input
              className="inp"
              value={form.nombre}
              onChange={e => { setForm({ ...form, nombre: e.target.value }); setErrors({ ...errors, nombre: '' }); }}
            />
            {errors.nombre && <span style={{ color: '#dc2626', fontSize: '11px' }}>{errors.nombre}</span>}
          </div>
          <div>
            <label className="lbl">Código de barras (opcional)</label>
            <input
              className="inp"
              value={form.codigoBarras}
              onChange={e => setForm({ ...form, codigoBarras: e.target.value })}
            />
          </div>
          <div>
            <label className="lbl">Categoría</label>
            <input
              className="inp"
              placeholder="Ej: Repuestos, Lubricantes, Frenos..."
              value={form.categoria}
              onChange={e => { setForm({ ...form, categoria: e.target.value }); setErrors({ ...errors, categoria: '' }); }}
            />
            {errors.categoria && <span style={{ color: '#dc2626', fontSize: '11px' }}>{errors.categoria}</span>}
          </div>
          <div>
            <label className="lbl">Precio Compra (RD$)</label>
            <input
              className="inp"
              type="number"
              value={form.precioCompra}
              onChange={e => setForm({ ...form, precioCompra: e.target.value })}
            />
          </div>
          <div>
            <label className="lbl">Precio Venta (RD$)</label>
            <input
              className="inp"
              type="number"
              value={form.precioVenta}
              onChange={e => setForm({ ...form, precioVenta: e.target.value })}
            />
          </div>
          <div>
            <label className="lbl">Stock Inicial</label>
            <input
              className="inp"
              type="number"
              value={form.stock}
              onChange={e => setForm({ ...form, stock: e.target.value })}
            />
          </div>
          <div>
            <label className="lbl">Stock Mínimo</label>
            <input
              className="inp"
              type="number"
              value={form.stockMinimo}
              onChange={e => setForm({ ...form, stockMinimo: e.target.value })}
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
          <button className="btn btn-ghost" onClick={() => setModalNuevo(false)}>Cancelar</button>
          <button className="btn btn-dark" onClick={handleCrear}>Guardar</button>
        </div>
      </Modal>

      {/* Modal Entrada de Stock */}
      <Modal open={!!modalEntrada} title={`Entrada de Stock: ${modalEntrada?.nombre}`} onClose={() => setModalEntrada(null)} size="sm">
        <div style={{ padding: '8px 0' }}>
          <div style={{ marginBottom: '12px' }}>
            <label className="lbl">Cantidad</label>
            <input
              className="inp"
              type="number"
              min="1"
              value={entrada.cantidad}
              onChange={e => { setEntrada({ ...entrada, cantidad: e.target.value }); setEntradaErrors({}); }}
              autoFocus
            />
            {entradaErrors.cantidad && <span style={{ color: '#dc2626', fontSize: '11px' }}>{entradaErrors.cantidad}</span>}
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label className="lbl">Motivo</label>
            <input
              className="inp"
              placeholder="Ej: Compra a proveedor..."
              value={entrada.motivo}
              onChange={e => setEntrada({ ...entrada, motivo: e.target.value })}
            />
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => setModalEntrada(null)}>Cancelar</button>
            <button className="btn btn-success" onClick={handleEntrada}>Registrar</button>
          </div>
        </div>
      </Modal>
    </PageLayout>
  );
}
