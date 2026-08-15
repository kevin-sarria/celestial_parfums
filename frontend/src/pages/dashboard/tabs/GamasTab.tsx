import { useEffect, useState } from 'react';
import { LookupTab, type ResultadoLookup } from './LookupTab';
import { http, type Respuesta } from '../../../infrastructure/api/http';
import { urls } from '../../../infrastructure/api/urls';
import type { Lookup } from '../types';


/**
 * Gamas de esencia: clásica, árabe, premium, diseñador… y las que el dueño
 * quiera agregar ("nicho", "nicho premium").
 *
 * Es una clasificación como los aromas o las categorías, y por eso reutiliza
 * `LookupTab` y vive en la sección Clasificaciones. Lo que la hace distinta es
 * PARA QUÉ sirve: costear cuando todavía no se sabe qué fragancia se va a
 * armar (una cotización al mayoreo de "50 de 30 ml"), porque el costo de la
 * esencia va de $230 a $1.500 el ml según la gama.
 *
 * Borrar una gama NO borra sus esencias: las deja sin clasificar. El backend
 * responde cuántas quedaron así, y ese mensaje se muestra tal cual.
 */
export function GamasTab() {
  const [items, setItems] = useState<Lookup[]>([]);

  const cargar = async () => {
    try {
      const res = await http.get<{ data: { id: number; nombre: string; esencias: number }[] }>(
        urls.costeo.gamas,
      );
      if (!res.ok) return;
      const data = res.cuerpo?.data ?? [];
      // El contador va en el propio nombre: LookupTab muestra una sola columna
      // y saber cuántas esencias cuelgan de cada gama es lo que evita borrar
      // la que tiene 151 pensando que estaba vacía.
      setItems(data.map((g) => ({
        id: g.id,
        nombre: g.esencias ? `${g.nombre}  ·  ${g.esencias} esencias` : g.nombre,
      })));
    } catch { /* la vista se queda con lo que tenía */ }
  };

  useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Quita el "· N esencias" que se le agregó al nombre para mostrarlo. */
  const soloNombre = (n: string) => n.split('  ·  ')[0];

  const llamar = async (peticion: Promise<Respuesta>): Promise<ResultadoLookup> => {
    const res = await peticion;
    if (!res.ok) return { ok: false, error: res.error };
    await cargar();
    return { ok: true };
  };

  return (
    <LookupTab
      title="Gamas de esencia"
      nuevo="Nueva gama"
      editar="Editar gama"
      ejemplo="Ej: Clásica, Árabe, Premium, Nicho"
      items={items}
      onAdd={(nombre) => llamar(http.post(urls.costeo.crearGama, {
        nombre, orden: items.length + 1,
      }))}
      onEdit={(id, nombre) => llamar(http.patch(urls.costeo.gama(id), {
        nombre: soloNombre(nombre), orden: items.findIndex((i) => i.id === id) + 1,
      }))}
      onDelete={(id) => llamar(http.borrar(urls.costeo.gama(id)))}
    />
  );
}
