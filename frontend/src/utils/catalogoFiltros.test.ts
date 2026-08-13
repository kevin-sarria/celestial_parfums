import { describe, it, expect } from 'vitest';
import { seleccionar, gamasDelCatalogo, describirSeleccion, nombreArchivo, OPCIONES_POR_DEFECTO } from './catalogoFiltros';
import type { Perfume } from '../domain/entities/perfume.schema';

/**
 * Qué perfumes entran al catálogo PDF que se le manda al cliente.
 *
 * La regla más importante no es cuáles entran, sino que **se diga cuántos
 * quedan fuera y por qué**. Nació de un fallo real: el PDF salía con 100 de 212
 * perfumes y nadie se enteró.
 */

const perfume = (over: Partial<Perfume> & Pick<Perfume, 'id' | 'nombre'>): Perfume => ({
  precio: 60000,
  precios: [],
  descuento: 0,
  categoria: 'Contratipo',
  genero: 'dama',
  gama: 'Árabe',
  gama_id: 1,
  agotado: false,
  sin_esencia: false,
  imagen_url: 'foto.webp',
  tipo_producto: 'fabricado',
  ...over,
} as Perfume);

/** Todo marcado, que es como arranca el modal. */
const todo = { ...OPCIONES_POR_DEFECTO, gamas: [1, 2], generos: ['dama', 'caballero'] };

describe('seleccionar — qué entra al PDF', () => {
  it('con todo marcado no deja a nadie fuera', () => {
    const r = seleccionar([perfume({ id: 1, nombre: 'Eros' }), perfume({ id: 2, nombre: 'Sauvage' })], todo);
    expect(r.incluidos).toHaveLength(2);
    expect(r.fuera).toEqual([]);
    expect(r.total).toBe(2);
  });

  it('filtra por gama y DICE cuántos dejó fuera y por qué', () => {
    const perfumes = [
      perfume({ id: 1, nombre: 'Árabe uno', gama_id: 1 }),
      perfume({ id: 2, nombre: 'Clásico', gama_id: 2 }),
      perfume({ id: 3, nombre: 'Clásico dos', gama_id: 2 }),
    ];
    const r = seleccionar(perfumes, { ...todo, gamas: [1] });

    expect(r.incluidos).toHaveLength(1);
    expect(r.fuera).toEqual([{ motivo: 'no son de las calidades de esencia que elegiste', cantidad: 2 }]);
  });

  it('los que no tienen esencia asignada se cuentan aparte', () => {
    // Sin casilla propia desaparecerían en silencio, que es justo el fallo viejo.
    const perfumes = [perfume({ id: 1, nombre: 'Con gama' }), perfume({ id: 2, nombre: 'Sin gama', gama_id: null, gama: null })];

    expect(seleccionar(perfumes, { ...todo, sinGama: true }).incluidos).toHaveLength(2);

    const sin = seleccionar(perfumes, { ...todo, sinGama: false });
    expect(sin.incluidos).toHaveLength(1);
    expect(sin.fuera).toEqual([{ motivo: 'no tienen esencia asignada', cantidad: 1 }]);
  });

  it('puede dejar fuera los agotados', () => {
    const perfumes = [perfume({ id: 1, nombre: 'Hay' }), perfume({ id: 2, nombre: 'No hay', agotado: true })];
    expect(seleccionar(perfumes, { ...todo, incluirAgotados: false }).incluidos).toHaveLength(1);
    expect(seleccionar(perfumes, { ...todo, incluirAgotados: true }).incluidos).toHaveLength(2);
  });

  it('"solo los que puedo armar hoy" usa el cálculo del SERVIDOR', () => {
    /**
     * `sin_esencia` lo calcula el backend midiendo el stock contra la talla más
     * pequeña de cada perfume. Antes esta regla estaba escrita también aquí, y
     * dos copias de la misma regla se separan en cuanto alguien toca una.
     */
    const perfumes = [
      perfume({ id: 1, nombre: 'Alcanza' }),
      perfume({ id: 2, nombre: 'No alcanza', sin_esencia: true }),
    ];
    const r = seleccionar(perfumes, { ...todo, soloFabricablesHoy: true });

    expect(r.incluidos).toHaveLength(1);
    expect(r.fuera).toEqual([{ motivo: 'no tienes esencia suficiente para armar ni uno', cantidad: 1 }]);
  });

  it('agrupa los motivos y los ordena por cuántos afectan', () => {
    const perfumes = [
      perfume({ id: 1, nombre: 'Sin foto', imagen_url: null }),
      perfume({ id: 2, nombre: 'Otro sin gama', gama_id: null, gama: null }),
      perfume({ id: 3, nombre: 'Y otro sin gama', gama_id: null, gama: null }),
    ];
    const r = seleccionar(perfumes, { ...todo, sinGama: false, soloConFoto: true });

    expect(r.incluidos).toHaveLength(0);
    expect(r.fuera[0]).toEqual({ motivo: 'no tienen esencia asignada', cantidad: 2 });
    expect(r.fuera[1]).toEqual({ motivo: 'no tienen foto', cantidad: 1 });
  });
});

describe('gamasDelCatalogo', () => {
  it('cuenta cuántos perfumes tiene cada gama, de mayor a menor', () => {
    const perfumes = [
      perfume({ id: 1, nombre: 'a', gama_id: 1, gama: 'Árabe' }),
      perfume({ id: 2, nombre: 'b', gama_id: 2, gama: 'Clásica' }),
      perfume({ id: 3, nombre: 'c', gama_id: 2, gama: 'Clásica' }),
      perfume({ id: 4, nombre: 'd', gama_id: null, gama: null }),
    ];
    expect(gamasDelCatalogo(perfumes)).toEqual([
      { id: 2, nombre: 'Clásica', total: 2 },
      { id: 1, nombre: 'Árabe', total: 1 },
    ]);
  });
});

describe('describirSeleccion — la portada dice qué parte del catálogo es', () => {
  it('nombra las gamas elegidas', () => {
    // Mandar una parte con un documento titulado "Catálogo" le hace creer al
    // cliente que eso es todo lo que se vende.
    const d = describirSeleccion({ ...todo, gamas: [1] }, [{ id: 1, nombre: 'Árabe' }, { id: 2, nombre: 'Clásica' }]);
    expect(d).toContain('Árabe');
  });

  it('no dice nada cuando va el catálogo completo', () => {
    const d = describirSeleccion({ ...todo, gamas: [1, 2], generos: [] }, [{ id: 1, nombre: 'Árabe' }, { id: 2, nombre: 'Clásica' }]);
    expect(d).toBe('');
  });
});

describe('nombreArchivo — la fecha es la de HOY en Colombia, no la UTC', () => {
  it('usa la fecha local', () => {
    /**
     * `toISOString()` da la fecha UTC: pasadas las 7 de la noche en Colombia ya
     * es el día siguiente allá, y el archivo salía fechado un día después que la
     * portada. Este error ha aparecido TRES veces en el proyecto.
     */
    const hoy = new Date();
    const esperada = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
    expect(nombreArchivo('')).toBe(`catalogo-celestial-parfums-${esperada}.pdf`);
  });

  it('mete el segmento en el nombre, sin tildes ni espacios', () => {
    expect(nombreArchivo('Árabe · Dama')).toContain('catalogo-celestial-parfums-arabe-dama-');
  });
});
