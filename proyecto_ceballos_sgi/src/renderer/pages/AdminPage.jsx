import { useState, useEffect } from 'react';
import PageLayout from '../components/PageLayout';
import Modal from '../components/Modal';
import Alert from '../components/Alert';
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
      if (tab === 'usuarios') {
        setUsuarios(await listarUsuarios());
      } else {
        setLogs(await consultarAuditLog({}));
      }
    } catch {
      setAlerta({ type: 'error', msg: 'Error al cargar datos administrativos' });
    } finally {
      setLoading(false);
    }
  }

  async function handleCrear() {
    if (!form.nombre || !form.usuario || !form.password) {
      setAlerta({ type: 'error', msg: 'Completa todos los campos obligatorios' });
      return;
    }
    try {
      await crearUsuario(form);
      setAlerta({ type: 'success', msg: 'Usuario creado exitosamente' });
      setModalNuevo(false);
      setForm({ nombre: '', usuario: '', password: '', rol: 'CAJERO' });
      cargar();
    } catch (e) {
      setAlerta({ type: 'error', msg: e.message });
    }
  }

  function getRolBadge(rol) {
    switch (rol) {
      case 'ADMINISTRADOR': return 'bg-blue';
      case 'SUPERVISOR': return 'bg-yellow';
      default: return 'bg-gray';
    }
  }

  return (
    <PageLayout
      title="Administración"
      subtitle="Usuarios y auditoría del sistema"
      icon="ti-shield-check"
    >
      {alerta && (
        <div style={{ marginBottom: '14px' }}>
          <Alert type={alerta.type} message={alerta.msg} onClose={() => setAlerta(null)} />
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div className="tab-row" style={{ marginBottom: 0 }}>
          <button
            type="button"
            className={`tab-btn ${tab === 'usuarios' ? 'on' : ''}`}
            onClick={() => setTab('usuarios')}
          >
            <i className="ti ti-users"></i>Usuarios
          </button>
          <button
            type="button"
            className={`tab-btn ${tab === 'audit' ? 'on' : ''}`}
            onClick={() => setTab('audit')}
          >
            <i className="ti ti-eye"></i>Auditoría
          </button>
        </div>

        {tab === 'usuarios' && (
          <button className="btn btn-dark" onClick={() => setModalNuevo(true)}>
            <i className="ti ti-plus"></i>Nuevo usuario
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <Spinner />
        </div>
      ) : tab === 'usuarios' ? (
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Creado</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>
                    Sin usuarios registrados
                  </td>
                </tr>
              ) : (
                usuarios.map(u => (
                  <tr key={u.id}>
                    <td className="td-bold">{u.nombre}</td>
                    <td className="td-mono">{u.usuario}</td>
                    <td>
                      <span className={`badge ${getRolBadge(u.rol)}`}>
                        {u.rol}
                      </span>
                    </td>
                    <td style={{ color: '#64748b' }}>
                      {new Date(u.createdAt).toLocaleDateString('es-DO')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Tabla</th>
                <th>Acción</th>
                <th>Usuario</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>
                    Sin registros de auditoría
                  </td>
                </tr>
              ) : (
                logs.map(l => (
                  <tr key={l.id}>
                    <td>{l.tabla}</td>
                    <td>
                      <span className="at-accion">{l.accion}</span>
                    </td>
                    <td>{l.usuario?.nombre || '—'}</td>
                    <td style={{ color: '#64748b' }}>
                      {new Date(l.fecha).toLocaleString('es-DO')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Nuevo Usuario */}
      <Modal open={modalNuevo} title="Nuevo Usuario" onClose={() => setModalNuevo(false)} size="sm">
        <div style={{ padding: '8px 0' }}>
          <div style={{ marginBottom: '12px' }}>
            <label className="lbl">Nombre completo</label>
            <input
              className="inp"
              value={form.nombre}
              onChange={e => setForm({ ...form, nombre: e.target.value })}
            />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label className="lbl">Usuario (login)</label>
            <input
              className="inp"
              value={form.usuario}
              onChange={e => setForm({ ...form, usuario: e.target.value })}
            />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label className="lbl">Contraseña</label>
            <input
              className="inp"
              type="password"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label className="lbl">Rol</label>
            <select
              className="inp"
              value={form.rol}
              onChange={e => setForm({ ...form, rol: e.target.value })}
            >
              <option value="CAJERO">CAJERO</option>
              <option value="ADMINISTRADOR">ADMINISTRADOR</option>
              <option value="SUPERVISOR">SUPERVISOR</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setModalNuevo(false)}>
              Cancelar
            </button>
            <button className="btn btn-dark" style={{ flex: 1, justifyContent: 'center' }} onClick={handleCrear}>
              Crear Usuario
            </button>
          </div>
        </div>
      </Modal>
    </PageLayout>
  );
}
