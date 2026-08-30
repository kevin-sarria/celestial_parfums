/**
 * "No se pudo preguntar", dicho en un renglón.
 *
 * Es la otra mitad de `useConsultaDeApoyo`: cuando una sección de apoyo falla,
 * en vez de desaparecer —que es indistinguible de "no hay nada"— deja esta línea
 * discreta con su botón de reintentar.
 *
 * Discreta a propósito: no es un error de la pantalla, es un dato que no se pudo
 * traer. Un recuadro rojo a media pantalla por un aviso secundario enseña al
 * dueño a ignorar los recuadros rojos.
 */
export function NoSePudoCargar({ que, onReintentar }: {
  /** Qué no se pudo saber, en su idioma: "si hay lotes por enlazar". */
  que: string;
  onReintentar: () => void;
}) {
  return (
    <p className="text-[12.5px] text-muted-foreground">
      No se pudo comprobar {que}.{' '}
      <button type="button" onClick={onReintentar}
        className="font-medium text-foreground underline underline-offset-2">
        Reintentar
      </button>
    </p>
  );
}
