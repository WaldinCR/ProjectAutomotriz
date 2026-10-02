import { useState, useEffect } from 'react';
import PageLayout from '../components/PageLayout';
import Alert from '../components/Alert';
import Field from '../components/Field';
import {
  reporteDiario, reporteMensual, reporteInventario, reporteVentas, exportarDgii, abrirDocumento, listarEmpleados,
} from '../services/reportsService';
import { listarProductos } from '../services/inventoryService';
import { useAuthStore, ROLES } from '../store/authStore';
import { hoyISO } from '../lib/format';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const TIPOS = {
  diario: {
    nombre: 'Diario', icono: 'ti-calendar-day',
    contenido: ['Total vendido, ticket promedio, ITBIS y anulaciones', 'Ventas por método de pago (gráfico)', 'Desempeño por cajero', 'Detalle de cada transacción con NCF', 'Cierres de caja del día y firmas'],
  },
  mensual: {
    nombre: 'Mensual', icono: 'ti-calendar-month',
    contenido: ['Ventas, ganancia bruta estimada y margen', 'Gráfico de ventas por día', 'Top 10 de productos con margen', 'Desempeño por cajero y órdenes del taller', 'Anulaciones, faltantes/sobrantes y conciliación de caja'],
  },
  inventario: {
    nombre: 'Inventario', icono: 'ti-package',
    contenido: ['Valor del inventario al costo y a precio de venta', 'Productos agotados y bajo el mínimo', 'Reposición sugerida con costo estimado', 'Existencias y movimientos de los últimos 30 días'],
  },
  ventas: {
    nombre: 'Ventas', icono: 'ti-filter',
    contenido: ['Filtros por rango de fechas, empleado y producto (RF-47)', 'Detalle por línea: factura, concepto, cantidad e importe', 'Totales de facturas, unidades e importe'],
  },
  dgii: {
    nombre: 'DGII 607/608', icono: 'ti-building-bank', soloAdmin: true,
    contenido: ['607: ventas con NCF del mes (monto, ITBIS, forma de pago)', '608: comprobantes anulados', 'Archivos CSV listos para pasar a la herramienta de envío de la DGII'],
  },
};

