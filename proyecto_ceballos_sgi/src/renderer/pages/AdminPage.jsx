import { useState, useEffect } from 'react';
import PageLayout from '../components/PageLayout';
import Modal from '../components/Modal';
import Alert from '../components/Alert';
import Spinner from '../components/Spinner';
import Field from '../components/Field';
import {
  listarUsuarios, crearUsuario, editarUsuario, restablecerPassword, consultarAuditLog, realizarBackup,
} from '../services/adminService';
import { useAuthStore, ROLES } from '../store/authStore';
import { NOMBRE_ROL } from '../lib/navigation';
import { fechaHora } from '../lib/format';

const NUEVO = { nombre: '', usuario: '', password: '', confirmar: '', rol: ROLES.CAJERO };
const FILTROS = { usuarioId: '', accion: '', desde: '', hasta: '' };
const ROL_BADGE = { [ROLES.ADMIN]: 'bg-blue', [ROLES.SUPERVISOR]: 'bg-yellow', [ROLES.CAJERO]: 'bg-gray' };

function validarPassword(password, confirmar) {
  if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
  if (password !== confirmar) return 'Las contraseñas no coinciden';
  return '';
}

function JsonBloque({ titulo, json }) {
  if (!json) return null;
  let texto = json;
  try { texto = JSON.stringify(JSON.parse(json), null, 2); } catch { /* se muestra tal cual */ }
  return (
    <div style={{ marginBottom: '12px' }}>
      <div className="lbl">{titulo}</div>
      <pre style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px', fontSize: '11px', maxHeight: '220px', overflow: 'auto', whiteSpace: 'pre-wrap' }}>{texto}</pre>
    </div>
  );
}

