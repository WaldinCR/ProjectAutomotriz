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
  const [hora, setHora] = useState('--:--');

  useEffect(() => {
    cargar();
    const updateTime = () => setHora(new Date().toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' }));
    updateTime();
    const timer = setInterval(updateTime, 30000);
    return () => clearInterval(timer);
  }, []);

  async function cargar() {
    setLoading(true);
    try {
      setResumen(await resumenDia());
    } catch {
      setAlerta({ type: 'error', msg: 'Error al cargar el resumen del día' });
    } finally {
      setLoading(false);
    }
  }

  async function handleCierre() {
    setCargando(true);
    try {
      await confirmarCierre({
        usuarioId: user.id,
        efectivoContado: parseFloat(contado) || 0,
        observaciones: obs
      });
      setAlerta({ type: 'success', msg: 'Cierre de caja confirmado correctamente' });
      setModal(false);
      setContado('');
      setObs('');
      cargar();
    } catch (e) {
      setAlerta({ type: 'error', msg: e.message });
    } finally {
      setCargando(false);
    }
  }

  const efectivoEsperado = resumen?.totalVentas || 0;
  const numContado = parseFloat(contado);
  const hayContado = !isNaN(numContado) && contado !== '';
  const diferencia = hayContado ? numContado - efectivoEsperado : 0;
  const esPositivo = diferencia >= 0;

  return (
    <PageLayout
      title="Cierre de caja"
      subtitle="Conciliación diaria de ventas"
      icon="ti-cash-register"
      actions={
        <span className="badge bg-orange" style={{ fontSize: '12px', padding: '6px 13px' }}>
          <i className="ti ti-shield-check" style={{ fontSize: '13px', marginRight: '4px' }}></i>
          En revisión
        </span>
      }
    >
      {alerta && (
        <div style={{ marginBottom: '14px' }}>
          <Alert type={alerta.type} message={alerta.msg} onClose={() => setAlerta(null)} />
        </div>
      )}

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <Spinner />
        </div>
      ) : (
        <>
          <div className="caja-grid">
            {/* Card 1: Resumen del Día */}
            <div className="card" style={{ padding: '20px' }}>
              <div className="caja-card-head">
                <div className="caja-icon" style={{ background: '#dbeafe' }}>
                  <i className="ti ti-chart-bar" style={{ color: '#1e40af' }}></i>
                </div>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>
                  Resumen del día
                </span>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                  Total ventas confirmadas
                </div>
                <div style={{ fontSize: '28px', fontWeight: 700, color: '#1e40af' }}>
                  RD$ {(resumen?.totalVentas || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div className="data-row">
                <span className="data-label">Cantidad de ventas</span>
                <span className="data-val">{resumen?.cantidadVentas || 0}</span>
              </div>
              <div className="data-row">
                <span className="data-label">Efectivo</span>
                <span className="data-val">
                  RD$ {(resumen?.porMetodo?.EFECTIVO || 0).toFixed(2)}
                </span>
              </div>
              <div className="data-row">
                <span className="data-label">Tarjeta</span>
                <span className="data-val">
                  RD$ {(resumen?.porMetodo?.TARJETA || 0).toFixed(2)}
                </span>
              </div>
              <div className="data-row">
                <span className="data-label">Transferencia</span>
                <span className="data-val">
                  RD$ {(resumen?.porMetodo?.TRANSFERENCIA || 0).toFixed(2)}
                </span>
              </div>

              <div className="info-box">
                <i className="ti ti-info-circle" style={{ fontSize: '16px', flexShrink: 0 }}></i>
                Este resumen refleja las ventas confirmadas del día actual.
              </div>
            </div>

            {/* Card 2: Conteo de Caja */}
            <div className="card" style={{ padding: '20px' }}>
              <div className="caja-card-head">
                <div className="caja-icon" style={{ background: '#dcfce7' }}>
                  <i className="ti ti-coins" style={{ color: '#166534' }}></i>
                </div>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>
                  Conteo de caja
                </span>
              </div>

              <div style={{ marginBottom: '13px' }}>
                <label className="lbl">Efectivo contado (RD$)</label>
                <input
                  className="inp"
                  type="number"
                  placeholder="0.00"
                  value={contado}
                  onChange={e => setContado(e.target.value)}
                />
              </div>

              {hayContado && (
                <div className={`diff-box ${esPositivo ? 'diff-pos' : 'diff-neg'}`}>
                  <span style={{ fontSize: '13px', fontWeight: 500, color: esPositivo ? '#166534' : '#991b1b' }}>
                    Diferencia
                  </span>
                  <span style={{ fontSize: '19px', fontWeight: 700, color: esPositivo ? '#166534' : '#991b1b' }}>
                    {esPositivo ? '+' : ''}RD$ {diferencia.toFixed(2)}
                  </span>
                </div>
              )}

              <div style={{ marginBottom: '16px' }}>
                <label className="lbl">Observaciones (opcional)</label>
                <input
                  className="inp"
                  placeholder="Ej: Diferencia por propina..."
                  value={obs}
                  onChange={e => setObs(e.target.value)}
                />
              </div>

              <button
                className="btn btn-dark"
                style={{ width: '100%', padding: '12px', fontSize: '14px', justifyContent: 'center' }}
                disabled={!hayContado}
                onClick={() => setModal(true)}
              >
                <i className="ti ti-circle-check"></i>
                Confirmar cierre de caja
              </button>
            </div>
          </div>

          {/* Footer Metadata */}
          <div className="footer-meta">
            <div className="meta-item">
              <i className="ti ti-calendar"></i>
              <div>
                <div className="meta-label">Fecha</div>
                <div className="meta-val">{new Date().toLocaleDateString('es-DO')}</div>
              </div>
            </div>
            <div className="meta-item">
              <i className="ti ti-clock"></i>
              <div>
                <div className="meta-label">Hora actual</div>
                <div className="meta-val">{hora}</div>
              </div>
            </div>
            <div className="meta-item">
              <i className="ti ti-user"></i>
              <div>
                <div className="meta-label">Usuario</div>
                <div className="meta-val">{user?.nombre || 'Administrador'}</div>
              </div>
            </div>
            <div className="meta-item">
              <i className="ti ti-shield-check"></i>
              <div>
                <div className="meta-label">Cierre anterior</div>
                <div className="meta-val">Registrado</div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Modal confirmación */}
      <Modal open={modal} title="Confirmar cierre de caja" onClose={() => setModal(false)} size="sm">
        <div style={{ padding: '8px 0' }}>
          <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '14px' }}>
            Esta acción es irreversible y quedará registrada en el log de auditoría inmutable.
          </p>
          <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '14px', marginBottom: '16px', border: '1px solid #e2e8f0', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ color: '#64748b' }}>Ventas del día:</span>
              <span style={{ fontWeight: 600 }}>RD$ {resumen?.totalVentas.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ color: '#64748b' }}>Efectivo contado:</span>
              <span style={{ fontWeight: 600 }}>RD$ {parseFloat(contado || 0).toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: esPositivo ? '#166534' : '#dc2626' }}>
              <span>Diferencia:</span>
              <span>{esPositivo ? '+' : ''}RD$ {diferencia.toFixed(2)}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setModal(false)}>
              Cancelar
            </button>
            <button
              className="btn btn-dark"
              style={{ flex: 1, justifyContent: 'center' }}
              onClick={handleCierre}
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
