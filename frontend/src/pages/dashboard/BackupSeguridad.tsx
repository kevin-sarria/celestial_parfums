import { useEffect, useState } from 'react';
import { DatabaseBackup, Loader2, ShieldCheck, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { http } from '../../infrastructure/api/http';
import { urls } from '../../infrastructure/api/urls';

/** A partir de estos días sin copia, el botón avisa con un punto rojo. */
const DIAS_AVISO = 7;

/** Lo que responde `/backup/estado`. */
interface Estado { ultima: string | null; totp_configurado: boolean }

interface Props {
  /**
   * Dentro del menú lateral el botón ocupa el ancho completo y siempre lleva
   * texto. En la barra superior no cabía: con la campana al lado, el nombre de
   * la tienda se truncaba a "Celestial Parfu…" en pantallas pequeñas y el dueño
   * lo rechazó. Desde el 2026-08-11 el respaldo vive en el menú.
   */
  enMenu?: boolean;
}

/**
 * Respaldo de la base de datos con doble candado: sesión de admin + código
 * TOTP de app authenticator. Descarga el SQL completo comprimido al navegador
 * y recuerda (punto rojo) cuando pasan más de 7 días sin hacer copia.
 */
export default function BackupSeguridad({ enMenu = false }: Props) {
  const [open, setOpen] = useState(false);
  const [ultima, setUltima] = useState<string | null>(null);
  const [totpListo, setTotpListo] = useState<boolean | null>(null);
  const [setup, setSetup] = useState<{ secret: string; otpauth: string } | null>(null);
  const [codigo, setCodigo] = useState('');
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  /**
   * Este componente vive DENTRO del cajón lateral, y el cajón desmonta su
   * contenido al cerrarse: sin caché preguntaba al servidor **en cada apertura
   * del menú** solo para saber la fecha de la última copia — un dato que cambia
   * una vez al día. Con `getCacheado` es una petición por carga de página, y se
   * olvida sola en cuanto se hace una copia (ver `descargar`).
   */
  const cargarEstado = async (refrescar = false) => {
    if (refrescar) http.olvidar(urls.backup.estado);
    const res = await http.getCacheado<{ data?: Estado }>(urls.backup.estado);
    // Sin estado el botón sigue disponible; el backend valida todo igual.
    if (!res.ok) return;
    setUltima(res.cuerpo?.data?.ultima ?? null);
    setTotpListo(!!res.cuerpo?.data?.totp_configurado);
  };

  useEffect(() => { cargarEstado(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const diasSin = ultima ? Math.floor((Date.now() - new Date(ultima).getTime()) / 86_400_000) : null;
  const urgente = totpListo !== null && (diasSin === null || diasSin >= DIAS_AVISO);

  const activarTotp = async () => {
    setTrabajando(true);
    setError('');
    try {
      const res = await http.post<{ data: { secret: string; otpauth: string } }>(urls.backup.activarTotp);
      if (!res.ok || !res.cuerpo) { setError(res.error); return; }
      setSetup(res.cuerpo.data);
      setTotpListo(true);
      // El estado guardado decía "sin segundo factor": ya no es verdad.
      http.olvidar(urls.backup.estado);
    } finally {
      setTrabajando(false);
    }
  };

  const descargar = async () => {
    setTrabajando(true);
    setError('');
    setExito('');
    try {
      const res = await http.descargarConCodigo(urls.backup.descargar, { codigo });
      if (!res.ok || !res.cuerpo) { setError(res.error); return; }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(res.cuerpo);
      a.download = `backup-celestial-${new Date().toISOString().slice(0, 10)}.sql`;
      a.click();
      URL.revokeObjectURL(a.href);
      setExito('Copia descargada. Guárdala fuera del servidor: Drive, disco externo o similar.');
      setCodigo('');
      // Acaba de cambiar la fecha de la última copia: se pide de nuevo.
      cargarEstado(true);
    } finally {
      setTrabajando(false);
    }
  };

  return (
    <>
      <Button
        variant={enMenu ? 'ghost' : 'outline'}
        size={enMenu ? undefined : 'sm'}
        className={enMenu ? 'relative w-full justify-start' : 'relative'}
        onClick={() => { setOpen(true); setError(''); setExito(''); }}
        title="Copia de seguridad de la base de datos"
      >
        <DatabaseBackup className="size-4" />
        <span className={enMenu ? undefined : 'hidden md:inline'}>Respaldo</span>
        {urgente && (
          enMenu
            // En el menú el punto pegado al borde se pierde: aquí va al lado del
            // texto, donde se lee. El recordatorio de verdad vive en la campana.
            ? <span className="ml-auto rounded-full bg-destructive/10 px-2 py-0.5 text-[10.5px] font-semibold text-destructive">
                pendiente
              </span>
            : <span className="absolute -right-1 -top-1 size-2.5 rounded-full bg-destructive" aria-label="Respaldo pendiente" />
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
