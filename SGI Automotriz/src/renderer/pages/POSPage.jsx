import { useState, useRef } from 'react';
import PageLayout  from '../components/PageLayout';
import Alert       from '../components/Alert';
import Modal       from '../components/Modal';
import { buscarProducto, confirmarVenta } from '../services/posService';
import { useAuthStore } from '../store/authStore';

export default function POSPage() {
  const { user }               = useAuthStore();
  const [codigo, setCodigo]    = useState('');
  const [carrito, setCarrito]  = useState([]);
  const [metodoPago, setMetodo]= useState('EFECTIVO');
  const [alerta, setAlerta]    = useState(null);
  const [cargando, setCargando]= useState(false);
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

  const metodos = ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'];

  return (
    <PageLayout title="Punto de Venta" subtitle="Escanea o busca productos para registrar una venta">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Columna izquierda — Escáner + Carrito */}
        <div className="xl:col-span-2 space-y-4">

          {/* Buscador */}
          <div className="card">
            <label className="label">Código de barras o nombre del producto</label>
            <input
              ref={inputRef}
              type="text"
              className="input-field"
              placeholder="Escanea o escribe y presiona Enter"
              value={codigo}
              onChange={e => setCodigo(e.target.value)}
              onKeyDown={handleScan}
              autoFocus
            />
          </div>

          {alerta && (
            <Alert type={alerta.type} message={alerta.message} onClose={() => setAlerta(null)} />
          )}

          {/* Carrito */}
          <div className="card !p-0 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="section-title text-slate-800">Carrito</h2>
              {carrito.length > 0 && (
                <span className="text-xs text-slate-550">{carrito.length} producto(s)</span>
              )}
            </div>

            {carrito.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-sm">
                Sin productos — escanea o escribe un código
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {['Producto', 'Precio unit.', 'Cantidad', 'Subtotal', ''].map((h, i) => (
                      <th key={i} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {carrito.map(item => (
                    <tr key={item.productoId} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3.5 font-medium text-slate-800">{item.nombre}</td>
                      <td className="px-4 py-3.5 text-slate-500">RD$ {item.precioUnitario.toFixed(2)}</td>
                      <td className="px-4 py-3.5">
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
                          className="w-16 border border-slate-200 rounded-lg px-2 py-1 text-center text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#111827]/10 focus:border-[#111827]"
                        />
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-slate-850">
                        RD$ {item.subtotal.toFixed(2)}
                      </td>
                      <td className="px-4 py-3.5">
                        <button
                          onClick={() => setCarrito(p => p.filter(i => i.productoId !== item.productoId))}
                          className="text-slate-400 hover:text-red-500 transition-colors text-lg leading-none"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Columna derecha — Resumen */}
        <div className="space-y-4">
          <div className="card space-y-5">
            <h2 className="section-title text-slate-800">Resumen de venta</h2>

            <div className="flex justify-between items-center py-3 border-t border-b border-slate-100">
              <span className="text-slate-500 text-sm">Total</span>
              <span className="text-2xl font-bold text-slate-900">RD$ {total.toFixed(2)}</span>
            </div>

            {/* Método de pago */}
            <div>
              <p className="label">Método de pago</p>
              <div className="space-y-2">
                {metodos.map(m => (
                  <button
                    key={m}
                    onClick={() => setMetodo(m)}
                    className={`w-full text-left px-4 py-2.5 rounded-xl border text-sm font-medium transition-all duration-150
                      ${metodoPago === m
                        ? 'border-[#111827] bg-[#f3f4f6] text-[#111827] shadow-sm'
                        : 'border-slate-200 text-slate-600 bg-white hover:bg-slate-50'
                      }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <button
              className="btn-success w-full py-3 text-base font-semibold"
              disabled={carrito.length === 0 || cargando}
              onClick={() => setModalPago(true)}
            >
              {cargando ? 'Procesando...' : 'Confirmar venta'}
            </button>

            <button
              className="btn-secondary w-full"
              onClick={() => setCarrito([])}
            >
              Limpiar carrito
            </button>
          </div>
        </div>
      </div>

      {/* Modal confirmación */}
      <Modal open={modalPago} title="Confirmar venta" onClose={() => setModalPago(false)} size="sm">
        <div className="space-y-4">
          <div className="bg-slate-50 rounded-xl p-5 text-center border border-slate-100">
            <p className="text-sm text-slate-500 mb-1">Total a cobrar</p>
            <p className="text-4xl font-bold text-slate-900">RD$ {total.toFixed(2)}</p>
            <p className="text-sm text-slate-550 mt-2">Método: <strong className="text-slate-800">{metodoPago}</strong></p>
          </div>
          <div className="flex gap-3 pt-2">
            <button className="btn-secondary flex-1" onClick={() => setModalPago(false)}>
              Cancelar
            </button>
            <button
              className="btn-success flex-1 font-semibold"
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