export default function ReportsPage() {
  const { user, tieneRol } = useAuthStore();
  const esAdmin = tieneRol(ROLES.ADMIN);
  const [tab, setTab] = useState('diario');
  const [fecha, setFecha] = useState(hoyISO());
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [filtros, setFiltros] = useState({ desde: hoyISO(new Date(new Date().getFullYear(), new Date().getMonth(), 1)), hasta: hoyISO(), usuarioId: '', productoId: '' });
  const [empleados, setEmpleados] = useState([]);
  const [productos, setProductos] = useState([]);
  const [alerta, setAlerta] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [recientes, setRecientes] = useState([]);

  useEffect(() => {
    if (tab !== 'ventas' || empleados.length) return;
    Promise.all([listarEmpleados(), listarProductos()])
      .then(([e, p]) => { setEmpleados(e); setProductos(p); })
      .catch(err => setAlerta({ type: 'error', msg: err.message }));
  }, [tab, empleados.length]);

  const periodoMes = `${MESES[mes - 1]} ${anio}`;

  async function handleGenerar() {
    if (tab === 'diario' && fecha > hoyISO()) {
      return setAlerta({ type: 'error', msg: 'No se puede generar un reporte de una fecha futura' });
    }
    if (tab === 'ventas' && filtros.desde > filtros.hasta) {
      return setAlerta({ type: 'error', msg: 'La fecha inicial no puede ser posterior a la final' });
    }
    setCargando(true);
    setAlerta(null);
    try {
      let archivos = [];
      let periodo = '';
      if (tab === 'diario') { archivos = [await reporteDiario(fecha)]; periodo = fecha; }
      if (tab === 'mensual') { archivos = [await reporteMensual({ mes, anio })]; periodo = periodoMes; }
      if (tab === 'inventario') { archivos = [await reporteInventario()]; periodo = `Corte ${hoyISO()}`; }
      if (tab === 'ventas') {
        archivos = [await reporteVentas({
          ...filtros,
          usuarioId: filtros.usuarioId ? Number(filtros.usuarioId) : undefined,
          productoId: filtros.productoId ? Number(filtros.productoId) : undefined,
        })];
        periodo = `${filtros.desde} → ${filtros.hasta}`;
      }
      if (tab === 'dgii') {
        const r = await exportarDgii({ mes, anio });
        archivos = [r.archivo607, r.archivo608];
        periodo = `${periodoMes} · 607: ${r.registros607} · 608: ${r.registros608}`;
      }

      setRecientes(prev => [
        ...archivos.map((ruta, i) => ({
          id: `${Date.now()}-${i}`,
          tipo: TIPOS[tab].nombre,
          periodo,
          archivo: ruta.split(/[\\/]/).pop(),
          ruta,
          fechaGen: new Date().toLocaleString('es-DO'),
          usuario: user?.nombre,
        })),
        ...prev,
      ]);
      // Los PDF se abren de inmediato; los CSV de la DGII quedan en la lista
      if (tab !== 'dgii') await abrirDocumento(archivos[0]);
      setAlerta({ type: 'success', msg: `Guardado en: ${archivos.join('  ·  ')}` });
    } catch (e) {
      setAlerta({ type: 'error', msg: e.message });
    } finally {
      setCargando(false);
    }
  }

  const tipo = TIPOS[tab];

  return (
    <PageLayout title="Reportes" subtitle="Informes de gestión en PDF con la identidad de la empresa">
      {alerta && (
        <div style={{ marginBottom: '14px' }}>
          <Alert type={alerta.type} message={alerta.msg} onClose={() => setAlerta(null)} />
        </div>
      )}

      <div className="rpt-card">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: '10px' }}>
              Tipo de reporte
            </div>
            <div className="rpt-period-row" style={{ flexWrap: 'wrap' }}>
              {Object.entries(TIPOS).filter(([, t]) => !t.soloAdmin || esAdmin).map(([clave, t]) => (
                <button key={clave} type="button" className={`period-btn ${tab === clave ? 'on' : ''}`} onClick={() => { setTab(clave); setAlerta(null); }}>
                  <i className={`ti ${t.icono}`}></i>{t.nombre}
                </button>
              ))}
            </div>

            {tab === 'diario' && (
              <Field label="Fecha" className="mb-4">
                <input className="inp" type="date" max={hoyISO()} value={fecha} onChange={e => setFecha(e.target.value)} />
              </Field>
            )}

            {(tab === 'mensual' || tab === 'dgii') && (
              <div className="form-grid" style={{ marginBottom: '14px' }}>
                <Field label="Mes">
                  <select className="inp" value={mes} onChange={e => setMes(Number(e.target.value))}>
                    {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                  </select>
                </Field>
                <Field label="Año">
                  <input className="inp" type="number" min="2000" max={new Date().getFullYear()} value={anio}
                    onChange={e => setAnio(parseInt(e.target.value) || new Date().getFullYear())} />
                </Field>
              </div>
            )}

            {tab === 'inventario' && (
              <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '14px' }}>
                Corte de existencias al momento de generar el reporte.
              </p>
            )}

            {tab === 'ventas' && (
              <div className="form-grid" style={{ marginBottom: '14px' }}>
                <Field label="Desde">
                  <input className="inp" type="date" max={hoyISO()} value={filtros.desde} onChange={e => setFiltros({ ...filtros, desde: e.target.value })} />
                </Field>
                <Field label="Hasta">
                  <input className="inp" type="date" max={hoyISO()} value={filtros.hasta} onChange={e => setFiltros({ ...filtros, hasta: e.target.value })} />
                </Field>
                <Field label="Empleado">
                  <select className="inp" value={filtros.usuarioId} onChange={e => setFiltros({ ...filtros, usuarioId: e.target.value })}>
                    <option value="">Todos</option>
                    {empleados.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                  </select>
                </Field>
                <Field label="Producto">
                  <select className="inp" value={filtros.productoId} onChange={e => setFiltros({ ...filtros, productoId: e.target.value })}>
                    <option value="">Todos</option>
                    {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </Field>
              </div>
            )}

            <button className="rpt-generate" onClick={handleGenerar} disabled={cargando}>
              <i className={`ti ${tab === 'dgii' ? 'ti-file-spreadsheet' : 'ti-file-type-pdf'}`}></i>
              {cargando ? 'Generando...' : tab === 'dgii' ? 'Exportar 607 y 608' : 'Generar y abrir PDF'}
            </button>
            <div style={{ textAlign: 'center', fontSize: '12px', color: '#94a3b8', marginTop: '8px' }}>
              <i className="ti ti-folder" style={{ fontSize: '14px' }}></i> Descargas › SGI Automotriz
            </div>
          </div>

          <div className="card" style={{ padding: '18px', background: '#f8fafc' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div className="caja-icon" style={{ background: '#e7f2fc' }}><i className={`ti ${tipo.icono}`} style={{ color: '#0677dd' }}></i></div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Reporte {tipo.nombre}</div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>Contenido del documento</div>
              </div>
            </div>
            <ul style={{ listStyle: 'none', display: 'grid', gap: '8px' }}>
              {tipo.contenido.map(c => (
                <li key={c} style={{ display: 'flex', gap: '8px', fontSize: '13px', color: '#334155' }}>
                  <i className="ti ti-circle-check" style={{ color: '#16794c', marginTop: '2px' }}></i>{c}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="rpt-recent">
        <div className="tbl-top">
          <span className="tbl-top-title">
            <i className="ti ti-clock" style={{ fontSize: '15px', marginRight: '6px', verticalAlign: '-2px', color: '#64748b' }}></i>
            Generados en esta sesión
          </span>
        </div>
        <table>
          <thead>
            <tr><th>Tipo</th><th>Período</th><th>Archivo</th><th>Generado</th><th>Usuario</th><th></th></tr>
          </thead>
          <tbody>
            {recientes.length === 0 ? (
              <tr>
                <td colSpan="6">
                  <div className="rpt-empty">
                    <i className="ti ti-file-off"></i>
                    <span style={{ fontSize: '13px', fontWeight: 500 }}>Sin reportes generados</span>
                    <span style={{ fontSize: '12px' }}>Los documentos que genere aparecerán aquí</span>
                  </div>
                </td>
              </tr>
            ) : recientes.map(r => (
              <tr key={r.id}>
                <td><span className="badge bg-blue">{r.tipo}</span></td>
                <td className="td-bold">{r.periodo}</td>
                <td className="td-mono" style={{ fontSize: '11px' }}>{r.archivo}</td>
                <td style={{ color: '#64748b' }}>{r.fechaGen}</td>
                <td>{r.usuario}</td>
                <td>
                  <button className="btn btn-ghost btn-sm" onClick={() => abrirDocumento(r.ruta).catch(e => setAlerta({ type: 'error', msg: e.message }))}>
                    <i className="ti ti-external-link" style={{ fontSize: '12px' }}></i>Abrir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageLayout>
  );
}
