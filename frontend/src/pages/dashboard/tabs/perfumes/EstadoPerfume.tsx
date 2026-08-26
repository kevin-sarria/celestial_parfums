import { Badge } from '@/components/ui/badge';
import type { Perfume } from '../../../../domain/entities/perfume.schema';

/**
 * Por qué sale agotado, dicho con los números que lo explican.
 *
 * "Sin esencia" a secas obligaría a ir a buscar el material a otra pantalla
 * para entender qué falta.
 */
const explicacionSinEsencia = (p: Perfume) => {
  if (p.insumo_esencia_id == null) {
    return 'Este perfume no tiene esencia asignada, así que no se sabe con qué armarlo. '
      + 'Asígnasela en su ficha del catálogo.';
  }
  const tiene = p.insumo_esencia_stock ?? 0;
  const cola = ' Sale agotado en la tienda hasta que registres la llegada del material.';
  return p.esencia_necesaria != null
    ? `Tienes ${tiene} ml de su esencia y hacen falta ${p.esencia_necesaria} para armar uno.${cola}`
    : `Su esencia está en ${tiene}.${cola}`;
};

/**
 * Qué le falta para poder venderse, con su etiqueta corta y su explicación.
 *
 * Las tres categorías no se consiguen igual, así que no les falta lo mismo (lo
 * decide el SERVIDOR en `motivo_agotado`; aquí solo se traduce a palabras):
 * al contratipo le falta esencia, al 1.1 le faltan frascos armados y al
 * original le falta la botella. Null = no le falta nada.
 *
 * Vive aquí y lo usan tanto el badge como la columna "Estado", para que la
 * tabla se pueda ORDENAR y BUSCAR por lo mismo que se ve.
 */
export const faltaParaVender = (p: Perfume): { etiqueta: string; explicacion: string } | null => {
  switch (p.motivo_agotado) {
    case 'sin_esencia':
      return { etiqueta: 'Sin esencia', explicacion: explicacionSinEsencia(p) };
    case 'sin_armados':
      return {
        etiqueta: 'Sin armar',
        explicacion: 'Este producto solo se vende ya armado (los 1.1), y no hay ninguno hecho. '
          + 'Tener su esencia y su envase en bodega no lo pone en la tienda: '
          + 'regístralo en Producciones cuando lo armes.',
      };
    case 'sin_producto':
      return {
        etiqueta: 'Sin unidades',
        explicacion: 'Este producto no se fabrica, se compra hecho, y no queda ninguna unidad '
          + 'en bodega. Vuelve a la tienda cuando registres la compra.',
      };
    default:
      return null;
  }
};

/**
 * Cómo está el perfume, de un vistazo y **sin poder tocarse**.
 *
 * Las acciones se fueron al menú de tres puntos (`AccionesPerfume`) a pedido del
 * dueño el 2026-08-14: la fila llevaba un interruptor y dos badges que parecían
 * botones, y en una tabla de 212 filas eso es mucho ruido y un clic sin querer
 * de cara al público.
 *
 * Pero el estado SÍ se queda a la vista: es lo que permite repasar la tabla y
 * cazar lo que está fuera de la tienda o agotado sin abrir 212 menús.
 *
 * Son TRES cosas distintas y por eso se ven distinto:
 *  - **Fuera de la tienda**: desapareció del catálogo como si no existiera.
 *  - **Agotado (marca manual)**: se sigue viendo, marcado, y el cliente puede
 *    pedir que le avisen cuando vuelva.
 * **Los bordes van OPACOS, sin transparencia** (2026-08-25). Un borde de 1 píxel
 * al 50% sobre una pastilla curva no cae justo en la rejilla de píxeles, y el
 * navegador lo compensa mezclando subpíxeles de colores: al dueño se le veía
 * VERDE en el filo —el complementario del ámbar— y se arreglaba solo al pasar
 * el mouse, porque el hover repinta la fila. No se ve en las capturas
 * automáticas: el navegador sin ventana no usa subpíxeles.
 *
 *  - **Le falta algo para venderse**: lo CALCULA el servidor, y qué le falta
 *    depende de cómo se consiga ese producto — esencia el contratipo, frascos
 *    armados el 1.1, unidades en bodega el original. No se desmarca con un
 *    clic: se arregla registrando lo que llegó o armando el lote.
 */
export function EstadoPerfume({ perfume }: { perfume: Perfume }) {
  const falta = faltaParaVender(perfume);
  return (
    <div className="flex items-center gap-1.5">
      {/* Solo se marca lo que NO está normal.
          Escribir "En la tienda · En stock" en las 212 filas no informa de nada:
          ocupa sitio y obliga a leer renglón por renglón para encontrar las
          cinco que están mal. Sin etiqueta = todo en orden, y el ojo cae solo
          en las excepciones. Cuál es el estado se ve igual al abrir el menú. */}
      {!perfume.publicado && (
        <Badge variant="outline"
          className="border-amber-300 bg-amber-400/10 text-[10px] font-medium text-amber-700"
          title="No aparece en el catálogo, ni en la búsqueda, ni en su página">
          Fuera de la tienda
        </Badge>
      )}

      {perfume.agotado_manual && (
        <Badge variant="outline" className="text-[10px] text-muted-foreground"
          title="Lo marcaste como agotado: se sigue viendo y el cliente puede pedir que le avises">
          Agotado
        </Badge>
      )}

      {falta && (
        <Badge
          variant="outline"
          title={falta.explicacion}
          className="cursor-help border-amber-300 bg-amber-400/10 text-[10px] text-amber-700"
        >
          {falta.etiqueta}
        </Badge>
      )}
    </div>
  );
}
