import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import Alert from '../components/Alert';

export default function LoginPage() {
  const [form, setForm]   = useState({ usuario: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  async function handleLogin() {
    if (!form.usuario || !form.password) {
      setError('Ingresa usuario y contraseña');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await window.api.auth.login(form);
      setAuth(res.usuario, res.token);
      navigate('/pos');
    } catch (e) {
      setError(e.message || 'Credenciales incorrectas');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-white tracking-tight">SGI</h1>
          <p className="text-slate-400 text-sm mt-1">Sistema de Gestión Automotriz</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8 border border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800 mb-6">Iniciar sesión</h2>

          {error && (
            <Alert type="error" message={error} onClose={() => setError('')} />
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-650 mb-1">Usuario</label>
              <input
                type="text"
                className="w-full border border-slate-200 rounded-[8px] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 text-slate-900 placeholder-slate-400 transition"
                placeholder="Tu usuario"
                value={form.usuario}
                onChange={e => setForm({ ...form, usuario: e.target.value })}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-655 mb-1">Contraseña</label>
              <input
                type="password"
                className="w-full border border-slate-200 rounded-[8px] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 text-slate-900 placeholder-slate-400 transition"
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
              />
            </div>
            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full bg-[#1d4ed8] hover:bg-[#1e40af] text-white font-semibold py-2.5 rounded-[8px] transition-all duration-150 text-sm shadow-md mt-2"
            >
              {loading ? 'Verificando...' : 'Entrar'}
            </button>
          </div>
        </div>

        <p className="text-center text-slate-500 text-xs mt-6">
          Proyecto Ceballos — SGI v1.0
        </p>
      </div>
    </div>
  );
}
