import { describe, expect, it } from 'vitest';
import { describirCambio, sanearDatos } from './registroCambios';

describe('el historial de cambios', () => {
  it('dice en palabras qué se hizo, con el número y el nombre', () => {
    expect(describirCambio('PATCH', '/api/parfums/12/publicado', { nombre: 'Khamrah' }))
      .toEqual({ modulo: 'Catálogo', resumen: 'Editó en Catálogo (publicado) #12 · Khamrah' });
    expect(describirCambio('DELETE', '/api/ventas/812', {}).resumen).toBe('Borró en Ventas #812');
    expect(describirCambio('POST', '/api/ventas', { persona: 'Ana' }).resumen).toBe('Creó o registró en Ventas · Ana');
  });

  it('nunca guarda contraseñas ni tokens, y recorta los textos largos', () => {
    const d = sanearDatos({ nombre: 'Ana', password: 'x', captcha: 'y', notas: 'a'.repeat(400) }) as Record<string, string>;
    expect(d).not.toHaveProperty('password');
    expect(d).not.toHaveProperty('captcha');
    expect(d.notas.length).toBe(301);
  });
});
