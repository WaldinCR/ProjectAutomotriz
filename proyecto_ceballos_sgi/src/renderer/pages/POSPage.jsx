import { useState, useRef, useEffect } from 'react';
import PageLayout from '../components/PageLayout';
import Alert from '../components/Alert';
import Modal from '../components/Modal';
import Receipt from '../components/Receipt';
import { buscarProducto, confirmarVenta } from '../services/posService';
import { buscarProductos } from '../services/inventoryService';
import { rd } from '../lib/format';

const METODOS = [
  { key: 'EFECTIVO', label: 'Efectivo', icon: 'ti-cash' },
  { key: 'TARJETA', label: 'Tarjeta', icon: 'ti-credit-card' },
  { key: 'TRANSFERENCIA', label: 'Transferencia', icon: 'ti-transfer' },
];

// El precio mostrado es informativo: el total definitivo lo calcula el proceso principal
const lineaSubtotal = (i) => Math.max(0, i.cantidad * i.precioUnitario);

export default function POSPage() {
  const [codigo, setCodigo] = useState('');
  const [resultados, setResultados] = useState([]);
  const [seleccion, setSeleccion] = useState(0);
  const [carrito, setCarrito] = useState([]);
  const [metodoPago, setMetodo] = useState('EFECTIVO');
  const [descuento, setDescuento] = useState('');
  const [alerta, setAlerta] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [modalPago, setModalPago] = useState(false);
  const [factura, setFactura] = useState(null);
  const inputRef = useRef(null);

  const subtotal = carrito.reduce((s, i) => s + lineaSubtotal(i), 0);
  const montoDescuento = Math.min(Math.max(parseFloat(descuento) || 0, 0), subtotal);
  const total = subtotal - montoDescuento;
  const descuentoInvalido = (parseFloat(descuento) || 0) > subtotal;

  // Búsqueda por nombre/categoría mientras se escribe (RF-10)
  useEffect(() => {
    const termino = codigo.trim();
    if (termino.length < 2) { setResultados([]); return; }
    const t = setTimeout(async () => {
      try {
        setResultados(await buscarProductos(termino));
        setSeleccion(0);
      } catch { setResultados([]); }
    }, 250);
    return () => clearTimeout(t);
  }, [codigo]);

  function agregar(producto) {
    if (producto.stock <= 0) {
      setAlerta({ type: 'warning', message: `Sin stock disponible para: ${producto.nombre}` });
      return;
    }
    const enCarrito = carrito.find(i => i.productoId === producto.id);
    if (enCarrito && enCarrito.cantidad >= producto.stock) {
      setAlerta({ type: 'warning', message: `Solo hay ${producto.stock} unidad(es) de ${producto.nombre}` });
    } else {
      setCarrito(prev => enCarrito
        ? prev.map(i => i.productoId === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i)
        : [...prev, {
            productoId: producto.id,
            codigoInterno: producto.codigoInterno,
            nombre: producto.nombre,
            precioUnitario: producto.precioVenta,
            stock: producto.stock,
            cantidad: 1,
          }]);
      setAlerta(null);
    }
    setCodigo('');
    setResultados([]);
    inputRef.current?.focus();
  }

  async function handleKeyDown(e) {
    if (e.key === 'ArrowDown' && resultados.length) {
      e.preventDefault();
      setSeleccion(s => Math.min(s + 1, resultados.length - 1));
    } else if (e.key === 'ArrowUp' && resultados.length) {
      e.preventDefault();
      setSeleccion(s => Math.max(s - 1, 0));
    } else if (e.key === 'Escape') {
      setCodigo('');
      setResultados([]);
    } else if (e.key === 'Enter' && codigo.trim()) {
      try {
        // Primero código exacto (lector de barras); si no, el resultado resaltado
        const exacto = await buscarProducto(codigo.trim());
        if (exacto) return agregar(exacto);
        if (resultados[seleccion]) return agregar(resultados[seleccion]);
        setAlerta({ type: 'error', message: `No se encontró ningún producto para "${codigo.trim()}"` });
      } catch (err) {
        setAlerta({ type: 'error', message: err.message });
      }
    }
  }

  function cambiarCantidad(item, valor) {
    const qty = Math.min(Math.max(1, parseInt(valor) || 1), item.stock);
    if ((parseInt(valor) || 1) > item.stock) {
      setAlerta({ type: 'warning', message: `Solo hay ${item.stock} unidad(es) de ${item.nombre}` });
    }
    setCarrito(prev => prev.map(i => i.productoId === item.productoId ? { ...i, cantidad: qty } : i));
  }

  function limpiar() {
    setCarrito([]);
    setDescuento('');
  }

  async function handleConfirmar() {
    setCargando(true);
    try {
      const venta = await confirmarVenta({
        items: carrito.map(i => ({ productoId: i.productoId, cantidad: i.cantidad })),
        metodoPago,
        descuentoTotal: montoDescuento,
      });
      limpiar();
      setModalPago(false);
      setFactura(venta);
      setAlerta({ type: 'success', message: `Venta ${venta.numeroFactura} registrada correctamente` });
    } catch (e) {
      setModalPago(false);
      setAlerta({ type: 'error', message: e.message });
    } finally {
      setCargando(false);
    }
  }

  return (
    <PageLayout
      title="Punto de venta"
      subtitle="Escanea o busca productos para registrar una venta"
      actions={
        <span className="badge bg-blue" style={{ fontSize: '12px', padding: '5px 12px' }}>
          <i className="ti ti-circle-filled" style={{ fontSize: '9px', marginRight: '4px' }}></i>
          Venta activa
        </span>
      }
    >
      {alerta && (
        <div style={{ marginBottom: '14px' }}>
          <Alert type={alerta.type} message={alerta.message} onClose={() => setAlerta(null)} />
        </div>
      )}

      <div className="pos-grid">
        <div>
          <div className="card" style={{ padding: '16px', marginBottom: '14px' }}>
            <label className="lbl">Código de barras, nombre o categoría</label>
            <div className="search-wrap">
              <div className="search-row" style={{ marginBottom: 0 }}>
                <i className="ti ti-barcode"></i>
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Escanea o escribe y presiona Enter (↑ ↓ para elegir)"
                  value={codigo}
                  onChange={e => setCodigo(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoFocus
                />
              </div>
              {resultados.length > 0 && (
                <div className="search-results">
                  {resultados.map((p, idx) => (
                    <button
                      key={p.id}
                      type="button"
                      className={idx === seleccion ? 'sel' : ''}
                      disabled={p.stock <= 0}
                      onMouseDown={e => { e.preventDefault(); agregar(p); }}
                    >
                      <span>
                        <strong>{p.nombre}</strong>
                        <span className="muted"> · {p.categoria} · {p.codigoInterno}</span>
                      </span>
                      <span>
                        {rd(p.precioVenta)} <span className="muted">({p.stock > 0 ? `stock ${p.stock}` : 'agotado'})</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="tbl-wrap">
            <div className="tbl-top">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="ti ti-shopping-cart" style={{ fontSize: '16px', color: '#64748b' }}></i>
                <span className="tbl-top-title">Carrito de compra</span>
              </div>
              <span className="badge bg-gray">{carrito.reduce((s, i) => s + i.cantidad, 0)} artículos</span>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Código</th>
                  <th>Cant.</th>
                  <th>Precio</th>
                  <th>Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {carrito.length === 0 ? (
                  <tr>
                    <td colSpan="6">
                      <div className="cart-empty">
                        <i className="ti ti-package-off"></i>
                        <span style={{ fontSize: '14px', fontWeight: 500 }}>Tu carrito está vacío</span>
                        <span style={{ fontSize: '12px' }}>Busca un producto para agregarlo</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  carrito.map(item => (
                    <tr key={item.productoId}>
                      <td className="td-bold">{item.nombre}</td>
                      <td className="td-mono">{item.codigoInterno || '—'}</td>
                      <td>
                        <input
                          type="number"
                          min="1"
                          max={item.stock}
                          value={item.cantidad}
                          onChange={e => cambiarCantidad(item, e.target.value)}
                          className="inp"
                          style={{ width: '64px', padding: '4px 6px', textAlign: 'center' }}
                          title={`Disponible: ${item.stock}`}
                        />
                      </td>
                      <td style={{ color: '#64748b' }}>{rd(item.precioUnitario)}</td>
                      <td className="td-accent">{rd(lineaSubtotal(item))}</td>
                      <td>
                        <button
                          onClick={() => setCarrito(p => p.filter(i => i.productoId !== item.productoId))}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '16px' }}
                          title="Eliminar"
                        >
                          <i className="ti ti-trash"></i>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="card" style={{ padding: '18px' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', marginBottom: '8px' }}>
              Resumen de venta
            </div>

            <div className="data-row">
              <span className="data-label">Subtotal</span>
              <span className="data-val">{rd(subtotal)}</span>
            </div>
            <div style={{ margin: '8px 0' }}>
              <label className="lbl">Descuento (RD$)</label>
              <input
                className="inp"
                type="number"
                min="0"
                placeholder="0.00"
                value={descuento}
                onChange={e => setDescuento(e.target.value)}
                disabled={carrito.length === 0}
              />
              {descuentoInvalido && <span className="field-err">El descuento no puede superar el subtotal</span>}
            </div>

            <div className="total-split">
              <span style={{ fontSize: '13px', color: '#64748b' }}>Total</span>
              <span style={{ fontSize: '24px', fontWeight: 700, color: '#1e3a5f' }}>{rd(total)}</span>
            </div>

            <div style={{ fontSize: '12px', fontWeight: 500, color: '#475569', marginBottom: '8px' }}>
              Método de pago
            </div>

            {METODOS.map(m => (
              <button
                key={m.key}
                onClick={() => setMetodo(m.key)}
                className={`method-btn ${metodoPago === m.key ? 'sel' : ''}`}
              >
                <i className={`ti ${m.icon}`}></i>
                {m.label}
              </button>
            ))}

            <button
              className="confirm-btn"
              disabled={carrito.length === 0 || cargando || descuentoInvalido}
              onClick={() => setModalPago(true)}
            >
              <i className="ti ti-check"></i>
              {cargando ? 'Procesando...' : 'Confirmar venta'}
            </button>

            <button className="clear-btn" onClick={limpiar} disabled={carrito.length === 0}>
              Limpiar carrito
            </button>
          </div>
        </div>
      </div>

      <Modal open={modalPago} title="Confirmar venta" onClose={() => setModalPago(false)} size="sm">
        <div style={{ padding: '8px 0' }}>
          <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '18px', textAlign: 'center', marginBottom: '16px', border: '1px solid #e2e8f0' }}>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Total a cobrar</p>
            <p style={{ fontSize: '32px', fontWeight: 700, color: '#1e3a5f' }}>{rd(total)}</p>
            {montoDescuento > 0 && (
              <p style={{ fontSize: '12px', color: '#64748b' }}>Incluye descuento de {rd(montoDescuento)}</p>
            )}
            <p style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
              Método: <strong style={{ color: '#0f172a' }}>{metodoPago}</strong>
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setModalPago(false)}>
              Cancelar
            </button>
            <button
              className="btn btn-dark"
              style={{ flex: 1, justifyContent: 'center' }}
              onClick={handleConfirmar}
              disabled={cargando}
              autoFocus
            >
              {cargando ? 'Procesando...' : 'Confirmar'}
            </button>
          </div>
        </div>
      </Modal>

      <Receipt venta={factura} onClose={() => { setFactura(null); inputRef.current?.focus(); }} />
    </PageLayout>
  );
}
