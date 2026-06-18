// Pantalla de Login
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function LoginPage() {
  const [form, setForm]   = useState({ usuario: '', password: '' });
  const [error, setError] = useState('');
  const navigate           = useNavigate();
  const { setAuth }        = useAuthStore();

  async function handleLogin() {
    try {
      setError('');
      const res = await window.api.auth.login(form);
      setAuth(res.usuario, res.token);
      navigate('/pos');
    } catch (e) {
      setError(e.message || 'Error al iniciar sesión');
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl p-10 w-full max-w-md">
        <h1 className="text-3xl font-bold text-center text-blue-900 mb-2">SGI Automotriz</h1>
        <p className="text-center text-gray-500 mb-8">Sistema de Gestión Integral</p>

        {error && (
          <div className="bg-red-50 border border-red-300 text-red-700 rounded-lg p-3 mb-4 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <input
            type="text"
            placeholder="Usuario"
            value={form.usuario}
            onChange={e => setForm({...form, usuario: e.target.value})}
            className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={form.password}
            onChange={e => setForm({...form, password: e.target.value})}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleLogin}
            className="w-full bg-blue-800 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition"
          >
            Iniciar Sesión
          </button>
        </div>
      </div>
    </div>
  );
}
