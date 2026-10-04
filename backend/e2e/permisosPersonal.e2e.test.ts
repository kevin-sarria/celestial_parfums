import bcrypt from 'bcryptjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma';
import { cabeceraAdmin, cerrarNavegador } from './navegador';
import { URL_API } from './arranque';

/**
 * PERMISOS DEL PERSONAL (2026-10-04, opción C del dueño), contra el servidor
 * de verdad: lo que se prueba aquí es lo que NO se puede saltar desde la
 * pantalla. Un vendedor de prueba con "ver y registrar ventas":
 *
 * - no ve costos ni entra a lo que no tiene marcado;
 * - registra al precio normal sin pedir nada;
 * - si cobra menos, la venta NO existe hasta que el dueño decide;
 * - no borra: lo pide, y el dueño aprueba;
 * - quitarle el rol le corta el acceso en el acto.
 */

const VENDEDOR = { email: 'vendedor@prueba.local', clave: 'Prueba123!' };
const PERFUME = 'Perfume del Vendedor';
let cookieVendedor = '';
let perfumeId = 0;
let vendedorId = 0;
let rolId = 0;

const api = (ruta: string, init: RequestInit = {}, cookie = cookieVendedor) =>
  fetch(`${URL_API}/api${ruta}`, { ...init, headers: { 'Content-Type': 'application/json', Cookie: cookie, ...(init.headers ?? {}) } });
const comoDueno = async (ruta: string, init: RequestInit = {}) => fetch(`${URL_API}/api${ruta}`, { ...init, headers: await cabeceraAdmin() });

const venta = (valor: number, extra: object = {}) => ({
  dia: '2026-10-04', persona: 'Cliente del vendedor', cantidad_perfumes: 1, valor_venta: valor,
  lineas: [{ perfume_id: perfumeId, ml: null, cantidad: 1, regalo: 0 }], pagada: true, ...extra,
});

