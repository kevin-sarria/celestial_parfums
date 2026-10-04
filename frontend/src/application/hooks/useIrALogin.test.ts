import { describe, expect, it } from 'vitest';
import { destinoTrasLogin } from './useIrALogin';

describe('a dónde se va al iniciar sesión', () => {
  it('el cliente vuelve a donde estaba', () => {
    expect(destinoTrasLogin({ desde: '/perfume/khamrah?talla=30' }, 2)).toBe('/perfume/khamrah?talla=30');
  });

  it('el dueño va a su panel aunque viniera de otra página', () => {
    expect(destinoTrasLogin({ desde: '/perfume/khamrah' }, 1)).toBe('/dashboard');
  });

  it('el personal también va al panel', () => {
    expect(destinoTrasLogin({ desde: '/perfume/khamrah' }, 7, true)).toBe('/dashboard');
  });

  it('sin origen, o con uno que no es de la tienda, a la portada', () => {
    expect(destinoTrasLogin(null, 2)).toBe('/');
    expect(destinoTrasLogin({ desde: 'https://otro-sitio.com' }, 2)).toBe('/');
    expect(destinoTrasLogin({ desde: '//otro-sitio.com' }, 2)).toBe('/');
    expect(destinoTrasLogin({ desde: '/login' }, 2)).toBe('/');
  });
});
