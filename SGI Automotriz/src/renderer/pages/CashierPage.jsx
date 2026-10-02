import { useState, useEffect } from 'react';
import PageLayout from '../components/PageLayout';
import Alert from '../components/Alert';
import Modal from '../components/Modal';
import Spinner from '../components/Spinner';
import { resumenDia, confirmarCierre } from '../services/cashierService';
import { useAuthStore } from '../store/authStore';

export default function CashierPage() {
  const { user } = useAuthStore();
  const [resumen, setResumen] = useState(null);
  const [loading, setLoading] = useState(true);
  const [contado, setContado] = useState('');
  const [obs, setObs] = useState('');
  const [alerta, setAlerta] = useState(null);
  const [modal, setModal] = useState(false);
  const [cargando, setCargando] = useState(false);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setLoading(true);
    try { setResumen(await resumenDia()); }
    catch { setAlerta({ type: 'error', msg: 'Error al cargar el resumen del día' }); }
    finally { setLoading(false); }
  }

  async function handleCierre() {
    setCargando(true);
    try {
      await confirmarCierre({ usuarioId: user.id, efectivoContado: parseFloat(contado), observaciones: obs });
      setAlerta({ type: 'success', msg: 'Cierre de caja confirmado correctamente' });
      setModal(false); setContado(''); setObs(''); cargar();
    } catch (e) {
      setAlerta({ type: 'error', msg: e.message });
    } finally {
      setCargando(false);
    }
  }

  const diferencia = resumen ? parseFloat(contado || 0) - resumen.totalVentas : 0;
  const hayContado = contado !== '';

  return (
    <PageLayout title="Cierre de Caja" subtitle="Conciliación diaria de ventas">
      {alerta && <Alert type={alerta.type} message={alerta.msg} onClose={() => setAlerta(null)} />}

      {loading ? <Spinner /> : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl">

          {/* Resumen del día */}
          <div className="card p-6 space-y-4">
            <h2 className="section-title text-slate-800">Resumen del día</h2>

            <div className="space-y-3">
              <div className="flex justify-between items-center py-3 border-b border-gray-100">
                <span className="text-sm text-slate-600">Total ventas confirmadas</span>
                <span className="text-xl font-bold text-emerald-700">
                  RD$ {resumen?.totalVentas.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Cantidad de ventas</span>
                <span className="font-semibold text-slate-700">{resumen?.cantidadVentas}</span>
              </div>
              {Object.entries(resumen?.porMetodo || {}).map(([m, v]) => (
                <div key={m} className="flex justify-between text-sm">
                  <span className="text-slate-500">{m}</span>
                  <span className="text-slate-700">RD$ {v.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Conteo */}
          <div className="card p-6 space-y-4">
            <h2 className="section-title text-slate-800">Conteo de caja</h2>

            <div>
              <label className="label">Efectivo contado (RD$)</label>
              <input
                type="number"
                className="input-field"
                placeholder="0.00"
                value={contado}
                onChange={e => setContado(e.target.value)}
              />
            </div>

            {hayContado && (
              <div className={`rounded-xl px-5 py-4 flex justify-between items-center
                ${diferencia >= 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
                <span className={`text-sm font-medium ${diferencia >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  Diferencia
                </span>
                <span className={`text-xl font-bold ${diferencia >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  {diferencia >= 0 ? '+' : ''}RD$ {diferencia.toFixed(2)}
                </span>
              </div>
            )}

            <div>
              <label className="label">Observaciones (opcional)</label>
              <input
                type="text"
                className="input-field"
                placeholder="Ej: Diferencia por propina..."
                value={obs}
                onChange={e => setObs(e.target.value)}
              />
            </div>

            <button
              className="btn-success w-full py-3"
              disabled={!contado}
              onClick={() => setModal(true)}
            >
              Confirmar cierre de caja
            </button>
          </div>

        </div>
      )}

      <Modal open={modal} title="Confirmar cierre de caja" onClose={() => setModal(false)} size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Esta acción es <strong>irreversible</strong>. El cierre quedará grabado permanentemente.
          </p>
          <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Ventas del día</span>
              <span className="font-medium">RD$ {resumen?.totalVentas.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Efectivo contado</span>
              <span className="font-medium">RD$ {parseFloat(contado || 0).toFixed(2)}</span>
            </div>
            <div className={`flex justify-between font-bold pt-2 border-t border-gray-200 ${diferencia >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
              <span>Diferencia</span>
              <span>{diferencia >= 0 ? '+' : ''}RD$ {diferencia.toFixed(2)}</span>
            </div>
          </div>
          <div className="flex gap-3">
            <button className="btn-secondary flex-1" onClick={() => setModal(false)}>Cancelar</button>
            <button className="btn-success flex-1" onClick={handleCierre} disabled={cargando}>
              {cargando ? 'Procesando...' : 'Confirmar'}
            </button>
          </div>
        </div>
      </Modal>
    </PageLayout>
  );
}
