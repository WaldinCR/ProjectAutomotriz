import { useState, useRef } from 'react';
import PageLayout from '../components/PageLayout';
import Button     from '../components/Button';
import Input      from '../components/Input';
import Alert      from '../components/Alert';
import Modal      from '../components/Modal';
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
      if (!producto) { setAlerta({ type: 'error', msg: 'Producto no encontrado' }); return; }
      if (producto.stock <= 0) { setAlerta({ type: 'warning', msg: 'Sin stock disponible' }); return; }
      setCarrito(prev => {
        const existe = prev.find(i => i.productoId === producto.id);
        if (existe) return prev.map(i => i.productoId === producto.id
          ? { ...i, cantidad: i.cantidad+1, subtotal: (i.cantidad+1)*i.precioUnitario } : i);
        return [...prev, {
          productoId: producto.id, nombre: producto.nombre,
          precioUnitario: producto.precioVenta, cantidad: 1,
          subtotal: producto.precioVenta, descuento: 0,
        }];
      });
      setCodigo(''); setAlerta(null);
    } catch { setAlerta({ type: 'error', msg: 'Error al buscar producto' }); }
  }

  async function handleConfirmar() {
    setCargando(true);
    try {
      await confirmarVenta({ usuarioId: user.id, items: carrito, metodoPago });
      setCarrito([]); setModalPago(false);
      setAlerta({ type: 'success', msg: '✅ Venta registrada exitosamente' });
      inputRef.current?.focus();
    } catch (e) { setAlerta({ type: 'error', msg: e.message }); }
    finally { setCargando(false); }
  }

  return (
    <PageLayout title="🛒 Punto de Venta">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <Input ref={inputRef} label="Escanear o buscar producto"
              value={codigo} onChange={e => setCodigo(e.target.value)}
              onKeyDown={handleScan} placeholder="Código de barras — presiona Enter" autoFocus />
          </div>
          {alerta && <Alert type={alerta.type} message={alerta.msg} onClose={() => setAlerta(null)} />}
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="bg-blue-900 text-white px-4 py-3 font-semibold">Carrito</div>
            {carrito.length === 0 ? (
              <p className="text-center text-gray-400 py-10">Sin productos — escanea o busca</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>{['Producto','Precio','Cant.','Subtotal',''].map((h,i)=>(
                    <th key={i} className="px-3 py-2 text-left text-gray-600 font-medium">{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {carrito.map((item, i) => (
                    <tr key={item.productoId} className={i%2===0?'bg-white':'bg-gray-50'}>
                      <td className="px-3 py-2 font-medium">{item.nombre}</td>
                      <td className="px-3 py-2 text-gray-600">RD$ {item.precioUnitario.toFixed(2)}</td>
                      <td className="px-3 py-2">
                        <input type="number" min="1" value={item.cantidad}
                          onChange={e => {
                            const qty = parseInt(e.target.value)||1;
                            setCarrito(prev => prev.map(it => it.productoId===item.productoId
                              ? {...it, cantidad:qty, subtotal:qty*it.precioUnitario} : it));
                          }}
                          className="w-16 border rounded px-2 py-1 text-center" />
                      </td>
                      <td className="px-3 py-2 font-semibold text-blue-900">RD$ {item.subtotal.toFixed(2)}</td>
                      <td className="px-3 py-2">
                        <button onClick={() => setCarrito(p=>p.filter(i=>i.productoId!==item.productoId))}
                          className="text-red-500 hover:text-red-700">🗑</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-5 space-y-4 h-fit">
          <h2 className="font-bold text-blue-900 text-lg">Resumen</h2>
          <div className="flex justify-between font-bold text-xl border-t pt-3">
            <span>Total:</span>
            <span className="text-blue-900">RD$ {total.toFixed(2)}</span>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Método de pago</label>
            {['EFECTIVO','TARJETA','TRANSFERENCIA'].map(m => (
              <button key={m} onClick={() => setMetodo(m)}
                className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition ${
                  metodoPago===m ? 'border-blue-600 bg-blue-50 text-blue-800 font-semibold' : 'border-gray-200 hover:bg-gray-50'
                }`}>
                {m==='EFECTIVO'?'💵':m==='TARJETA'?'💳':'📱'} {m}
              </button>
            ))}
          </div>
          <Button variant="success" size="lg" className="w-full"
            disabled={carrito.length===0||cargando} onClick={() => setModalPago(true)}>
            {cargando ? 'Procesando...' : '✅ Confirmar Venta'}
          </Button>
          <Button variant="ghost" size="md" className="w-full" onClick={() => setCarrito([])}>
            🗑 Limpiar carrito
          </Button>
        </div>
      </div>
      <Modal open={modalPago} title="Confirmar Venta" onClose={() => setModalPago(false)} size="sm">
        <p className="text-gray-600 mb-2">Total a cobrar:</p>
        <p className="text-3xl font-bold text-blue-900 mb-4">RD$ {total.toFixed(2)}</p>
        <p className="text-sm text-gray-500 mb-6">Método: <strong>{metodoPago}</strong></p>
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={() => setModalPago(false)}>Cancelar</Button>
          <Button variant="success" className="flex-1" onClick={handleConfirmar} disabled={cargando}>
            {cargando ? 'Procesando...' : 'Confirmar'}
          </Button>
        </div>
      </Modal>
    </PageLayout>
  );
}
