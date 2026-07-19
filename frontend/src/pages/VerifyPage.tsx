import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AuthCard } from '@/components/auth/AuthCard';
import { BrandMark } from '@/components/BrandMark';
import { BASE_URL } from '../infrastructure/api/client';
import { useSeo } from '../application/hooks/useSeo';

export default function VerifyPage() {
  useSeo('Verificar correo');
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

    fetch(`${BASE_URL}/api/auth/verify/${token}`)
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
    <AuthCard>
      {status === 'loading' && (
        <p className="text-center text-sm text-muted-foreground">Verificando tu cuenta...</p>
      )}

      {status === 'success' && (
        <div className="space-y-4 text-center">
          <BrandMark className="mx-auto size-14" />
          <p className="text-sm text-muted-foreground">{message}</p>
          <Button className="w-full" onClick={() => navigate('/login')}>
            Iniciar sesión
          </Button>
        </div>
      )}

      {status === 'error' && (
        <div className="space-y-4 text-center">
          <p className="text-[13px] font-medium text-destructive">{message}</p>
          <Button className="w-full" onClick={() => navigate('/register')}>
            Volver al registro
          </Button>
        </div>
      )}
    </AuthCard>
  );
}
