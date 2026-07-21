import { useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthContext } from '../application/context/useAuthContext';

/**
 * Descarga del catálogo en PDF — beneficio exclusivo para cuentas registradas.
 * El generador (jsPDF) se carga bajo demanda para no engordar el bundle.
 */
export default function DescargarCatalogoButton() {
  const { user } = useAuthContext();
  const [progreso, setProgreso] = useState<string | null>(null);
  const [error, setError] = useState('');

  if (!user) return null;

  const descargar = async () => {
    if (progreso) return;
    setError('');
    setProgreso('Preparando…');
    try {
      const { generarCatalogoPdf } = await import('../utils/catalogoPdf');
      await generarCatalogoPdf(setProgreso);
    } catch {
      setError('No se pudo generar el catálogo, intenta de nuevo');
    } finally {
      setProgreso(null);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline"
        size="sm"
        className="rounded-full"
        disabled={!!progreso}
        onClick={descargar}
      >
        {progreso ? <Loader2 className="size-3.5 animate-spin" /> : <FileDown className="size-3.5" />}
        {progreso ?? 'Descargar catálogo PDF'}
      </Button>
      {error && <span className="text-[11px] text-destructive">{error}</span>}
    </div>
  );
}
