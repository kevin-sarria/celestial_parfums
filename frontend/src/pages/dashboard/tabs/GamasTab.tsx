import { useEffect, useState } from 'react';
import { LookupTab, type ResultadoLookup } from './LookupTab';
import { BASE_URL } from '../../../infrastructure/api/client';
import type { GuardedFetch, Lookup } from '../types';

const API = `${BASE_URL}/api/costeo/gamas`;

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
export function GamasTab({ guardedFetch }: { guardedFetch: GuardedFetch }) {
  const [items, setItems] = useState<Lookup[]>([]);

  const cargar = async () => {
    try {
      const res = await guardedFetch(`${API}/todas`);
      if (!res.ok) return;
      const data: { id: number; nombre: string; esencias: number }[] = (await res.json()).data ?? [];
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

  const llamar = async (url: string, init: RequestInit): Promise<ResultadoLookup> => {
    try {
      const res = await guardedFetch(url, init);
      const json = await res.json().catch(() => null);
      if (!res.ok) return { ok: false, error: json?.error ?? 'No se pudo guardar' };
      await cargar();
      return { ok: true };
    } catch {
      return { ok: false, error: 'No se pudo conectar con el servidor' };
    }
  };

  return (
    <LookupTab
      title="Gamas de esencia"
      nuevo="Nueva gama"
      editar="Editar gama"
      ejemplo="Ej: Clásica, Árabe, Premium, Nicho"
      items={items}
      onAdd={(nombre) => llamar(API, {
        method: 'POST',
        body: JSON.stringify({ nombre, orden: items.length + 1 }),
      })}
      onEdit={(id, nombre) => llamar(`${API}/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ nombre: soloNombre(nombre), orden: items.findIndex((i) => i.id === id) + 1 }),
      })}
      onDelete={(id) => llamar(`${API}/${id}`, { method: 'DELETE' })}
    />
  );
}
