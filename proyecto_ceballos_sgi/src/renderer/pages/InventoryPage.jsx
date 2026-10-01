import { useState, useEffect } from 'react';
import PageLayout from '../components/PageLayout';
import Alert from '../components/Alert';
import { listarProductos, crearProducto, registrarEntrada } from '../services/inventoryService';
import { useAuthStore } from '../store/authStore';

const DEFAULT_PRODUCTS = [
  { id: '1', codigoInterno: 'FLT-102', nombre: 'Filtro de aceite', categoria: 'Filtros', precioVenta: 485, stock: 24, stockMinimo: 10 },
  { id: '2', codigoInterno: 'FRN-221', nombre: 'Pastillas de freno', categoria: 'Frenos', precioVenta: 2450, stock: 7, stockMinimo: 10 },
  { id: '3', codigoInterno: 'BAT-540', nombre: 'Batería 12V 60Ah', categoria: 'Eléctrico', precioVenta: 6950, stock: 9, stockMinimo: 10 },
  { id: '4', codigoInterno: 'ACM-330', nombre: 'Amortiguador delantero', categoria: 'Suspensión', precioVenta: 3850, stock: 5, stockMinimo: 8 },
  { id: '5', codigoInterno: 'BJI-120', nombre: 'Bujía iridium', categoria: 'Encendido', precioVenta: 640, stock: 32, stockMinimo: 15 },
  { id: '6', codigoInterno: 'ACE-15W', nombre: 'Aceite 15W-40 1L', categoria: 'Lubricantes', precioVenta: 520, stock: 46, stockMinimo: 20 },
];

