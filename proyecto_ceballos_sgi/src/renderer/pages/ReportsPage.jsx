import { useState } from 'react';
import PageLayout from '../components/PageLayout';
import Alert from '../components/Alert';
import { reporteDiario, reporteMensual } from '../services/reportsService';
import { useAuthStore } from '../store/authStore';

export default function ReportsPage() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState('diario');
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [alerta, setAlerta] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [recientes, setRecientes] = useState([]);

  async function handleGenerar() {
    setCargando(true);
    try {
      let res;
      if (tab === 'diario') {
        res = await reporteDiario(fecha);
      } else {
        res = await reporteMensual({ mes, anio });
      }

      const nuevoReporte = {
        id: Date.now(),
        periodo: tab === 'diario' ? fecha : `${mes}/${anio}`,
        tipo: tab === 'diario' ? 'Diario' : 'Mensual',
        fechaGen: new Date().toLocaleString('es-DO'),
        usuario: user?.nombre || 'Administrador',
        archivo: res?.filePath || 'Generado en Descargas'
      };
      setRecientes(prev => [nuevoReporte, ...prev]);

      setAlerta({
        type: 'success',
        msg: `Reporte generado con éxito: ${res?.filePath || 'Revisa tu carpeta de Descargas'}`
      });
    } catch (e) {
      setAlerta({ type: 'error', msg: e.message || 'Error al generar reporte' });
    } finally {
      setCargando(false);
    }
  }

  return (
    <PageLayout
      title="Reportes"
      subtitle="Genera y exporta reportes de ventas"
      icon="ti-chart-bar"
    >
      {alerta && (
        <div style={{ marginBottom: '14px' }}>
          <Alert type={alerta.type} message={alerta.msg} onClose={() => setAlerta(null)} />
        </div>
      )}

      <div className="rpt-card">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'start' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: '10px' }}>
              Período
            </div>

            <div className="rpt-period-row">
              <button
                type="button"
                className={`period-btn ${tab === 'diario' ? 'on' : ''}`}
                onClick={() => setTab('diario')}
              >
                <i className="ti ti-calendar-day"></i>Diario
              </button>
              <button
                type="button"
                className={`period-btn ${tab === 'mensual' ? 'on' : ''}`}
                onClick={() => setTab('mensual')}
              >
                <i className="ti ti-calendar-month"></i>Mensual
              </button>
            </div>

            {tab === 'diario' ? (
              <div style={{ marginBottom: '14px' }}>
                <label className="lbl">Fecha</label>
                <div className="inp-with-icon">
                  <i className="ti ti-calendar"></i>
                  <input
                    className="inp"
                    type="date"
                    value={fecha}
                    onChange={e => setFecha(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                <div>
                  <label className="lbl">Mes</label>
                  <input
                    className="inp"
                    type="number"
                    min="1"
                    max="12"
                    value={mes}
                    onChange={e => setMes(parseInt(e.target.value) || 1)}
                  />
                </div>
                <div>
                  <label className="lbl">Año</label>
                  <input
                    className="inp"
                    type="number"
                    value={anio}
                    onChange={e => setAnio(parseInt(e.target.value) || 2026)}
                  />
                </div>
              </div>
            )}

            <button
              className="rpt-generate"
              onClick={handleGenerar}
              disabled={cargando}
            >
              <i className="ti ti-file-type-pdf"></i>
              {cargando ? 'Generando...' : 'Generar reporte PDF'}
            </button>

            <div style={{ textAlign: 'center', fontSize: '12px', color: '#94a3b8', marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
              <i className="ti ti-info-circle" style={{ fontSize: '14px' }}></i>
              El reporte se guardará en la carpeta del sistema
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '220px' }}>
            <div style={{ textAlign: 'center', color: '#94a3b8' }}>
              <i className="ti ti-report-analytics" style={{ fontSize: '64px', display: 'block', marginBottom: '10px', color: '#cbd5e1' }}></i>
              <div style={{ fontSize: '13px', fontWeight: 500, color: '#64748b' }}>Vista previa del reporte</div>
              <div style={{ fontSize: '12px', marginTop: '4px' }}>Selecciona la fecha y genera</div>
            </div>
          </div>
        </div>
      </div>

      <div className="rpt-recent">
        <div className="tbl-top">
          <span className="tbl-top-title">
            <i className="ti ti-clock" style={{ fontSize: '15px', marginRight: '6px', verticalAlign: '-2px', color: '#64748b' }}></i>
            Reportes recientes
          </span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Período</th>
              <th>Tipo</th>
              <th>Fecha generación</th>
              <th>Usuario</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {recientes.length === 0 ? (
              <tr>
                <td colSpan="5">
                  <div className="rpt-empty">
                    <i className="ti ti-file-off"></i>
                    <span style={{ fontSize: '13px', fontWeight: 500 }}>Sin reportes generados</span>
                    <span style={{ fontSize: '12px' }}>Los reportes que generes aparecerán aquí</span>
                  </div>
                </td>
              </tr>
            ) : (
              recientes.map(r => (
                <tr key={r.id}>
                  <td className="td-bold">{r.periodo}</td>
                  <td><span className="badge bg-blue">{r.tipo}</span></td>
                  <td style={{ color: '#64748b' }}>{r.fechaGen}</td>
                  <td>{r.usuario}</td>
                  <td><span className="badge bg-green">Generado</span></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </PageLayout>
  );
}
