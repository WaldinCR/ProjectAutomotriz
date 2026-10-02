import { useState, useRef } from 'react';
import PageLayout from '../components/PageLayout';
import Alert from '../components/Alert';
import Modal from '../components/Modal';
import { buscarProducto, confirmarVenta } from '../services/posService';
import { useAuthStore } from '../store/authStore';

export default function POSPage() {
  const { user } = useAuthStore();
  const [codigo, setCodigo] = useState('');
  const [carrito, setCarrito] = useState([]);
  const [metodoPago, setMetodo] = useState('EFECTIVO');
  const [alerta, setAlerta] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [modalPago, setModalPago] = useState(false);
  const inputRef = useRef(null);

  const total = carrito.reduce((s, i) => s + i.subtotal, 0);

  async function handleScan(e) {
    if (e.key !== 'Enter' || !codigo.trim()) return;
    try {
      const producto = await buscarProducto(codigo.trim());
      if (!producto) {
        setAlerta({ type: 'error', message: 'Producto no encontrado' });
        setCodigo('');
        return;
      }
      if (producto.stock <= 0) {
        setAlerta({ type: 'warning', message: `Sin stock disponible para: ${producto.nombre}` });
        setCodigo('');
        return;
      }
      setCarrito(prev => {
        const existe = prev.find(i => i.productoId === producto.id);
        if (existe) {
          return prev.map(i => i.productoId === producto.id
            ? { ...i, cantidad: i.cantidad + 1, subtotal: (i.cantidad + 1) * i.precioUnitario }
            : i);
        }
        return [...prev, {
          productoId: producto.id,
          codigoInterno: producto.codigoInterno,
          nombre: producto.nombre,
          precioUnitario: producto.precioVenta,
          cantidad: 1,
          subtotal: producto.precioVenta,
        }];
      });
      setCodigo('');
      setAlerta(null);
    } catch {
      setAlerta({ type: 'error', message: 'Error al buscar el producto' });
    }
  }

  async function handleConfirmar() {
    setCargando(true);
    try {
      await confirmarVenta({ usuarioId: user.id, items: carrito, metodoPago });
      setCarrito([]);
      setModalPago(false);
      setAlerta({ type: 'success', message: 'Venta registrada correctamente' });
      inputRef.current?.focus();
    } catch (e) {
      setAlerta({ type: 'error', message: e.message });
    } finally {
      setCargando(false);
    }
  }

  const metodos = [
    { key: 'EFECTIVO', label: 'Efectivo', icon: 'ti-cash' },
    { key: 'TARJETA', label: 'Tarjeta', icon: 'ti-credit-card' },
    { key: 'TRANSFERENCIA', label: 'Transferencia', icon: 'ti-transfer' },
  ];

  return (
    <PageLayout
      title="Punto de venta"
      subtitle="Escanea o busca productos para registrar una venta"
      icon="ti-shopping-cart"
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
            <label className="lbl">Código de barras o nombre del producto</label>
            <div className="search-row" style={{ marginBottom: 0 }}>
              <i className="ti ti-barcode"></i>
              <input
                ref={inputRef}
                type="text"
                placeholder="Escanea o escribe y presiona Enter"
                value={codigo}
                onChange={e => setCodigo(e.target.value)}
                onKeyDown={handleScan}
                autoFocus
              />
              <i className="ti ti-scan" style={{ color: '#cbd5e1', cursor: 'pointer' }}></i>
            </div>
          </div>

          <div className="tbl-wrap">
            <div className="tbl-top">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="ti ti-shopping-cart" style={{ fontSize: '16px', color: '#64748b' }}></i>
                <span className="tbl-top-title">Carrito de compra</span>
              </div>
              <span className="badge bg-gray">{carrito.length} artículos</span>
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
                          value={item.cantidad}
                          onChange={e => {
                            const qty = Math.max(1, parseInt(e.target.value) || 1);
                            setCarrito(prev => prev.map(i =>
                              i.productoId === item.productoId
                                ? { ...i, cantidad: qty, subtotal: qty * i.precioUnitario }
                                : i
                            ));
                          }}
                          className="inp"
                          style={{ width: '64px', padding: '4px 6px', textAlign: 'center' }}
                        />
                      </td>
                      <td style={{ color: '#64748b' }}>RD$ {item.precioUnitario.toFixed(2)}</td>
                      <td className="td-accent">RD$ {item.subtotal.toFixed(2)}</td>
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
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', marginBottom: '2px' }}>
              Resumen de venta
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
              Total a cobrar
            </div>

            <div className="total-split">
              <span style={{ fontSize: '13px', color: '#64748b' }}>Total</span>
              <span style={{ fontSize: '24px', fontWeight: 700, color: '#1e3a5f' }}>
                RD$ {total.toFixed(2)}
              </span>
            </div>

            <div style={{ fontSize: '12px', fontWeight: 500, color: '#475569', marginBottom: '8px' }}>
              Método de pago
            </div>

            {metodos.map(m => (
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
              disabled={carrito.length === 0 || cargando}
              onClick={() => setModalPago(true)}
            >
              <i className="ti ti-check"></i>
              {cargando ? 'Procesando...' : 'Confirmar venta'}
            </button>

            <button
              className="clear-btn"
              onClick={() => setCarrito([])}
              disabled={carrito.length === 0}
            >
              Limpiar carrito
            </button>
          </div>
        </div>
      </div>

      <Modal open={modalPago} title="Confirmar venta" onClose={() => setModalPago(false)} size="sm">
        <div style={{ padding: '8px 0' }}>
          <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '18px', textAlign: 'center', marginBottom: '16px', border: '1px solid #e2e8f0' }}>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Total a cobrar</p>
            <p style={{ fontSize: '32px', fontWeight: 700, color: '#1e3a5f' }}>RD$ {total.toFixed(2)}</p>
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
            >
              {cargando ? 'Procesando...' : 'Confirmar'}
            </button>
          </div>
        </div>
      </Modal>
    </PageLayout>
  );
}