export default function InventoryPage() {
  const { user } = useAuthStore();
  const [productos, setProductos] = useState([]);
  const [search, setSearch] = useState('');
  const [soloStockBajo, setSoloStockBajo] = useState(false);
  const [alerta, setAlerta] = useState(null);
  const [modalNuevo, setModalNuevo] = useState(false);
  const [modalEntrada, setModalEntrada] = useState(null);

  const [form, setForm] = useState({
    codigo: '',
    nombre: '',
    categoria: '',
    precio: '',
    stock: '',
  });

  const [formEntrada, setFormEntrada] = useState({
    cantidad: '',
    motivo: 'Compra de inventario',
  });

  useEffect(() => {
    cargarInventario();
  }, []);

  async function cargarInventario() {
    try {
      if (window.api?.inventory?.listarProductos) {
        const res = await listarProductos();
        if (res && res.length > 0) {
          setProductos(res);
          return;
        }
      }
      setProductos(DEFAULT_PRODUCTS);
    } catch {
      setProductos(DEFAULT_PRODUCTS);
    }
  }

  function formatMoney(amount) {
    return 'RD$ ' + Number(amount || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  async function handleCrearProducto(e) {
    e.preventDefault();
    if (!form.codigo || !form.nombre || !form.precio) {
      setAlerta({ type: 'warning', message: 'Completa los campos obligatorios.' });
      return;
    }

    try {
      if (window.api?.inventory?.crearProducto) {
        await crearProducto({
          codigoInterno: form.codigo,
          nombre: form.nombre,
          categoria: form.categoria || 'General',
          precioCompra: parseFloat(form.precio) * 0.7,
          precioVenta: parseFloat(form.precio),
          stock: parseInt(form.stock) || 0,
          stockMinimo: 10,
        });
      }
      const nuevo = {
        id: String(Date.now()),
        codigoInterno: form.codigo,
        nombre: form.nombre,
        categoria: form.categoria || 'General',
        precioVenta: parseFloat(form.precio),
        stock: parseInt(form.stock) || 0,
        stockMinimo: 10,
      };
      setProductos(prev => [nuevo, ...prev]);
      setModalNuevo(false);
      setForm({ codigo: '', nombre: '', categoria: '', precio: '', stock: '' });
      setAlerta({ type: 'success', message: 'Producto guardado exitosamente.' });
    } catch (err) {
      setAlerta({ type: 'error', message: err.message || 'Error al guardar el producto.' });
    }
  }

  async function handleRegistrarEntrada(e) {
    e.preventDefault();
    const qty = parseInt(formEntrada.cantidad);
    if (!qty || qty <= 0) {
      setAlerta({ type: 'warning', message: 'Ingresa una cantidad válida mayor a 0.' });
      return;
    }

    try {
      if (window.api?.inventory?.registrarEntrada && modalEntrada.id) {
        await registrarEntrada({
          productoId: modalEntrada.id,
          cantidad: qty,
          motivo: formEntrada.motivo,
          usuarioId: user?.id,
        });
      }
      setProductos(prev =>
        prev.map(p => (p.id === modalEntrada.id ? { ...p, stock: (p.stock || 0) + qty } : p))
      );
      setModalEntrada(null);
      setFormEntrada({ cantidad: '', motivo: 'Compra de inventario' });
      setAlerta({ type: 'success', message: `Se añadieron ${qty} unidades a ${modalEntrada.nombre}.` });
    } catch (err) {
      setAlerta({ type: 'error', message: err.message || 'Error al registrar entrada de stock.' });
    }
  }

  const productosFiltrados = productos.filter(p => {
    const q = search.toLowerCase();
    const matchSearch =
      (p.nombre || '').toLowerCase().includes(q) ||
      (p.codigoInterno || p.codigo || '').toLowerCase().includes(q) ||
      (p.categoria || '').toLowerCase().includes(q);

    if (!matchSearch) return false;
    if (soloStockBajo) {
      return (p.stock || 0) <= (p.stockMinimo || 10);
    }
    return true;
  });

  return (
    <PageLayout
      title="Inventario de Repuestos"
      subtitle="Control de existencias y entrada rápida de mercancía."
      actions={
        <button
          className="primary-btn"
          type="button"
          onClick={() => setModalNuevo(true)}
        >
          <i className="ti ti-plus"></i> Nuevo producto
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
            placeholder="Buscar producto, código o categoría"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button
          className={`secondary-btn ${soloStockBajo ? 'active' : ''}`}
          type="button"
          onClick={() => setSoloStockBajo(!soloStockBajo)}
        >
          <i className="ti ti-alert-triangle"></i> Stock bajo
        </button>
      </div>

      {/* Tabla */}
      <div className="card table-card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Producto</th>
                <th>Categoría</th>
                <th>Precio</th>
                <th>Stock</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {productosFiltrados.map(p => {
                const isLow = (p.stock || 0) <= (p.stockMinimo || 10);
                return (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 700, color: 'var(--blue)' }}>
                      {p.codigoInterno || p.codigo}
                    </td>
                    <td style={{ fontWeight: 600 }}>{p.nombre}</td>
                    <td>{p.categoria}</td>
                    <td style={{ fontWeight: 700 }}>{formatMoney(p.precioVenta || p.precio)}</td>
                    <td>
                      <span className={isLow ? 'stock-low' : 'stock-ok'}>
                        {p.stock} unid.
                      </span>
                    </td>
                    <td>
                      <button
                        className="action-small"
                        type="button"
                        onClick={() => {
                          setModalEntrada(p);
                          setFormEntrada({ cantidad: '', motivo: 'Compra de inventario' });
                        }}
                      >
                        + Entrada
                      </button>
                    </td>
                  </tr>
                );
              })}
              {productosFiltrados.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: 'var(--muted)' }}>
                    No se encontraron repuestos registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Nuevo Producto */}
      {modalNuevo && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <form className="modal-dialog" onSubmit={handleCrearProducto}>
            <div className="modal-head">
              <h2>Nuevo producto</h2>
              <button
                className="icon-btn"
                type="button"
                onClick={() => setModalNuevo(false)}
                title="Cerrar"
              >
                <i className="ti ti-x"></i>
              </button>
            </div>
            <div className="modal-grid">
              <div>
                <label htmlFor="prod-code">Código</label>
                <input
                  id="prod-code"
                  required
                  placeholder="REP-001"
                  value={form.codigo}
                  onChange={e => setForm({ ...form, codigo: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="prod-name">Producto</label>
                <input
                  id="prod-name"
                  required
                  placeholder="Nombre del repuesto"
                  value={form.nombre}
                  onChange={e => setForm({ ...form, nombre: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="prod-category">Categoría</label>
                <input
                  id="prod-category"
                  required
                  placeholder="Ej. Frenos"
                  value={form.categoria}
                  onChange={e => setForm({ ...form, categoria: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="prod-price">Precio RD$</label>
                <input
                  id="prod-price"
                  type="number"
                  min="0"
                  required
                  placeholder="0.00"
                  value={form.precio}
                  onChange={e => setForm({ ...form, precio: e.target.value })}
                />
              </div>
              <div className="full">
                <label htmlFor="prod-stock">Stock inicial</label>
                <input
                  id="prod-stock"
                  type="number"
                  min="0"
                  required
                  placeholder="0"
                  value={form.stock}
                  onChange={e => setForm({ ...form, stock: e.target.value })}
                />
              </div>
            </div>
            <div className="modal-actions">
              <button
                className="secondary-btn"
                type="button"
                onClick={() => setModalNuevo(false)}
              >
                Cancelar
              </button>
              <button className="primary-btn" type="submit">
                Guardar producto
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Entrada de Stock */}
      {modalEntrada && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <form className="modal-dialog" onSubmit={handleRegistrarEntrada}>
            <div className="modal-head">
              <h2>Registrar entrada de mercancía</h2>
              <button
                className="icon-btn"
                type="button"
                onClick={() => setModalEntrada(null)}
                title="Cerrar"
              >
                <i className="ti ti-x"></i>
              </button>
            </div>
            <div style={{ marginBottom: '14px', fontSize: '13px', color: 'var(--muted)' }}>
              Repuesto: <strong>{modalEntrada.nombre}</strong> ({modalEntrada.codigoInterno || modalEntrada.codigo})
              <br />
              Stock actual: <strong>{modalEntrada.stock} unid.</strong>
            </div>
            <div className="modal-grid">
              <div className="full">
                <label htmlFor="entrada-qty">Cantidad a ingresar</label>
                <input
                  id="entrada-qty"
                  type="number"
                  min="1"
                  required
                  placeholder="Ej. 10"
                  value={formEntrada.cantidad}
                  onChange={e => setFormEntrada({ ...formEntrada, cantidad: e.target.value })}
                />
              </div>
              <div className="full">
                <label htmlFor="entrada-motivo">Motivo / Proveedor</label>
                <input
                  id="entrada-motivo"
                  placeholder="Ej. Factura proveedor A-102"
                  value={formEntrada.motivo}
                  onChange={e => setFormEntrada({ ...formEntrada, motivo: e.target.value })}
                />
              </div>
            </div>
            <div className="modal-actions">
              <button
                className="secondary-btn"
                type="button"
                onClick={() => setModalEntrada(null)}
              >
                Cancelar
              </button>
              <button className="primary-btn" type="submit">
                Aplicar entrada
              </button>
            </div>
          </form>
        </div>
      )}
    </PageLayout>
  );
}
