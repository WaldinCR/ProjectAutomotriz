// Cambio de contraseña del propio usuario.
// `obligatorio`: la contraseña es temporal (usuario nuevo o restablecida) y no se puede omitir.
import { useState } from 'react';
import Alert from './Alert';
import Field from './Field';
import { cambiarPassword } from '../services/authService';
import { useAuthStore } from '../store/authStore';

export default function CambiarPassword({ obligatorio = false, onListo, onCancelar }) {
  const { setAuth } = useAuthStore();
  const [f, setF] = useState({ actual: '', nueva: '', confirmar: '' });
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const set = (campo) => (e) => { setF({ ...f, [campo]: e.target.value }); setError(''); };

  async function guardar(e) {
    e.preventDefault();
    if (!f.actual) return setError('Indique su contraseña actual');
    if (f.nueva.length < 8) return setError('La nueva contraseña debe tener al menos 8 caracteres');
    if (f.nueva !== f.confirmar) return setError('Las contraseñas no coinciden');
    if (f.nueva === f.actual) return setError('La nueva contraseña debe ser distinta de la actual');
    setGuardando(true);
    try {
      const usuario = await cambiarPassword(f.actual, f.nueva);
      setAuth(usuario);
      onListo?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar}>
      {obligatorio && (
        <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '12px' }}>
          Su contraseña es temporal. Por seguridad, defina una nueva para continuar.
        </p>
      )}
      {error && <Alert type="error" message={error} />}
      <Field label={obligatorio ? 'Contraseña temporal' : 'Contraseña actual'} className="mb-3">
        <input className="inp" type="password" autoFocus value={f.actual} onChange={set('actual')} />
      </Field>
      <Field label="Nueva contraseña (mínimo 8 caracteres)" className="mb-3">
        <input className="inp" type="password" value={f.nueva} onChange={set('nueva')} />
      </Field>
      <Field label="Confirmar nueva contraseña">
        <input className="inp" type="password" value={f.confirmar} onChange={set('confirmar')} />
      </Field>
      <div className="modal-actions">
        {onCancelar && <button type="button" className="btn btn-ghost" onClick={onCancelar}>{obligatorio ? 'Cerrar sesión' : 'Cancelar'}</button>}
        <button type="submit" className="btn btn-dark" disabled={guardando}>{guardando ? 'Guardando...' : 'Cambiar contraseña'}</button>
      </div>
    </form>
  );
}
