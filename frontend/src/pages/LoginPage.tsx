import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { loginSchema } from '../domain/entities/auth.schema';
import { BASE_URL } from '../infrastructure/api/client';
import { executeRecaptcha, showRecaptchaBadge, hideRecaptchaBadge } from '../infrastructure/recaptcha';
import '../styles/login.css';
import { useAuthContext } from '../application/context/useAuthContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const auth = useAuthContext();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    showRecaptchaBadge();
    return () => hideRecaptchaBadge();
  }, []);

  const handleSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    setError('');

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    setLoading(true);
    try {
      await executeRecaptcha('LOGIN');
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(parsed.data),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? 'Error al iniciar sesión');
        return;
      }

      auth.login(json.data.token, json.data.user);
      navigate(json.data.user?.rol_id === 1 ? '/dashboard' : '/');
    } catch (err: any) {
      if (err?.message === 'reCAPTCHA no cargado') {
        setError('Verificación de seguridad no disponible. Recarga la página.');
      } else {
        setError('No se pudo conectar con el servidor');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <div className="login-header">
          <h1 className="login-brand">Celestial Parfums</h1>
          <p className="login-subtitle">Inicia sesión en tu cuenta</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="email">Correo electrónico</label>
            <input
              id="email"
              type="email"
              placeholder="correo@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Contraseña</label>
            <div className="input-password-wrap">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button type="button" className="password-toggle" onClick={() => setShowPassword(v => !v)}>
                {showPassword ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
          </div>

          {error && <p className="login-error">{error}</p>}

          <button className="login-btn" type="submit" disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>

          <p className="login-switch">
            ¿No tienes cuenta?{' '}
            <Link to="/register">Crear cuenta</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
