import { useState, useEffect } from 'react';
import PageLayout from '../components/PageLayout';
import Alert from '../components/Alert';
import { confirmarVenta } from '../services/posService';
import { listarProductos } from '../services/inventoryService';
import { useAuthStore } from '../store/authStore';

const DEFAULT_PRODUCTS = [
  { id: 'p1', codigoInterno: 'FLT-102', nombre: 'Filtro de aceite', precioVenta: 485, categoria: 'Filtros', stock: 24, icon: 'ti-filter' },
  { id: 'p2', codigoInterno: 'FRN-221', nombre: 'Pastillas de freno', precioVenta: 2450, categoria: 'Frenos', stock: 7, icon: 'ti-disc' },
  { id: 'p3', codigoInterno: 'BAT-540', nombre: 'Batería 12V 60Ah', precioVenta: 6950, categoria: 'Eléctrico', stock: 9, icon: 'ti-battery-charging' },
  { id: 'p4', codigoInterno: 'ACM-330', nombre: 'Amortiguador delantero', precioVenta: 3850, categoria: 'Suspensión', stock: 5, icon: 'ti-arrows-up-down' },
  { id: 'p5', codigoInterno: 'BJI-120', nombre: 'Bujía iridium', precioVenta: 640, categoria: 'Encendido', stock: 32, icon: 'ti-bolt' },
  { id: 'p6', codigoInterno: 'ACE-15W', nombre: 'Aceite 15W-40 1L', precioVenta: 520, categoria: 'Lubricantes', stock: 46, icon: 'ti-droplet' },
];

