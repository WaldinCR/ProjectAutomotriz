import { useState } from 'react';
import PageLayout from '../components/PageLayout';
import Alert from '../components/Alert';
import { reporteDiario, reporteMensual } from '../services/reportsService';

const DEFAULT_REPORTS = [
  { id: '1', titulo: 'Ventas — Septiembre 2026', detalle: 'Generado el 30 sep. · 1.2 MB', icon: 'ti-file-analytics' },
  { id: '2', titulo: 'Inventario crítico', detalle: 'Generado el 29 sep. · 640 KB', icon: 'ti-packages' },
  { id: '3', titulo: 'Resumen de caja', detalle: 'Generado el 28 sep. · 420 KB', icon: 'ti-receipt-2' },
];

export default function ReportsPage() {
  const [periodo, setPeriodo] = useState('Diario');
  const [fecha, setFecha] = useState('2026-10-01');
  const [cargando, setCargando] = useState(false);
  const [alerta, setAlerta] = useState(null);
  const [reportes, setReportes] = useState(DEFAULT_REPORTS);

  async function handleGenerar() {
    setCargando(true);
    setAlerta(null);
    try {
      let res;
      if (periodo === 'Diario') {
        if (window.api?.reports?.reporteDiario) {
          res = await reporteDiario(fecha);
        }
      } else {
        const parts = fecha.split('-');
        const anio = parseInt(parts[0]) || 2026;
        const mes = parseInt(parts[1]) || 10;
        if (window.api?.reports?.reporteMensual) {
          res = await reporteMensual({ mes, anio });
        }
      }

      const nuevo = {
        id: String(Date.now()),
        titulo: `${periodo === 'Diario' ? 'Ventas Diario' : 'Ventas Mensual'} — ${fecha}`,
        detalle: `Generado hoy · ${res?.filePath ? 'PDF exportado' : 'Listo'}`,
        icon: 'ti-file-analytics',
      };
      setReportes(prev => [nuevo, ...prev]);
      setAlerta({
        type: 'success',
        message: `Reporte generado con éxito. ${res?.filePath ? `Guardado en: ${res.filePath}` : ''}`,
      });
    } catch (err) {
      setAlerta({ type: 'error', message: err.message || 'Error al generar el reporte.' });
    } finally {
      setCargando(false);
    }
  }

  return (
    <PageLayout
      title="Reportes del Negocio"
      subtitle="Genera informes operativos para revisar el desempeño del negocio."
    >
      {alerta && (
        <div style={{ marginBottom: '16px' }}>
          <Alert type={alerta.type} message={alerta.message} onClose={() => setAlerta(null)} />
        </div>
      )}

      {/* Control bar */}
      <div className="card report-controls">
        <div>
          <label htmlFor="report-type">Período</label>
          <select
            id="report-type"
            className="select-control"
            value={periodo}
            onChange={e => setPeriodo(e.target.value)}
          >
            <option value="Diario">Diario</option>
            <option value="Mensual">Mensual</option>
          </select>
        </div>

        <div>
          <label htmlFor="report-date">Fecha de referencia</label>
          <input
            id="report-date"
            className="select-control"
            type="date"
            value={fecha}
            onChange={e => setFecha(e.target.value)}
          />
        </div>

        <button
          className="primary-btn"
          type="button"
          disabled={cargando}
          onClick={handleGenerar}
        >
          <i className="ti ti-download"></i>
          {cargando ? 'Generando...' : 'Generar reporte'}
        </button>
      </div>

      <h3 className="section-title" style={{ margin: '24px 0 16px' }}>
        Reportes recientes
      </h3>

      <div className="report-recent">
        {reportes.map(r => (
          <article
            key={r.id}
            className="card report-card"
            onClick={() => setAlerta({ type: 'info', message: `Descargando: ${r.titulo}` })}
          >
            <div className="report-file">
              <i className={`ti ${r.icon}`}></i>
            </div>
            <h3>{r.titulo}</h3>
            <p>{r.detalle}</p>
            <span className="download-label">PDF disponible</span>
          </article>
        ))}
      </div>
    </PageLayout>
  );
}
