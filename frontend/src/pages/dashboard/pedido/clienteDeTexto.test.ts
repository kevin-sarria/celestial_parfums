import { describe, expect, it } from 'vitest';
import { buscarClientePorNombre, MIN_LETRAS, normalizar, partirNombre } from './clienteDeTexto';

/**
 * EL PUENTE ENTRE EL NOMBRE ESCRITO Y LA FICHA.
 *
 * Enlazar mal es peor que no enlazar: mezcla dos historiales y el error es
 * invisible. Por eso la coincidencia es EXACTA (no "parecida") y hay un mínimo
 * de letras. Y guardar tiene que partir el nombre como lo lee el dueño.
 */
const clientes = [
  { nombre: 'Gerardo', apellido: 'Arias' },
  { nombre: 'Ana', apellido: 'María López' },
];

describe('buscarClientePorNombre', () => {
  it('encuentra al cliente aunque cambien tildes y mayúsculas', () => {
    expect(buscarClientePorNombre(clientes, 'GERARDO ARIAS')).toBe(clientes[0]);
    expect(buscarClientePorNombre(clientes, '  gerardo   arias ')).toBe(clientes[0]);
  });

  it('no enlaza un nombre a medias', () => {
    expect(buscarClientePorNombre(clientes, 'Gerardo')).toBeUndefined();
    expect(buscarClientePorNombre(clientes, 'Arias')).toBeUndefined();
  });

  it('no enlaza con pocas letras: "Ana" alcanzaría para cualquier Ana', () => {
    expect('Ana'.length).toBeLessThan(MIN_LETRAS);
    expect(buscarClientePorNombre(clientes, 'Ana')).toBeUndefined();
  });

  it('no adivina entre nombres parecidos', () => {
    expect(buscarClientePorNombre(clientes, 'Gerardo Aria')).toBeUndefined();
    expect(buscarClientePorNombre(clientes, 'Gerardo Ariass')).toBeUndefined();
  });

  it('con la lista vacía no revienta', () => {
    expect(buscarClientePorNombre([], 'Gerardo Arias')).toBeUndefined();
  });
});

describe('partirNombre', () => {
  it('el primer espacio separa el nombre; el resto es el apellido', () => {
    expect(partirNombre('Gerardo Arias')).toEqual({ nombre: 'Gerardo', apellido: 'Arias' });
    expect(partirNombre('Ana María López')).toEqual({ nombre: 'Ana', apellido: 'María López' });
  });

  it('con una sola palabra deja el apellido vacío (el formulario lo pide después)', () => {
    expect(partirNombre('Madonna')).toEqual({ nombre: 'Madonna', apellido: '' });
  });
});

describe('normalizar', () => {
  it('quita tildes, baja a minúsculas y colapsa espacios', () => {
    expect(normalizar('  José   Edwán  SALAZAR ')).toBe('jose edwan salazar');
  });
});
