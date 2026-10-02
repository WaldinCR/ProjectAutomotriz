import { useState, useEffect } from 'react';
import PageLayout from '../components/PageLayout';
import Button from '../components/Button';
import Input from '../components/Input';
import Modal from '../components/Modal';
import Table from '../components/Table';
import Alert from '../components/Alert';
import Badge from '../components/Badge';
import Spinner from '../components/Spinner';
import { listarUsuarios, crearUsuario, consultarAuditLog } from '../services/adminService';

export default function AdminPage() {
  const [tab, setTab] = useState('usuarios');
  const [usuarios, setUsuarios] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alerta, setAlerta] = useState(null);
  const [modalNuevo, setModalNuevo] = useState(false);
  const [form, setForm] = useState({ nombre: '', usuario: '', password: '', rol: 'CAJERO' });

  useEffect(() => { cargar(); }, [tab]);

  async function cargar() {
    setLoading(true);
    try {
      if (tab === 'usuarios') setUsuarios(await listarUsuarios());
      else setLogs(await consultarAuditLog({}));
    } catch { setAlerta({ type: 'error', msg: 'Error al cargar' }); }
    finally { setLoading(false); }
  }

  async function handleCrear() {
    try {
      await crearUsuario(form);
      setAlerta({ type: 'success', msg: 'Usuario creado' });
      setModalNuevo(false); setForm({ nombre: '', usuario: '', password: '', rol: 'CAJERO' }); cargar();
    } catch (e) { setAlerta({ type: 'error', msg: e.message }); }
  }

  const rowsU = usuarios.map(u => [
    u.nombre, u.usuario, <Badge label={u.rol} />,
    new Date(u.createdAt).toLocaleDateString('es-DO'),
  ]);
  const rowsL = logs.map(l => [
    l.tabla, l.accion, l.usuario?.nombre || '—', new Date(l.fecha).toLocaleString('es-DO'),
  ]);

  return (
    <PageLayout title="⚙️ Administración">
      {alerta && <Alert type={alerta.type} message={alerta.msg} onClose={() => setAlerta(null)} />}
      <div className="flex gap-2 mb-6">
        {[['usuarios', '👥 Usuarios'], ['audit', '🔍 Auditoría']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === k ? 'bg-blue-900 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'
              }`}>{l}</button>
        ))}
        {tab === 'usuarios' && <Button className="ml-auto" onClick={() => setModalNuevo(true)}>+ Nuevo Usuario</Button>}
      </div>
      {loading ? <Spinner /> : tab === 'usuarios' ? (
        <Table headers={['Nombre', 'Usuario', 'Rol', 'Creado']} rows={rowsU} />
      ) : (
        <Table headers={['Tabla', 'Acción', 'Usuario', 'Fecha']} rows={rowsL} emptyText="Sin registros" />
      )}
      <Modal open={modalNuevo} title="Nuevo Usuario" onClose={() => setModalNuevo(false)} size="sm">
        <div className="space-y-4">
          {[['nombre', 'Nombre completo', 'text'], ['usuario', 'Usuario (login)', 'text'],
          ['password', 'Contraseña', 'password']].map(([k, l, t]) => (
            <Input key={k} label={l} type={t} value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} />
          ))}
          <div>
            <label className="text-sm font-medium text-gray-700">Rol</label>
            <select className="w-full mt-1 border rounded-lg px-3 py-2 text-sm"
              value={form.rol} onChange={e => setForm({ ...form, rol: e.target.value })}>
              <option value="CAJERO">CAJERO</option>
              <option value="ADMINISTRADOR">ADMINISTRADOR</option>
              <option value="SUPERVISOR">SUPERVISOR</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" className="flex-1" onClick={() => setModalNuevo(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={handleCrear}>Crear Usuario</Button>
          </div>
        </div>
      </Modal>
    </PageLayout>
  );
}
