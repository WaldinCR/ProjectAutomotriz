import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, rutaInicial } from '../store/authStore';
import { login } from '../services/authService';
import logoImg from '../assets/login-logo-clean.png';

export default function LoginPage() {
  const [form, setForm] = useState({ usuario: '', password: '' });
  // Si se llegó aquí por expiración de sesión, se muestra el motivo
  const [error, setError] = useState(() => useAuthStore.getState().avisoSesion);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState('usuario');
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
      const usuario = await login(form.usuario.trim(), form.password);
      setAuth(usuario);
      navigate(rutaInicial(usuario.rol));
    } catch (e) {
      setError(e.message || 'Credenciales incorrectas');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      background: 'linear-gradient(135deg, #eef3f9 0%, #f7f9fc 50%, #edf2f7 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif"
    }}>

      {/* Decorative Left Navy Octagon Badge */}
      <div style={{
        position: 'absolute',
        left: '-70px',
        top: '25%',
        width: '190px',
        height: '380px',
        background: '#0a2240',
        clipPath: 'polygon(0 0, 75% 0, 100% 25%, 100% 75%, 75% 100%, 0 100%)',
        borderLeft: '4px solid #f59e0b',
        boxShadow: '0 20px 40px rgba(10, 34, 64, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        justifyContent: 'center',
        paddingRight: '18px',
        gap: '12px',
        zIndex: 1,
      }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }}></div>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }}></div>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }}></div>
      </div>

      {/* Decorative Right Gear Silhouette */}
      <svg
        style={{
          position: 'absolute',
          right: '-90px',
          top: '20%',
          width: '440px',
          height: '440px',
          opacity: 0.15,
          color: '#64748b',
          zIndex: 1,
          pointerEvents: 'none',
        }}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <circle cx="12" cy="12" r="3" />
      </svg>

      {/* Decorative Circuit Lines (Background SVG) */}
      <svg
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: 0.35,
          zIndex: 1,
          pointerEvents: 'none',
        }}
      >
        <path d="M 120 180 L 260 180 L 320 240 L 400 240" fill="none" stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 4" />
        <circle cx="400" cy="240" r="3" fill="#f59e0b" />
        <path d="M 760 140 L 850 140 L 920 200 L 1050 200" fill="none" stroke="#f59e0b" strokeWidth="1.2" />
        <circle cx="760" cy="140" r="3" fill="#f59e0b" />
        <path d="M 80 720 L 180 720 L 240 660 L 340 660" fill="none" stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 3" />
        <circle cx="340" cy="660" r="3" fill="#94a3b8" />
        <path d="M 740 760 L 820 680 L 960 680" fill="none" stroke="#3b82f6" strokeWidth="1" opacity="0.4" />
      </svg>

      {/* Main Container */}
      <div style={{
        position: 'relative',
        zIndex: 2,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        margin: '20px',
      }}>

        {/* Top Logo */}
        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
          <img
            src={logoImg}
            alt="Logo SGI Automotriz"
            style={{
              height: '105px',
              objectFit: 'contain',
              filter: 'drop-shadow(0 8px 16px rgba(10, 34, 64, 0.12))',
            }}
          />
        </div>

        {/* Card */}
        <div style={{
          width: '430px',
          maxWidth: '92vw',
          background: '#ffffff',
          borderRadius: '26px',
          boxShadow: '0 24px 60px -12px rgba(15, 39, 68, 0.16), 0 0 1px 1px rgba(0, 0, 0, 0.04)',
          position: 'relative',
          padding: '40px 36px 44px',
        }}>

          {/* Orange Top Accent Notch */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '130px',
            height: '5px',
            background: '#f59e0b',
            borderRadius: '0 0 6px 6px',
          }}></div>

          {/* Orange Bottom Accent Notch */}
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '110px',
            height: '5px',
            background: '#f59e0b',
            borderRadius: '6px 6px 0 0',
          }}></div>

          {/* Card Title */}
          <h1 style={{
            fontSize: '32px',
            fontWeight: 800,
            color: '#082846',
            letterSpacing: '-0.02em',
            textAlign: 'center',
            marginBottom: '4px',
          }}>
            Iniciar sesión
          </h1>

          <p style={{
            fontSize: '13px',
            color: '#64748b',
            textAlign: 'center',
            marginBottom: '10px',
            fontWeight: 500,
          }}>
            Sistema de Gestión Automotriz
          </p>

          {/* Little Orange Line */}
          <div style={{
            width: '34px',
            height: '3px',
            background: '#f59e0b',
            borderRadius: '2px',
            margin: '0 auto 26px',
          }}></div>

          {/* Error Message */}
          {error && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#dc2626',
              fontSize: '12px',
              borderRadius: '10px',
              padding: '10px 14px',
              marginBottom: '18px',
              textAlign: 'center',
              fontWeight: 500,
            }}>
              {error}
            </div>
          )}

          {/* Form Fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Usuario Field */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 700,
                color: '#082846',
                marginBottom: '7px',
              }}>
                Usuario
              </label>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                height: '48px',
                padding: '0 14px',
                background: '#ffffff',
                borderRadius: '12px',
                border: focusedField === 'usuario' ? '2px solid #2563eb' : '1.5px solid #d1d5db',
                boxShadow: focusedField === 'usuario' ? '0 0 0 3px rgba(37, 99, 235, 0.1)' : 'none',
                transition: 'all 0.15s ease',
              }}>
                <i className="ti ti-user" style={{
                  fontSize: '18px',
                  color: focusedField === 'usuario' ? '#2563eb' : '#94a3b8',
                  marginRight: '12px',
                }}></i>

                <input
                  type="text"
                  placeholder=""
                  value={form.usuario}
                  onFocus={() => setFocusedField('usuario')}
                  onChange={e => setForm({ ...form, usuario: e.target.value })}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  style={{
                    border: 'none',
                    outline: 'none',
                    width: '100%',
                    fontSize: '14px',
                    color: '#0f172a',
                    background: 'transparent',
                    fontFamily: 'inherit',
                  }}
                  autoFocus
                />
              </div>
            </div>

            {/* Contraseña Field */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 700,
                color: '#082846',
                marginBottom: '7px',
              }}>
                Contraseña
              </label>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                height: '48px',
                padding: '0 14px',
                background: focusedField === 'password' ? '#ffffff' : '#f8fafc',
                borderRadius: '12px',
                border: focusedField === 'password' ? '2px solid #2563eb' : '1.5px solid #e2e8f0',
                boxShadow: focusedField === 'password' ? '0 0 0 3px rgba(37, 99, 235, 0.1)' : 'none',
                transition: 'all 0.15s ease',
              }}>
                <i className="ti ti-lock" style={{
                  fontSize: '18px',
                  color: focusedField === 'password' ? '#2563eb' : '#94a3b8',
                  marginRight: '12px',
                }}></i>

                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder=""
                  value={form.password}
                  onFocus={() => setFocusedField('password')}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  style={{
                    border: 'none',
                    outline: 'none',
                    width: '100%',
                    fontSize: '14px',
                    color: '#0f172a',
                    background: 'transparent',
                    fontFamily: 'inherit',
                  }}
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                    padding: 0,
                  }}
                  title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                >
                  <i className={`ti ${showPassword ? 'ti-eye-off' : 'ti-eye'}`} style={{ fontSize: '18px' }}></i>
                </button>
              </div>
            </div>

            {/* Entrar Button */}
            <button
              onClick={handleLogin}
              disabled={loading}
              style={{
                marginTop: '10px',
                height: '48px',
                background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)',
                border: 'none',
                borderRadius: '12px',
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 6px 16px rgba(37, 99, 235, 0.3)',
                transition: 'transform 0.1s ease, box-shadow 0.15s ease',
                fontFamily: 'inherit',
              }}
              onMouseEnter={e => {
                if (!loading) {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 8px 20px rgba(37, 99, 235, 0.4)';
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(37, 99, 235, 0.3)';
              }}
            >
              <i className="ti ti-login-2" style={{ fontSize: '19px' }}></i>
              {loading ? 'Iniciando sesión...' : 'Entrar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
