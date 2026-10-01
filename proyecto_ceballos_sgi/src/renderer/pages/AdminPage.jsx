import { useState, useEffect } from 'react';
import PageLayout from '../components/PageLayout';
import Alert from '../components/Alert';
import { listarUsuarios, crearUsuario, consultarAuditLog } from '../services/adminService';

const DEFAULT_USERS = [
  { id: '1', usuario: 'admin.ceballos', nombre: 'Alberto Ceballos', rol: 'Administrador', estado: 'Activo', ultimoAcceso: 'Hoy · 5:40 PM' },
  { id: '2', usuario: 'm.rodriguez', nombre: 'María Rodríguez', rol: 'Vendedor', estado: 'Activo', ultimoAcceso: 'Hoy · 4:16 PM' },
  { id: '3', usuario: 'j.perez', nombre: 'Juan Pérez', rol: 'Técnico', estado: 'Activo', ultimoAcceso: 'Hoy · 3:55 PM' },
];

const DEFAULT_AUDIT = [
  { id: '1', fecha: '01 oct. 2026 · 5:42 PM', usuario: 'admin.ceballos', accion: 'Venta confirmada #V-10488', modulo: 'Punto de Venta' },
  { id: '2', fecha: '01 oct. 2026 · 4:16 PM', usuario: 'm.rodriguez', accion: 'Entrada de stock: Filtro de aceite', modulo: 'Inventario' },
  { id: '3', fecha: '01 oct. 2026 · 11:08 AM', usuario: 'j.perez', accion: 'Orden OT-284 creada', modulo: 'Órdenes de Trabajo' },
];

