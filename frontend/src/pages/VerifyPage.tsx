import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import '../styles/login.css';

export default function VerifyPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      setStatus('error');
      setMessage('Token no encontrado en la URL');
      return;
    }

    fetch(`http://localhost:4000/api/auth/verify/${token}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) {
          setStatus('error');
          setMessage(json.error);
        } else {
          setStatus('success');
          setMessage(json.message ?? 'Cuenta activada exitosamente');
        }
      })
      .catch(() => {
        setStatus('error');
        setMessage('No se pudo conectar con el servidor');
      });
  }, [params]);

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <div className="login-header">
          <h1 className="login-brand">Celestial Parfums</h1>
        </div>

        {status === 'loading' && (
          <p className="login-subtitle" style={{ textAlign: 'center' }}>
            Verificando tu cuenta...
          </p>
        )}

        {status === 'success' && (
          <div className="register-success">
            <span className="register-success-icon">✦</span>
            <p>{message}</p>
            <button className="login-btn" onClick={() => navigate('/login')}>
              Iniciar sesión
            </button>
          </div>
        )}

        {status === 'error' && (
          <div style={{ textAlign: 'center' }}>
            <p className="login-error" style={{ marginBottom: '20px' }}>
              {message}
            </p>
            <button className="login-btn" onClick={() => navigate('/register')}>
              Volver al registro
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
