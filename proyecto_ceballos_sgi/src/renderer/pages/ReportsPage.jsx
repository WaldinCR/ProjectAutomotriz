import { useState } from 'react';
import PageLayout from '../components/PageLayout';
import Alert from '../components/Alert';
import { reporteDiario, reporteMensual, reporteInventario, abrirReporte } from '../services/reportsService';
import { useAuthStore } from '../store/authStore';
import { hoyISO } from '../lib/format';

const TIPOS = {
  diario: 'Diario',
  mensual: 'Mensual',
  inventario: 'Inventario',
};

export default function ReportsPage() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState('diario');
  const [fecha, setFecha] = useState(hoyISO());
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [alerta, setAlerta] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [recientes, setRecientes] = useState([]);

  async function handleGenerar() {
    if (tab === 'diario' && fecha > hoyISO()) {
      setAlerta({ type: 'error', msg: 'No se puede generar un reporte de una fecha futura' });
      return;
    }
    setCargando(true);
    try {
      let ruta;
      if (tab === 'diario') ruta = await reporteDiario(fecha);
      else if (tab === 'mensual') ruta = await reporteMensual({ mes, anio });
      else ruta = await reporteInventario();

      setRecientes(prev => [{
        id: Date.now(),
        periodo: tab === 'diario' ? fecha : tab === 'mensual' ? `${String(mes).padStart(2, '0')}/${anio}` : hoyISO(),
        tipo: TIPOS[tab],
        fechaGen: new Date().toLocaleString('es-DO'),
        usuario: user?.nombre,
        ruta,
      }, ...prev]);
      setAlerta({ type: 'success', msg: `Reporte guardado en: ${ruta}` });
    } catch (e) {
      setAlerta({ type: 'error', msg: e.message });
    } finally {
      setCargando(false);
    }
  }

  return (
    <PageLayout
      title="Reportes"
      subtitle="Genera y exporta reportes de ventas e inventario"
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
              <button
                type="button"
                className={`period-btn ${tab === 'inventario' ? 'on' : ''}`}
                onClick={() => setTab('inventario')}
              >
                <i className="ti ti-package"></i>Inventario
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
                    max={hoyISO()}
                    value={fecha}
                    onChange={e => setFecha(e.target.value)}
                  />
                </div>
              </div>
            ) : tab === 'inventario' ? (
              <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '14px' }}>
                Existencias actuales, productos bajo el mínimo y movimientos de los últimos 30 días.
              </p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                <div>
                  <label className="lbl">Mes</label>
                  <select className="inp" value={mes} onChange={e => setMes(Number(e.target.value))}>
                    {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
                      .map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="lbl">Año</label>
                  <input
                    className="inp"
                    type="number"
                    min="2000"
                    max={new Date().getFullYear()}
                    value={anio}
                    onChange={e => setAnio(parseInt(e.target.value) || new Date().getFullYear())}
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
              El reporte PDF se guardará en su carpeta de Descargas
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
              <th></th>
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
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => abrirReporte(r.ruta).catch(e => setAlerta({ type: 'error', msg: e.message }))}>
                      <i className="ti ti-external-link" style={{ fontSize: '12px' }}></i>Abrir
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </PageLayout>
  );
}