export default function POSPage() {
  const { user } = useAuthStore();
  const [productos, setProductos] = useState([]);
  const [search, setSearch] = useState('');
  const [carrito, setCarrito] = useState([]);
  const [metodoPago, setMetodoPago] = useState('Efectivo');
  const [alerta, setAlerta] = useState(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    cargarCatalogo();
  }, []);

  async function cargarCatalogo() {
    try {
      if (window.api?.inventory?.listarProductos) {
        const res = await listarProductos();
        if (res && res.length > 0) {
          setProductos(res.map((p, idx) => ({
            ...p,
            icon: p.icon || (idx % 2 === 0 ? 'ti-package' : 'ti-tool'),
          })));
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

  function agregarAlCarrito(prod) {
    setCarrito(prev => {
      const existe = prev.find(item => item.id === prod.id);
      if (existe) {
        return prev.map(item =>
          item.id === prod.id
            ? { ...item, qty: item.qty + 1 }
            : item
        );
      }
      return [...prev, {
        id: prod.id,
        codigoInterno: prod.codigoInterno || prod.codigo,
        nombre: prod.nombre,
        precio: prod.precioVenta || prod.precio || 0,
        qty: 1,
      }];
    });
  }

  function cambiarCantidad(id, delta) {
    setCarrito(prev =>
      prev
        .map(item => {
          if (item.id === id) {
            const nueva = item.qty + delta;
            return nueva > 0 ? { ...item, qty: nueva } : null;
          }
          return item;
        })
        .filter(Boolean)
    );
  }

  function eliminarDelCarrito(id) {
    setCarrito(prev => prev.filter(item => item.id !== id));
  }

  const subtotal = carrito.reduce((acc, i) => acc + (i.precio * i.qty), 0);
  const itbis = subtotal * 0.18;
  const total = subtotal + itbis;
  const totalArticulos = carrito.reduce((acc, i) => acc + i.qty, 0);

  async function handleConfirmarVenta() {
    if (carrito.length === 0) return;
    setCargando(true);
    setAlerta(null);
    try {
      if (window.api?.pos?.confirmarVenta) {
        await confirmarVenta({
          usuarioId: user?.id,
          metodoPago: metodoPago.toUpperCase(),
          items: carrito.map(i => ({
            productoId: i.id,
            codigoInterno: i.codigoInterno,
            nombre: i.nombre,
            precioUnitario: i.precio,
            cantidad: i.qty,
            subtotal: i.precio * i.qty,
          })),
        });
      }
      setCarrito([]);
      setAlerta({ type: 'success', message: 'Venta confirmada exitosamente con comprobante generado.' });
    } catch (err) {
      setAlerta({ type: 'error', message: err.message || 'Error al procesar la venta.' });
    } finally {
      setCargando(false);
    }
  }

  const productosFiltrados = productos.filter(p => {
    const q = search.toLowerCase();
    const nombre = (p.nombre || '').toLowerCase();
    const codigo = (p.codigoInterno || p.codigo || '').toLowerCase();
    return nombre.includes(q) || codigo.includes(q);
  });

  return (
    <PageLayout
      title="Punto de Venta"
      subtitle="Registra ventas rápidas y controla el despacho desde una sola pantalla."
    >
      {alerta && (
        <div style={{ marginBottom: '16px' }}>
          <Alert type={alerta.type} message={alerta.message} onClose={() => setAlerta(null)} />
        </div>
      )}

      <div className="pos-grid">
        {/* Catálogo de Productos */}
        <div className="card products-card">
          <div className="toolbar" style={{ justifyContent: 'space-between' }}>
            <h3 className="section-title">Catálogo de productos</h3>
            <div className="search-box">
              <i className="ti ti-search"></i>
              <input
                type="search"
                placeholder="Buscar por nombre o código"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="products-grid">
            {productosFiltrados.map(prod => (
              <article key={prod.id} className="product-card">
                <div className="product-icon">
                  <i className={`ti ${prod.icon || 'ti-package'}`}></i>
                </div>
                <div className="product-code">{prod.codigoInterno || prod.codigo}</div>
                <div className="product-name">{prod.nombre}</div>
                <div className="product-price">{formatMoney(prod.precioVenta || prod.precio)}</div>
                <button
                  className="add-btn"
                  type="button"
                  onClick={() => agregarAlCarrito(prod)}
                >
                  Añadir al carrito
                </button>
              </article>
            ))}
            {productosFiltrados.length === 0 && (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '30px', color: 'var(--muted)' }}>
                No se encontraron productos coincidentes.
              </div>
            )}
          </div>
        </div>

        {/* Carrito de Venta */}
        <aside className="card cart-card" aria-label="Carrito de venta">
          <div className="cart-head">
            <h3 className="section-title">Carrito de venta</h3>
            <span className="cart-count">
              {totalArticulos} {totalArticulos === 1 ? 'artículo' : 'artículos'}
            </span>
          </div>

          <div className="cart-items">
            {carrito.length === 0 ? (
              <div className="empty-cart">
                Tu carrito está vacío.<br />
                Agrega productos para iniciar la venta.
              </div>
            ) : (
              carrito.map(item => (
                <div key={item.id} className="cart-item">
                  <div className="cart-row">
                    <div>
                      <div className="cart-name">{item.nombre}</div>
                      <div className="cart-price">{formatMoney(item.precio)} c/u</div>
                    </div>
                    <button
                      className="remove-btn"
                      type="button"
                      onClick={() => eliminarDelCarrito(item.id)}
                      title="Eliminar producto"
                    >
                      <i className="ti ti-trash"></i>
                    </button>
                  </div>
                  <div className="qty">
                    <button type="button" onClick={() => cambiarCantidad(item.id, -1)}>−</button>
                    <span>{item.qty}</span>
                    <button type="button" onClick={() => cambiarCantidad(item.id, 1)}>+</button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="summary">
            <div className="sum-row">
              <span>Subtotal</span>
              <strong>{formatMoney(subtotal)}</strong>
            </div>
            <div className="sum-row">
              <span>ITBIS (18%)</span>
              <strong>{formatMoney(itbis)}</strong>
            </div>
            <div className="sum-row total">
              <span>Total</span>
              <span>{formatMoney(total)}</span>
            </div>

            <div className="payment-list" aria-label="Método de pago">
              {['Efectivo', 'Tarjeta', 'Transferencia'].map(m => (
                <button
                  key={m}
                  type="button"
                  className={`payment ${metodoPago === m ? 'selected' : ''}`}
                  onClick={() => setMetodoPago(m)}
                >
                  {m === 'Transferencia' ? 'Transfer.' : m}
                </button>
              ))}
            </div>

            <button
              className="primary-btn"
              style={{ width: '100%' }}
              type="button"
              disabled={carrito.length === 0 || cargando}
              onClick={handleConfirmarVenta}
            >
              {cargando ? 'Procesando...' : 'Confirmar venta'}
            </button>
          </div>
        </aside>
      </div>
    </PageLayout>
  );
}
