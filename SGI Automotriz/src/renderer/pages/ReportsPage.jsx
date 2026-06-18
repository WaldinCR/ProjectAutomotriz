import { useState } from 'react';
import PageLayout from '../components/PageLayout';
import Button     from '../components/Button';
import Input      from '../components/Input';
import Alert      from '../components/Alert';
import { reporteDiario, reporteMensual } from '../services/reportsService';

export default function ReportsPage() {
  const [tab, setTab]        = useState('diario');
  const [fecha, setFecha]    = useState(new Date().toISOString().slice(0,10));
  const [mes, setMes]        = useState(new Date().getMonth()+1);
  const [anio, setAnio]      = useState(new Date().getFullYear());
  const [alerta, setAlerta]  = useState(null);
  const [cargando, setCargando] = useState(false);

  async function handleGenerar() {
    setCargando(true);
    try {
      if (tab==='diario') await reporteDiario(fecha);
      else await reporteMensual({ mes, anio });
      setAlerta({ type:'success', msg:'Reporte generado — revisa la carpeta de descargas' });
    } catch (e) { setAlerta({ type:'error', msg:e.message }); }
    finally { setCargando(false); }
  }

  return (
    <PageLayout title="📊 Reportes">
      {alerta && <Alert type={alerta.type} message={alerta.msg} onClose={() => setAlerta(null)} />}
      <div className="max-w-lg mx-auto bg-white rounded-xl shadow-sm border p-6 space-y-6">
        <div className="flex gap-2">
          {[['diario','📅 Diario'],['mensual','📆 Mensual']].map(([k,l]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                tab===k ? 'bg-blue-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>{l}</button>
          ))}
        </div>
        {tab==='diario' ? (
          <Input label="Fecha" type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <Input label="Mes" type="number" value={mes} onChange={e => setMes(e.target.value)} />
            <Input label="Año" type="number" value={anio} onChange={e => setAnio(e.target.value)} />
          </div>
        )}
        <Button variant="primary" size="lg" className="w-full" onClick={handleGenerar} disabled={cargando}>
          {cargando ? 'Generando...' : '📄 Generar Reporte PDF'}
        </Button>
        <p className="text-xs text-gray-400 text-center">El reporte se guardará en la carpeta del sistema</p>
      </div>
    </PageLayout>
  );
}
