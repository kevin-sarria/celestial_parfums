import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthCard } from '@/components/auth/AuthCard';
import { PasswordInput } from '@/components/auth/PasswordInput';
import { GoogleAuthButton } from '@/components/auth/GoogleAuthButton';
import { BrandMark } from '@/components/BrandMark';
import { registerSchema } from '../domain/entities/auth.schema';
import { http } from '../infrastructure/api/http';
import { urls } from '../infrastructure/api/urls';
import { executeRecaptcha, showRecaptchaBadge, hideRecaptchaBadge } from '../infrastructure/recaptcha';
import { useSeo } from '../application/hooks/useSeo';

export default function RegisterPage() {
  useSeo('Crear cuenta');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ref = searchParams.get('ref'); // código de referido en la URL
  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    email: '',
    password: '',
    confirm: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    showRecaptchaBadge();
    return () => hideRecaptchaBadge();
  }, []);

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
      const captcha = await executeRecaptcha('REGISTER');
      const res = await http.post(urls.auth.registro, {
        nombre: parsed.data.nombre,
        apellido: parsed.data.apellido,
        email: parsed.data.email,
        password: parsed.data.password,
        captcha,
        ...(ref ? { ref } : {}),
      });

      if (!res.ok) {
        setError(res.error);
        return;
      }

      setSuccess('Registro exitoso. Revisa tu correo y activa tu cuenta antes de ingresar.');
    } catch (err) {
      if (err instanceof Error && err.message === 'reCAPTCHA no cargado') {
        setError('Verificación de seguridad no disponible. Recarga la página.');
      } else {
        setError('No se pudo conectar con el servidor');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard subtitle={success ? undefined : 'Crea tu cuenta'}>
      {success ? (
        <div className="space-y-4 text-center">
          <BrandMark className="mx-auto size-14" />
          <p className="text-sm text-muted-foreground">{success}</p>
          <Button className="w-full" onClick={() => navigate('/login')}>
            Ir al login
          </Button>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="nombre">Nombre</Label>
              <Input
                id="nombre"
                type="text"
                placeholder="Juan"
                value={form.nombre}
                onChange={set('nombre')}
                required
                autoComplete="given-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="apellido">Apellido</Label>
              <Input
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

          <div className="space-y-1.5">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              id="email"
              type="email"
              placeholder="correo@ejemplo.com"
              value={form.email}
              onChange={set('email')}
              required
              autoComplete="email"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Contraseña</Label>
            <PasswordInput
              id="password"
              placeholder="••••••••"
              value={form.password}
              onChange={set('password')}
              required
              autoComplete="new-password"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirmar contraseña</Label>
            <PasswordInput
              id="confirm"
              placeholder="••••••••"
              value={form.confirm}
              onChange={set('confirm')}
              required
              autoComplete="new-password"
            />
          </div>

          {error && <p className="text-[13px] font-medium text-destructive">{error}</p>}

          <Button className="w-full" type="submit" disabled={loading}>
            {loading ? 'Registrando...' : 'Crear cuenta'}
          </Button>

          <div className="flex items-center gap-3 py-0.5">
            <span className="h-px flex-1 bg-border" />
            <span className="text-[12px] text-muted-foreground">o</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <GoogleAuthButton text="signup_with" onError={setError} />

          <p className="text-center text-[13px] text-muted-foreground">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="font-semibold text-primary underline-offset-4 hover:underline">
              Iniciar sesión
            </Link>
          </p>
        </form>
      )}
    </AuthCard>
  );
}
