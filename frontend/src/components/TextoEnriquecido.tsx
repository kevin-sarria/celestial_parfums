import { cn } from '@/lib/utils';

/**
 * Pinta una descripción con su formato (negrita, cursiva, listas, enlaces).
 *
 * El HTML llega ya saneado por el servidor (`backend/src/utils/textoEnriquecido.ts`
 * lo limpia al guardar y otra vez al leer), y las descripciones de antes del
 * editor llegan convertidas. Por eso aquí se puede pintar tal cual.
 */
export function TextoEnriquecido({ html, className }: { html: string; className?: string }) {
  return <div className={cn('texto-enriquecido', className)} dangerouslySetInnerHTML={{ __html: html }} />;
}