export default function AdminPage() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState('usuarios');
  const [usuarios, setUsuarios] = useState([]);
  const [logs, setLogs] = useState([]);
  const [filtros, setFiltros] = useState(FILTROS);
  const [loading, setLoading] = useState(true);
  const [alerta, setAlerta] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const [nuevo, setNuevo] = useState(null);         // { form, error }
  const [edicion, setEdicion] = useState(null);     // { id, nombre, rol, activo, error }
  const [reset, setReset] = useState(null);         // { usuario, password, confirmar, error }
  const [logDetalle, setLogDetalle] = useState(null);

  useEffect(() => { cargar(); }, [tab]);

  async function cargar(f = filtros) {
    setLoading(true);
    try {
      // La lista de usuarios también alimenta el filtro de auditoría
      const lista = await listarUsuarios();
      setUsuarios(lista);
      if (tab === 'audit') {
        setLogs(await consultarAuditLog({ ...f, usuarioId: f.usuarioId ? Number(f.usuarioId) : undefined }));
      }
    } catch (e) {
      setAlerta({ type: 'error', msg: e.message });
    } finally {
      setLoading(false);
    }
  }

  async function guardarNuevo() {
    const f = nuevo.form;
    let error = '';
    if (!f.nombre.trim() || !f.usuario.trim()) error = 'Complete el nombre y el usuario';
    else if (!/^[a-zA-Z0-9._-]+$/.test(f.usuario.trim())) error = 'El usuario solo puede contener letras, números, punto, guion y guion bajo';
    else error = validarPassword(f.password, f.confirmar);
    if (error) return setNuevo(n => ({ ...n, error }));

    setGuardando(true);
    try {
      await crearUsuario({ nombre: f.nombre, usuario: f.usuario.trim(), password: f.password, rol: f.rol });
      setAlerta({ type: 'success', msg: `Usuario ${f.usuario.trim().toLowerCase()} creado` });
      setNuevo(null);
      cargar();
    } catch (e) {
      setNuevo(n => ({ ...n, error: e.message }));
    } finally {
      setGuardando(false);
    }
  }

  async function guardarEdicion() {
    if (!edicion.nombre.trim()) return setEdicion(ed => ({ ...ed, error: 'El nombre es requerido' }));
    setGuardando(true);
    try {
      await editarUsuario({ id: edicion.id, nombre: edicion.nombre, rol: edicion.rol, activo: edicion.activo });
      setAlerta({ type: 'success', msg: 'Usuario actualizado' });
      setEdicion(null);
      cargar();
    } catch (e) {
      setEdicion(ed => ({ ...ed, error: e.message }));
    } finally {
      setGuardando(false);
    }
  }

  async function guardarReset() {
    const error = validarPassword(reset.password, reset.confirmar);
    if (error) return setReset(r => ({ ...r, error }));
    setGuardando(true);
    try {
      await restablecerPassword({ id: reset.usuario.id, password: reset.password });
      setAlerta({ type: 'success', msg: `Contraseña de ${reset.usuario.usuario} restablecida` });
      setReset(null);
      cargar();
    } catch (e) {
      setReset(r => ({ ...r, error: e.message }));
    } finally {
      setGuardando(false);
    }
  }

  async function handleBackup() {
    setGuardando(true);
    try {
      const r = await realizarBackup();
      setAlerta({ type: 'success', msg: `Respaldo creado: ${r.path}` });
    } catch (e) {
      setAlerta({ type: 'error', msg: e.message });
    } finally {
      setGuardando(false);
    }
  }

  const bloqueado = (u) => u.bloqueadoHasta && new Date(u.bloqueadoHasta) > new Date();

  return (
    <PageLayout
      title="Administración"
      subtitle="Usuarios, auditoría y respaldos del sistema"
      actions={
        <button className="btn btn-ghost" onClick={handleBackup} disabled={guardando}>
          <i className="ti ti-database-export"></i>Respaldar ahora
        </button>
      }
    >
      {alerta && (
        <div style={{ marginBottom: '14px' }}>
          <Alert type={alerta.type} message={alerta.msg} onClose={() => setAlerta(null)} />
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div className="tab-row" style={{ marginBottom: 0 }}>
          <button type="button" className={`tab-btn ${tab === 'usuarios' ? 'on' : ''}`} onClick={() => setTab('usuarios')}>
            <i className="ti ti-users"></i>Usuarios
          </button>
          <button type="button" className={`tab-btn ${tab === 'audit' ? 'on' : ''}`} onClick={() => setTab('audit')}>
            <i className="ti ti-eye"></i>Auditoría
          </button>
        </div>

        {tab === 'usuarios' && (
          <button className="btn btn-dark" onClick={() => setNuevo({ form: NUEVO })}>
            <i className="ti ti-plus"></i>Nuevo usuario
          </button>
        )}
      </div>

      {tab === 'audit' && (
        <div className="card" style={{ padding: '12px 14px', marginBottom: '14px', display: 'grid', gridTemplateColumns: '1fr 1fr 150px 150px auto', gap: '10px', alignItems: 'end' }}>
          <Field label="Usuario">
            <select className="inp" value={filtros.usuarioId} onChange={e => setFiltros({ ...filtros, usuarioId: e.target.value })}>
              <option value="">Todos</option>
              {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select>
          </Field>
          <Field label="Acción contiene">
            <input className="inp" placeholder="Ej: ANULAR, LOGIN, PRECIO" value={filtros.accion} onChange={e => setFiltros({ ...filtros, accion: e.target.value })} />
          </Field>
          <Field label="Desde">
            <input className="inp" type="date" value={filtros.desde} onChange={e => setFiltros({ ...filtros, desde: e.target.value })} />
          </Field>
          <Field label="Hasta">
            <input className="inp" type="date" value={filtros.hasta} onChange={e => setFiltros({ ...filtros, hasta: e.target.value })} />
          </Field>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button className="btn btn-dark" onClick={() => cargar()}>Filtrar</button>
            <button className="btn btn-ghost" onClick={() => { setFiltros(FILTROS); cargar(FILTROS); }}>Limpiar</button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center' }}><Spinner /></div>
      ) : tab === 'usuarios' ? (
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr><th>Nombre</th><th>Usuario</th><th>Rol</th><th>Estado</th><th>Último acceso</th><th></th></tr>
            </thead>
            <tbody>
              {usuarios.map(u => (
                <tr key={u.id} style={u.activo ? undefined : { opacity: 0.55 }}>
                  <td className="td-bold">{u.nombre}{u.id === user?.id && <span className="muted"> (usted)</span>}</td>
                  <td className="td-mono">{u.usuario}</td>
                  <td><span className={`badge ${ROL_BADGE[u.rol] || 'bg-gray'}`}>{NOMBRE_ROL[u.rol] || u.rol}</span></td>
                  <td>
                    {!u.activo ? <span className="badge bg-gray">Inactivo</span>
                      : bloqueado(u) ? <span className="badge bg-red" title={`Hasta ${fechaHora(u.bloqueadoHasta)}`}>Bloqueado</span>
                      : <span className="badge bg-green">Activo</span>}
                  </td>
                  <td style={{ color: '#64748b' }}>{fechaHora(u.ultimoAcceso)}</td>
                  <td>
                    <div className="row-actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => setEdicion({ id: u.id, nombre: u.nombre, rol: u.rol, activo: u.activo })}>
                        <i className="ti ti-pencil" style={{ fontSize: '12px' }}></i>Editar
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setReset({ usuario: u, password: '', confirmar: '' })}>
                        <i className="ti ti-key" style={{ fontSize: '12px' }}></i>Contraseña
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr><th>Fecha</th><th>Tabla</th><th>Acción</th><th>Registro</th><th>Usuario</th><th></th></tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>Sin registros de auditoría</td></tr>
              ) : logs.map(l => (
                <tr key={l.id}>
                  <td style={{ color: '#64748b' }}>{fechaHora(l.fecha)}</td>
                  <td>{l.tabla}</td>
                  <td><span className="at-accion">{l.accion}</span></td>
                  <td className="td-mono">{l.registroId ?? '—'}</td>
                  <td>{l.usuario?.nombre || '—'}</td>
                  <td>
                    {(l.datosAnteriores || l.datosNuevos) && (
                      <button className="btn btn-ghost btn-sm" onClick={() => setLogDetalle(l)} title="Ver datos">
                        <i className="ti ti-file-search" style={{ fontSize: '12px' }}></i>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {logs.length === 500 && <p className="muted" style={{ fontSize: '12px', padding: '10px' }}>Se muestran los 500 registros más recientes. Use los filtros para acotar.</p>}
        </div>
      )}

      {/* Nuevo usuario */}
      <Modal open={!!nuevo} title="Nuevo usuario" onClose={() => setNuevo(null)} size="sm">
        {nuevo && (
          <>
            {nuevo.error && <Alert type="error" message={nuevo.error} />}
            {[
              ['nombre', 'Nombre completo', 'text'],
              ['usuario', 'Usuario (login)', 'text'],
              ['password', 'Contraseña (mínimo 8 caracteres)', 'password'],
              ['confirmar', 'Confirmar contraseña', 'password'],
            ].map(([campo, label, type]) => (
              <Field key={campo} label={label} className="mb-3">
                <input
                  className="inp" type={type} autoFocus={campo === 'nombre'}
                  value={nuevo.form[campo]}
                  onChange={e => setNuevo(n => ({ form: { ...n.form, [campo]: e.target.value } }))}
                />
              </Field>
            ))}
            <Field label="Rol">
              <select className="inp" value={nuevo.form.rol} onChange={e => setNuevo(n => ({ form: { ...n.form, rol: e.target.value } }))}>
                {Object.values(ROLES).map(r => <option key={r} value={r}>{NOMBRE_ROL[r]}</option>)}
              </select>
            </Field>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setNuevo(null)}>Cancelar</button>
              <button className="btn btn-dark" onClick={guardarNuevo} disabled={guardando}>Crear usuario</button>
            </div>
          </>
        )}
      </Modal>

      {/* Editar usuario */}
      <Modal open={!!edicion} title="Editar usuario" onClose={() => setEdicion(null)} size="sm">
        {edicion && (
          <>
            {edicion.error && <Alert type="error" message={edicion.error} />}
            <Field label="Nombre completo" className="mb-3">
              <input className="inp" value={edicion.nombre} onChange={e => setEdicion(ed => ({ ...ed, nombre: e.target.value, error: '' }))} />
            </Field>
            <Field label="Rol" className="mb-3">
              <select className="inp" value={edicion.rol} onChange={e => setEdicion(ed => ({ ...ed, rol: e.target.value, error: '' }))}>
                {Object.values(ROLES).map(r => <option key={r} value={r}>{NOMBRE_ROL[r]}</option>)}
              </select>
            </Field>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
              <input type="checkbox" checked={edicion.activo} onChange={e => setEdicion(ed => ({ ...ed, activo: e.target.checked, error: '' }))} />
              Usuario activo (puede iniciar sesión)
            </label>
            <p className="muted" style={{ fontSize: '12px', marginTop: '10px' }}>
              Cambiar el rol o desactivar al usuario cierra sus sesiones abiertas.
            </p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setEdicion(null)}>Cancelar</button>
              <button className="btn btn-dark" onClick={guardarEdicion} disabled={guardando}>Guardar</button>
            </div>
          </>
        )}
      </Modal>

      {/* Restablecer contraseña (RF-07) */}
      <Modal open={!!reset} title={`Restablecer contraseña: ${reset?.usuario.usuario}`} onClose={() => setReset(null)} size="sm">
        {reset && (
          <>
            {reset.error && <Alert type="error" message={reset.error} />}
            <Field label="Nueva contraseña (mínimo 8 caracteres)" className="mb-3">
              <input className="inp" type="password" autoFocus value={reset.password} onChange={e => setReset(r => ({ ...r, password: e.target.value, error: '' }))} />
            </Field>
            <Field label="Confirmar contraseña">
              <input className="inp" type="password" value={reset.confirmar} onChange={e => setReset(r => ({ ...r, confirmar: e.target.value, error: '' }))} />
            </Field>
            <p className="muted" style={{ fontSize: '12px', marginTop: '10px' }}>También desbloquea la cuenta si estaba bloqueada por intentos fallidos.</p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setReset(null)}>Cancelar</button>
              <button className="btn btn-dark" onClick={guardarReset} disabled={guardando}>Restablecer</button>
            </div>
          </>
        )}
      </Modal>

      {/* Detalle de auditoría */}
      <Modal open={!!logDetalle} title={`${logDetalle?.accion} · ${fechaHora(logDetalle?.fecha)}`} onClose={() => setLogDetalle(null)} size="lg">
        {logDetalle && (
          <>
            <JsonBloque titulo="Datos anteriores" json={logDetalle.datosAnteriores} />
            <JsonBloque titulo="Datos nuevos" json={logDetalle.datosNuevos} />
          </>
        )}
      </Modal>
    </PageLayout>
  );
}
