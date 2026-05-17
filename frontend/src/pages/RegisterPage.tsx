import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { registerSchema } from '../domain/entities/auth.schema';
import { BASE_URL } from '../infrastructure/api/client';
import '../styles/login.css';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    email: '',
    password: '',
    confirm: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (field: string) => (e: { target: { value: string } }) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const parsed = registerSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: parsed.data.nombre,
          apellido: parsed.data.apellido,
          email: parsed.data.email,
          password: parsed.data.password,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? 'Error al registrarse');
        return;
      }

      setSuccess('Registro exitoso. Revisa tu correo y activa tu cuenta antes de ingresar.');
    } catch {
      setError('No se pudo conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <div className="login-header">
          <h1 className="login-brand">Celestial Parfums</h1>
          <p className="login-subtitle">Crea tu cuenta</p>
        </div>

        {success ? (
          <div className="register-success">
            <span className="register-success-icon">✦</span>
            <p>{success}</p>
            <button className="login-btn" onClick={() => navigate('/login')}>
              Ir al login
            </button>
          </div>
        ) : (
          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="nombre">Nombre</label>
                <input
                  id="nombre"
                  type="text"
                  placeholder="Juan"
                  value={form.nombre}
                  onChange={set('nombre')}
                  required
                  autoComplete="given-name"
                />
              </div>
              <div className="form-group">
                <label htmlFor="apellido">Apellido</label>
                <input
                  id="apellido"
                  type="text"
                  placeholder="Pérez"
                  value={form.apellido}
                  onChange={set('apellido')}
                  required
                  autoComplete="family-name"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="email">Correo electrónico</label>
              <input
                id="email"
                type="email"
                placeholder="correo@ejemplo.com"
                value={form.email}
                onChange={set('email')}
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
                  value={form.password}
                  onChange={set('password')}
                  required
                  autoComplete="new-password"
                />
                <button type="button" className="password-toggle" onClick={() => setShowPassword(v => !v)}>
                  {showPassword ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="confirm">Confirmar contraseña</label>
              <div className="input-password-wrap">
                <input
                  id="confirm"
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.confirm}
                  onChange={set('confirm')}
                  required
                  autoComplete="new-password"
                />
                <button type="button" className="password-toggle" onClick={() => setShowConfirm(v => !v)}>
                  {showConfirm ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
            </div>

            {error && <p className="login-error">{error}</p>}

            <button className="login-btn" type="submit" disabled={loading}>
              {loading ? 'Registrando...' : 'Crear cuenta'}
            </button>

            <p className="login-switch">
              ¿Ya tienes cuenta?{' '}
              <Link to="/login">Iniciar sesión</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
