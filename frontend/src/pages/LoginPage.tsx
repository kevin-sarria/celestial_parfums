import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthCard } from '@/components/auth/AuthCard';
import { PasswordInput } from '@/components/auth/PasswordInput';
import { GoogleAuthButton } from '@/components/auth/GoogleAuthButton';
import { loginSchema } from '../domain/entities/auth.schema';
import { http } from '../infrastructure/api/http';
import { urls } from '../infrastructure/api/urls';
import { executeRecaptcha, showRecaptchaBadge, hideRecaptchaBadge } from '../infrastructure/recaptcha';
import { useAuthContext } from '../application/context/useAuthContext';
import { useSeo } from '../application/hooks/useSeo';

export default function LoginPage() {
  useSeo('Iniciar sesión');
  const navigate = useNavigate();
  const auth = useAuthContext();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      const captcha = await executeRecaptcha('LOGIN');
      /**
       * `sesionOpcional`: una contraseña equivocada responde 401, y sin la
       * marca el interceptor pediría refresco, **reenviaría el login solo** y
       * al fallar te sacaría a `/login` en vez de decirte que la clave no es.
       */
      const res = await http.post<{ data: { token: string; user: { rol_id?: number } } }>(
        urls.auth.login, { ...parsed.data, captcha }, { sesionOpcional: true },
      );

      if (!res.ok) {
        setError(res.error);
        return;
      }

      auth.login(res.cuerpo!.data.token, res.cuerpo!.data.user as never);
      navigate(res.cuerpo!.data.user?.rol_id === 1 ? '/dashboard' : '/');
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
    <AuthCard subtitle="Inicia sesión en tu cuenta">
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email">Correo electrónico</Label>
          <Input
            id="email"
            type="email"
            placeholder="correo@ejemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Contraseña</Label>
          <PasswordInput
            id="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>

        {error && <p className="text-[13px] font-medium text-destructive">{error}</p>}

        <Button className="w-full" type="submit" disabled={loading}>
          {loading ? 'Ingresando...' : 'Ingresar'}
        </Button>

        <div className="flex items-center gap-3 py-0.5">
          <span className="h-px flex-1 bg-border" />
          <span className="text-[12px] text-muted-foreground">o</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <GoogleAuthButton text="signin_with" onError={setError} />

        <p className="text-center text-[13px] text-muted-foreground">
          ¿No tienes cuenta?{' '}
          <Link to="/register" className="font-semibold text-primary underline-offset-4 hover:underline">
            Crear cuenta
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}