export default function AdminPage() {
  const [tab, setTab] = useState('usuarios');
  const [usuarios, setUsuarios] = useState(DEFAULT_USERS);
  const [auditLogs, setAuditLogs] = useState(DEFAULT_AUDIT);
  const [alerta, setAlerta] = useState(null);
  const [modalNuevo, setModalNuevo] = useState(false);
  const [form, setForm] = useState({
    nombre: '',
    usuario: '',
    password: '',
    rol: 'Vendedor',
  });

  useEffect(() => {
    cargarDatos();
  }, [tab]);

  async function cargarDatos() {
    try {
      if (tab === 'usuarios') {
        if (window.api?.admin?.listarUsuarios) {
          const res = await listarUsuarios();
          if (res && res.length > 0) {
            setUsuarios(res.map(u => ({
              id: u.id,
              usuario: u.usuario,
              nombre: u.nombre,
              rol: u.rol === 'ADMINISTRADOR' ? 'Administrador' : (u.rol === 'CAJERO' ? 'Vendedor' : u.rol),
              estado: 'Activo',
              ultimoAcceso: 'Hoy · Reciente',
            })));
            return;
          }
        }
        setUsuarios(DEFAULT_USERS);
      } else {
        if (window.api?.admin?.consultarAuditLog) {
          const res = await consultarAuditLog({});
          if (res && res.length > 0) {
            setAuditLogs(res.map(l => ({
              id: l.id,
              fecha: new Date(l.createdAt).toLocaleString('es-DO'),
              usuario: l.usuario?.usuario || 'Sistema',
              accion: l.accion,
              modulo: l.modulo || 'General',
            })));
            return;
          }
        }
        setAuditLogs(DEFAULT_AUDIT);
      }
    } catch {
      if (tab === 'usuarios') setUsuarios(DEFAULT_USERS);
      else setAuditLogs(DEFAULT_AUDIT);
    }
  }

  async function handleCrearUsuario(e) {
    e.preventDefault();
    if (!form.nombre || !form.usuario) {
      setAlerta({ type: 'warning', message: 'Completa los campos obligatorios.' });
      return;
    }

    try {
      if (window.api?.admin?.crearUsuario) {
        await crearUsuario({
          nombre: form.nombre,
          usuario: form.usuario,
          password: form.password || 'ceballos123',
          rol: form.rol === 'Administrador' ? 'ADMINISTRADOR' : 'CAJERO',
        });
      }
      const nuevo = {
        id: String(Date.now()),
        nombre: form.nombre,
        usuario: form.usuario,
        rol: form.rol,
        estado: 'Activo',
        ultimoAcceso: 'Recién creado',
      };
      setUsuarios(prev => [nuevo, ...prev]);
      setModalNuevo(false);
      setForm({ nombre: '', usuario: '', password: '', rol: 'Vendedor' });
      setAlerta({ type: 'success', message: 'Usuario creado exitosamente.' });
    } catch (err) {
      setAlerta({ type: 'error', message: err.message || 'Error al crear usuario.' });
    }
  }

  return (
    <PageLayout
      title="Administración del Sistema"
      subtitle="Usuarios, permisos y trazabilidad de operaciones del sistema."
      actions={
        <button
          className="primary-btn"
          type="button"
          onClick={() => setModalNuevo(true)}
        >
          <i className="ti ti-user-plus"></i> Nuevo usuario
        </button>
      }
    >
      {alerta && (
        <div style={{ marginBottom: '16px' }}>
          <Alert type={alerta.type} message={alerta.message} onClose={() => setAlerta(null)} />
        </div>
      )}

      {/* Tabs */}
      <div className="tabs" role="tablist">
        <button
          className={`tab ${tab === 'usuarios' ? 'active' : ''}`}
          type="button"
          onClick={() => setTab('usuarios')}
        >
          Usuarios
        </button>
        <button
          className={`tab ${tab === 'auditoria' ? 'active' : ''}`}
          type="button"
          onClick={() => setTab('auditoria')}
        >
          Auditoría
        </button>
      </div>

      {/* Panel Usuarios */}
      {tab === 'usuarios' && (
        <div className="card table-card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Nombre</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Último acceso</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map(u => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 700, color: 'var(--blue)' }}>{u.usuario}</td>
                    <td style={{ fontWeight: 600 }}>{u.nombre}</td>
                    <td>
                      <span className="status closed">{u.rol}</span>
                    </td>
                    <td>
                      <span className="status ready">{u.estado}</span>
                    </td>
                    <td style={{ color: 'var(--muted)' }}>{u.ultimoAcceso}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Panel Auditoría */}
      {tab === 'auditoria' && (
        <div className="card table-card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Usuario</th>
                  <th>Acción</th>
                  <th>Módulo</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map(l => (
                  <tr key={l.id}>
                    <td style={{ color: 'var(--muted)' }}>{l.fecha}</td>
                    <td style={{ fontWeight: 700 }}>{l.usuario}</td>
                    <td>{l.accion}</td>
                    <td>
                      <span className="status process">{l.modulo}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Nuevo Usuario */}
      {modalNuevo && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <form className="modal-dialog" onSubmit={handleCrearUsuario}>
            <div className="modal-head">
              <h2>Nuevo usuario</h2>
              <button
                className="icon-btn"
                type="button"
                onClick={() => setModalNuevo(false)}
                title="Cerrar"
              >
                <i className="ti ti-x"></i>
              </button>
            </div>
            <div className="modal-grid">
              <div>
                <label htmlFor="user-name">Nombre</label>
                <input
                  id="user-name"
                  required
                  placeholder="Nombre completo"
                  value={form.nombre}
                  onChange={e => setForm({ ...form, nombre: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="user-id">Usuario</label>
                <input
                  id="user-id"
                  required
                  placeholder="usuario.ceballos"
                  value={form.usuario}
                  onChange={e => setForm({ ...form, usuario: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="user-pass">Contraseña provisional</label>
                <input
                  id="user-pass"
                  type="password"
                  placeholder="ceballos123"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="user-role">Rol</label>
                <select
                  id="user-role"
                  value={form.rol}
                  onChange={e => setForm({ ...form, rol: e.target.value })}
                >
                  <option value="Vendedor">Vendedor</option>
                  <option value="Técnico">Técnico</option>
                  <option value="Administrador">Administrador</option>
                </select>
              </div>
            </div>
            <div className="modal-actions">
              <button
                className="secondary-btn"
                type="button"
                onClick={() => setModalNuevo(false)}
              >
                Cancelar
              </button>
              <button className="primary-btn" type="submit">
                Crear usuario
              </button>
            </div>
          </form>
        </div>
      )}
    </PageLayout>
  );
}
