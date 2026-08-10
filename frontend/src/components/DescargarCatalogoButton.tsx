import { lazy, Suspense, useState } from 'react';
import { FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthContext } from '../application/context/useAuthContext';

// El modal arrastra el motor de filtros; se carga al abrirlo, no antes.
const ExportarCatalogoModal = lazy(() => import('./ExportarCatalogoModal'));

/**
 * Descarga del catálogo en PDF (herramienta interna del admin).
 *
 * Ya no genera de una: abre el modal donde se elige QUÉ va — solo las árabes,
 * solo dama, con precio o sin precio. Antes salían los 212 con todo y no había
 * forma de mandarle a un cliente una parte del catálogo.
 */
export default function DescargarCatalogoButton() {
  const { user } = useAuthContext();
  const [abierto, setAbierto] = useState(false);

  if (!user) return null;

  return (
    <>
      <Button variant="outline" size="sm" className="rounded-full" onClick={() => setAbierto(true)}>
        <FileDown className="size-3.5" />
        Descargar catálogo PDF
      </Button>
      {abierto && (
        <Suspense fallback={null}>
          <ExportarCatalogoModal open onClose={() => setAbierto(false)} />
        </Suspense>
      )}
    </>
  );
}