beforeAll(async () => {
  const p = await prisma.perfume.create({ data: { nombre: PERFUME, precio: 50000, tipo_producto: 'comprado' } });
  perfumeId = p.id;
  await prisma.role.upsert({ where: { id: 2 }, update: {}, create: { id: 2, nombre: 'cliente' } });

  // El dueño crea el rol desde el panel, marcando dos casillas
  const rol = await comoDueno('/roles', { method: 'POST', body: JSON.stringify({ nombre: 'Vendedor de prueba', permisos: ['ventas.ver', 'ventas.registrar', 'no.existe'] }) });
  expect(rol.status).toBe(201);
  const creado = (await rol.json()).data;
  rolId = creado.id;
  expect(creado.permisos).toEqual(['ventas.ver', 'ventas.registrar']); // la casilla inventada no se guarda

  const u = await prisma.user.create({
    data: { nombre: 'Vale', apellido: 'Vendedora', email: VENDEDOR.email, password: await bcrypt.hash(VENDEDOR.clave, 10), rol_id: 2, activo: true },
  });
  vendedorId = u.id;
  expect((await comoDueno(`/usuarios/${u.id}/rol`, { method: 'PATCH', body: JSON.stringify({ rol_id: rolId }) })).ok).toBe(true);

  const entrada = await fetch(`${URL_API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: VENDEDOR.email, password: VENDEDOR.clave }),
  });
  expect(entrada.ok).toBe(true);
  const yo = (await entrada.json()).data.user;
  expect(yo.personal).toBe(true);
  expect([...yo.permisos].sort()).toEqual(['ventas.registrar', 'ventas.ver']);
  cookieVendedor = entrada.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
});

afterAll(async () => {
  await prisma.solicitud.deleteMany({ where: { solicitante_id: vendedorId } });
  const ventas = await prisma.venta.findMany({ where: { persona: 'Cliente del vendedor' }, select: { id: true } });
  for (const v of ventas) await comoDueno(`/ventas/${v.id}`, { method: 'DELETE' });
  await prisma.user.deleteMany({ where: { email: VENDEDOR.email } });
  await prisma.role.deleteMany({ where: { id: rolId } });
  await prisma.perfume.deleteMany({ where: { nombre: PERFUME } });
  await cerrarNavegador();
});

describe('el vendedor', () => {
  it('ve las ventas sin costos ni ganancias, y no entra a lo que no tiene marcado', async () => {
    const r = await api('/ventas');
    expect(r.status).toBe(200);
    expect(JSON.stringify(await r.json())).not.toMatch(/costo|ganancia|margen/i);
    const totales = await (await api('/ventas/totales')).json();
    expect(JSON.stringify(totales)).not.toMatch(/ganancia|costo/i);

    for (const ruta of ['/creditos', '/inventario/insumos', '/reportes/inicio', '/historial', '/roles']) {
      expect((await api(ruta)).status, ruta).toBe(403);
    }
    // Sin permiso de clientes ve los nombres, no los correos
    const personas = (await (await api('/usuarios')).json()).data;
    expect(personas.find((x: { id: number }) => x.id === vendedorId)).not.toHaveProperty('email');
  });

  it('registra al precio normal sin pedir nada', async () => {
    const r = await api('/ventas', { method: 'POST', body: JSON.stringify(venta(50000)) });
    expect(r.status).toBe(201);
  });

  it('regala el empaque que toca sin pedir nada; regalar de más espera al dueño', async () => {
    // Un contratipo de 77 ml que lleva una bolsa (empaque por línea, 2026-10-04)
    const talla = await prisma.presentacion.create({ data: { nombre: 'EMP77', ml: 77 } });
    const contratipo = await prisma.perfume.create({ data: { nombre: `${PERFUME} 77`, precio: 50000, tipo_producto: 'fabricado' } });
    await prisma.perfumePresentacion.create({ data: { perfume_id: contratipo.id, presentacion_id: talla.id } });
    const bolsa = await prisma.perfume.create({ data: { nombre: `${PERFUME} bolsa`, precio: 0, tipo_producto: 'comprado', es_accesorio: true } });
    await prisma.empaqueLinea.create({ data: { linea: 'contratipo', presentacion_id: talla.id, perfume_id: bolsa.id, cantidad: 1 } });
    const pedido = (bolsas: number) => venta(50000, {
      lineas: [
        { perfume_id: contratipo.id, ml: 77, cantidad: 1, regalo: 0 },
        { perfume_id: bolsa.id, ml: null, cantidad: bolsas, regalo: bolsas },
      ],
    });
    try {
      expect((await api('/ventas', { method: 'POST', body: JSON.stringify(pedido(1)) })).status).toBe(201);
      // Tres bolsas cuando toca una: es un regalo de más, pide motivo para el dueño
      expect((await api('/ventas', { method: 'POST', body: JSON.stringify(pedido(3)) })).status).toBe(400);
    } finally {
      const ventas = await prisma.venta.findMany({ where: { perfumes: { some: { perfume_id: contratipo.id } } }, select: { id: true } });
      for (const v of ventas) await comoDueno(`/ventas/${v.id}`, { method: 'DELETE' });
      await prisma.empaqueLinea.deleteMany({ where: { perfume_id: bolsa.id } });
      await prisma.perfume.deleteMany({ where: { id: { in: [contratipo.id, bolsa.id] } } });
      await prisma.presentacion.delete({ where: { id: talla.id } });
    }
  });

  it('si cobra menos, la venta espera al dueño; aprobada sale con el descuento, rechazada a precio normal', async () => {
    const antes = await prisma.venta.count({ where: { persona: 'Cliente del vendedor' } });
    const sinMotivo = await api('/ventas', { method: 'POST', body: JSON.stringify(venta(40000)) });
    expect(sinMotivo.status).toBe(400);

    const pide = async () => {
      const r = await api('/ventas', { method: 'POST', body: JSON.stringify(venta(40000, { motivo_descuento: 'Cliente frecuente' })) });
      expect(r.status).toBe(202);
      return (await r.json()).data.solicitud_id as number;
    };
    const aprobar = await pide();
    const rechazar = await pide();
    // Mientras tanto la venta NO existe: no cuenta en ningún número
    expect(await prisma.venta.count({ where: { persona: 'Cliente del vendedor' } })).toBe(antes);
    // El vendedor no puede aprobarse a sí mismo
    expect((await api(`/solicitudes/${aprobar}/aprobar`, { method: 'POST' })).status).toBe(403);

    expect((await comoDueno(`/solicitudes/${aprobar}/aprobar`, { method: 'POST' })).ok).toBe(true);
    expect((await comoDueno(`/solicitudes/${rechazar}/rechazar`, { method: 'POST', body: JSON.stringify({ respuesta: 'Hoy no' }) })).ok).toBe(true);
    // Resolver dos veces no registra dos veces
    expect((await comoDueno(`/solicitudes/${aprobar}/aprobar`, { method: 'POST' })).status).toBe(400);

    const valores = (await prisma.venta.findMany({ where: { persona: 'Cliente del vendedor' }, orderBy: { id: 'desc' }, take: 2 }))
      .map((v) => Number(v.valor_venta)).sort();
    expect(valores).toEqual([40000, 50000]);
  });

  it('no borra: lo pide y el dueño decide', async () => {
    const v = await prisma.venta.findFirstOrThrow({ where: { persona: 'Cliente del vendedor' } });
    expect((await api(`/ventas/${v.id}`, { method: 'DELETE' })).status).toBe(403);
    const pedido = await api(`/solicitudes/borrar-venta/${v.id}`, { method: 'POST', body: JSON.stringify({ motivo: 'Se registró dos veces' }) });
    expect(pedido.status).toBe(201);
    const { id } = (await pedido.json()).data;
    const mias = (await (await api('/solicitudes')).json()).data;
    expect(mias.some((s: { id: number; estado: string }) => s.id === id && s.estado === 'pendiente')).toBe(true);

    expect((await comoDueno(`/solicitudes/${id}/aprobar`, { method: 'POST' })).ok).toBe(true);
    expect(await prisma.venta.findUnique({ where: { id: v.id } })).toBeNull();
  });

  it('quitarle el rol le corta el acceso en el acto, aunque su sesión siga viva', async () => {
    expect((await comoDueno(`/usuarios/${vendedorId}/rol`, { method: 'PATCH', body: JSON.stringify({ rol_id: 2 }) })).ok).toBe(true);
    expect((await api('/ventas')).status).toBe(403);
  });
});
