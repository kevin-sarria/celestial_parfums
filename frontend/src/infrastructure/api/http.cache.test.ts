import { describe, expect, it, vi } from 'vitest';

// Instancia de axios falsa: cuenta las lecturas y deja escribir.
const lecturas = { n: 0 };
vi.mock('axios', () => {
  const instancia = {
    get: vi.fn(async () => { lecturas.n += 1; return { data: { n: lecturas.n }, status: 200 }; }),
    post: vi.fn(async () => ({ data: {}, status: 201 })),
    patch: vi.fn(async () => ({ data: {}, status: 200 })),
    delete: vi.fn(async () => ({ data: {}, status: 200 })),
    interceptors: { response: { use: vi.fn() }, request: { use: vi.fn() } },
  };
  return { default: { create: () => instancia, isAxiosError: () => false }, AxiosError: class {} };
});

const { http } = await import('./http');

describe('caché de lecturas', () => {
  it('una escritura aceptada la vacía: lo recién creado aparece sin esperar 5 minutos', async () => {
    // El caso real (2026-10-06): crear "Island Bliss" en la ficha y no
    // encontrarla en el buscador de Ventas.
    const antes = await http.getCacheado<{ n: number }>('/parfums?todos=1');
    const repetida = await http.getCacheado<{ n: number }>('/parfums?todos=1');
    expect(repetida.cuerpo?.n).toBe(antes.cuerpo?.n);

    await http.post('/parfums/create', { nombre: 'Island Bliss' });

    const despues = await http.getCacheado<{ n: number }>('/parfums?todos=1');
    expect(despues.cuerpo?.n).toBe((antes.cuerpo?.n ?? 0) + 1);
  });
});
