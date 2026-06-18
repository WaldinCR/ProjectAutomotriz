import { useState, useEffect } from 'react';
import PageLayout from '../components/PageLayout';
import Button     from '../components/Button';
import Input      from '../components/Input';
import Alert      from '../components/Alert';
import Modal      from '../components/Modal';
import Spinner    from '../components/Spinner';
import { resumenDia, confirmarCierre } from '../services/cashierService';
import { useAuthStore } from '../store/authStore';

export default function CashierPage() {
  const { user }              = useAuthStore();
  const [resumen, setResumen] = useState(null);
  const [loading, setLoading] = useState(true);
  const [contado, setContado] = useState('');
  const [obs, setObs]         = useState('');
  const [alerta, setAlerta]   = useState(null);
  const [modalConfirm, setModalConfirm] = useState(false);
  const [cargando, setCargando] = useState(false);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setLoading(true);
    try { setResumen(await resumenDia()); }
    catch { setAlerta({ type:'error', msg:'Error al cargar resumen' }); }
    finally { setLoading(false); }
  }

  async function handleCierre() {
    setCargando(true);
    try {
      await confirmarCierre({ usuarioId: user.id, efectivoContado: parseFloat(contado), observaciones: obs });
      setAlerta({ type:'success', msg:'✅ Cierre de caja confirmado' });
      setModalConfirm(false); setContado(''); setObs(''); cargar();
    } catch (e) { setAlerta({ type:'error', msg:e.message }); }
    finally { setCargando(false); }
  }

  const diferencia = resumen ? parseFloat(contado||0) - resumen.totalVentas : 0;

  return (
    <PageLayout title="💰 Cierre de Caja">
      {alerta && <Alert type={alerta.type} message={alerta.msg} onClose={() => setAlerta(null)} />}
      {loading ? <Spinner /> : (
        <div className="max-w-xl mx-auto space-y-4">
          <div className="bg-white rounded-xl shadow-sm border p-6 space-y-3">
            <h2 className="font-bold text-blue-900 text-lg">Resumen del Día</h2>
            <div className="flex justify-between text-sm border-b pb-2">
              <span className="text-gray-600">Total ventas:</span>
              <span className="font-bold text-green-700">RD$ {resumen?.totalVentas.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm border-b pb-2">
              <span className="text-gray-600">Cantidad de ventas:</span>
              <span className="font-semibold">{resumen?.cantidadVentas}</span>
            </div>
            {Object.entries(resumen?.porMetodo||{}).map(([m,v]) => (
              <div key={m} className="flex justify-between text-sm text-gray-500">
                <span>{m}:</span><span>RD$ {v.toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
            <h2 className="font-bold text-blue-900 text-lg">Conteo de Caja</h2>
            <Input label="Efectivo contado (RD$)" type="number" value={contado}
              onChange={e => setContado(e.target.value)} placeholder="0.00" />
            {contado && (
              <div className={`flex justify-between font-bold text-lg px-3 py-2 rounded-lg ${
                diferencia>=0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}>
                <span>Diferencia:</span>
                <span>{diferencia>=0?'+':''}RD$ {diferencia.toFixed(2)}</span>
              </div>
            )}
            <Input label="Observaciones (opcional)" value={obs}
              onChange={e => setObs(e.target.value)} placeholder="Ej: Diferencia por propina..." />
            <Button variant="success" size="lg" className="w-full"
              disabled={!contado} onClick={() => setModalConfirm(true)}>
              Confirmar Cierre de Caja
            </Button>
          </div>
        </div>
      )}
      <Modal open={modalConfirm} title="¿Confirmar cierre?" onClose={() => setModalConfirm(false)} size="sm">
        <p className="text-gray-600 text-sm mb-4">Esta acción es <strong>irreversible</strong>.</p>
        <div className="space-y-1 text-sm mb-6">
          <div className="flex justify-between"><span>Ventas del día:</span><span>RD$ {resumen?.totalVentas.toFixed(2)}</span></div>
          <div className="flex justify-between"><span>Efectivo contado:</span><span>RD$ {parseFloat(contado||0).toFixed(2)}</span></div>
          <div className={`flex justify-between font-bold ${diferencia>=0?'text-green-700':'text-red-600'}`}>
            <span>Diferencia:</span><span>RD$ {diferencia.toFixed(2)}</span>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={() => setModalConfirm(false)}>Cancelar</Button>
          <Button variant="success" className="flex-1" onClick={handleCierre} disabled={cargando}>
            {cargando ? 'Procesando...' : 'Confirmar'}
          </Button>
        </div>
      </Modal>
    </PageLayout>
  );
}
