import { useEffect, useState } from 'react';
import { DatabaseBackup, Loader2, ShieldCheck, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BASE_URL } from '../../infrastructure/api/client';
import type { GuardedFetch } from './types';

const API_BACKUP = `${BASE_URL}/api/backup`;
/** A partir de estos días sin copia, el botón avisa con un punto rojo. */
const DIAS_AVISO = 7;

interface Props {
  guardedFetch: GuardedFetch;
}

/**
 * Respaldo de la base de datos con doble candado: sesión de admin + código
 * TOTP de app authenticator. Descarga el SQL completo comprimido al navegador
 * y recuerda (punto rojo) cuando pasan más de 7 días sin hacer copia.
 */
export default function BackupSeguridad({ guardedFetch }: Props) {
  const [open, setOpen] = useState(false);
  const [ultima, setUltima] = useState<string | null>(null);
  const [totpListo, setTotpListo] = useState<boolean | null>(null);
  const [setup, setSetup] = useState<{ secret: string; otpauth: string } | null>(null);
  const [codigo, setCodigo] = useState('');
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  const cargarEstado = async () => {
    try {
      const res = await guardedFetch(`${API_BACKUP}/estado`);
      const json = await res.json();
      if (res.ok) {
        setUltima(json.data?.ultima ?? null);
        setTotpListo(!!json.data?.totp_configurado);
      }
    } catch {
      // Sin estado el botón sigue disponible; el backend valida todo igual
    }
  };

  useEffect(() => { cargarEstado(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const diasSin = ultima ? Math.floor((Date.now() - new Date(ultima).getTime()) / 86_400_000) : null;
  const urgente = totpListo !== null && (diasSin === null || diasSin >= DIAS_AVISO);

  const activarTotp = async () => {
    setTrabajando(true);
    setError('');
    try {
      const res = await guardedFetch(`${API_BACKUP}/totp/setup`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'No se pudo activar'); return; }
      setSetup(json.data);
      setTotpListo(true);
    } catch {
      setError('No se pudo conectar con el servidor');
    } finally {
      setTrabajando(false);
    }
  };

  const descargar = async () => {
    setTrabajando(true);
    setError('');
    setExito('');
    try {
      const res = await guardedFetch(API_BACKUP, { method: 'POST', body: JSON.stringify({ codigo }) });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        setError(j?.error ?? `No se pudo generar la copia (error ${res.status})`);
        return;
      }
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `backup-celestial-${new Date().toISOString().slice(0, 10)}.sql.gz`;
      a.click();
      URL.revokeObjectURL(a.href);
      setExito('Copia descargada. Guárdala fuera del servidor: Drive, disco externo o similar.');
      setCodigo('');
      cargarEstado();
    } catch {
      setError('No se pudo generar la copia');
    } finally {
      setTrabajando(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="relative"
        onClick={() => { setOpen(true); setError(''); setExito(''); }}
        title="Copia de seguridad de la base de datos"
      >
        <DatabaseBackup className="size-4" />
        <span className="hidden md:inline">Respaldo</span>
        {urgente && (
          <span className="absolute -right-1 -top-1 size-2.5 rounded-full bg-destructive" aria-label="Respaldo pendiente" />
        )}
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (!v) setOpen(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-medium text-ink">
              Copia de seguridad de la base de datos
            </DialogTitle>
          </DialogHeader>

          <p className="text-[13px] leading-relaxed text-muted-foreground">
            {diasSin === null
              ? 'Nunca has descargado una copia. Ten siempre un respaldo fuera del servidor: si un día falla, tu información sobrevive.'
              : diasSin >= DIAS_AVISO
                ? `Han pasado ${diasSin} días desde tu última copia — te recomendamos hacer una ahora.`
                : `Última copia: hace ${diasSin === 0 ? 'menos de un día' : `${diasSin} ${diasSin === 1 ? 'día' : 'días'}`}.`}
          </p>

          {totpListo === false && !setup && (
            <div className="space-y-3 rounded-xl border border-border bg-secondary/40 p-4">
              <p className="flex items-start gap-2 text-[13px] leading-relaxed text-foreground">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                Antes de la primera copia activa el doble candado: un código de tu app
                authenticator (Google Authenticator, Authy…) que solo tú tienes. Aunque
                alguien robe tu contraseña, sin tu teléfono no podrá exportar los datos.
              </p>
              <Button onClick={activarTotp} disabled={trabajando} className="w-full rounded-full">
                {trabajando ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                Activar doble seguridad
              </Button>
            </div>
          )}

          {setup && (
            <div className="space-y-3 rounded-xl border border-primary/30 bg-brand-soft p-4">
              <p className="text-[13px] font-semibold text-primary">
                Guarda esta clave AHORA — no se volverá a mostrar:
              </p>
              <p className="select-all break-all rounded-lg bg-background px-3 py-2 font-mono text-[13px] text-ink">
                {setup.secret}
              </p>
              <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                En tu app authenticator elige "Introducir clave de configuración", pega la
                clave (cuenta: Celestial Parfums, tipo: <strong>basada en tiempo</strong>) —
                o si estás en el celular,{' '}
                <a href={setup.otpauth} className="font-medium text-primary underline">
                  tócala aquí para agregarla directo
                </a>.
              </p>
            </div>
          )}

          {totpListo && (
            <div className="space-y-2.5">
              <label className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Código del authenticator
              </label>
              <div className="flex gap-2">
                <Input
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className="text-center font-mono text-lg tracking-[0.3em]"
                  onKeyDown={(e) => { if (e.key === 'Enter' && codigo.length === 6) descargar(); }}
                />
                <Button
                  disabled={codigo.length !== 6 || trabajando}
                  onClick={descargar}
                  className="shrink-0 rounded-full"
                >
                  {trabajando ? <Loader2 className="size-4 animate-spin" /> : <DatabaseBackup className="size-4" />}
                  Descargar copia
                </Button>
              </div>
            </div>
          )}

          {error && (
            <p className="flex items-start gap-2 text-[13px] font-medium text-destructive">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {error}
            </p>
          )}
          {exito && (
            <p className="flex items-start gap-2 text-[13px] font-medium text-primary">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" /> {exito}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
