import { describe, expect, it } from 'vitest';
import { esErrorDeVersionVieja } from './versionNueva';

describe('error de versión vieja', () => {
  it('reconoce cómo lo dice cada navegador', () => {
    expect(esErrorDeVersionVieja(new TypeError('Importing a module script failed.'))).toBe(true); // Safari / iPhone
    expect(esErrorDeVersionVieja(new TypeError('Failed to fetch dynamically imported module: https://x/assets/a.js'))).toBe(true); // Chrome
    expect(esErrorDeVersionVieja(new TypeError('error loading dynamically imported module'))).toBe(true); // Firefox
  });

  it('no confunde un error cualquiera con uno de versión', () => {
    expect(esErrorDeVersionVieja(new TypeError("Cannot read properties of undefined (reading 'x')"))).toBe(false);
  });
});
