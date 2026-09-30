import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/config/prisma';
import { abrirComoCliente, cerrarNavegador, irA } from './navegador';

/**
 * RECORRIDO — el portal del cliente: lo suyo, visto por él.
 *
 * Es la primera prueba de navegador que NO entra como administrador, y por eso
 * existe: estas tres pantallas enseñan datos que dependen de QUIÉN pregunta
 * (sus favoritos, sus compras, su garantía). Un recorrido de admin las vería
 * vacías y pasaría igual sin comprobar nada.
 *
 * Se escribió al pasar el portal a la capa HTTP única (2026-08-22). Ahí las
 * cuatro pantallas se tragaban el error en silencio: si la petición fallaba,
 * "Mis favoritos" decía que no tienes ninguno y "Mis recompensas" que el
 * programa no está activo. Ahora se distingue no tener de no haber podido
 * cargar, y esto vigila que lo que SÍ hay siga llegando.
 */

const CLIENTE = { email: 'clienta@prueba.local', clave: 'Prueba123!' };

afterAll(cerrarNavegador);

/** Su perfume y su cuenta: las dos pruebas miran a la MISMA clienta. */
let clientaId = 0;
let perfumeId = 0;

beforeAll(async () => {
  // Categoría propia: los recorridos no comparten catálogo (ver `tienda.ts`).
  const categoria = await prisma.categoria.create({ data: { nombre: 'Portal' } });
  const perfume = await prisma.perfume.create({
    data: {
      nombre: 'Perfume del Portal',
      precio: 60000,
      categoria_id: categoria.id,
      publicado: true,
      // `comprado` para no tener que sembrarle receta ni esencia: aquí no se
      // vende nada, solo se mira lo que el cliente ya tiene.
      tipo_producto: 'comprado',
    },
  });

  // El rol 1 es el administrador; cualquier otro es cliente. `upsert` y no
  // `create`: una corrida lo encontró ya creado (2026-09-29, intermitente) y el
  // recorrido entero cayó antes de empezar por algo que no es lo que prueba.
  const rolCliente = await prisma.role.upsert({ where: { id: 2 }, update: {}, create: { id: 2, nombre: 'cliente' } });
  const clienta = await prisma.user.create({
    data: {
      nombre: 'Clienta',
      apellido: 'Prueba',
      email: CLIENTE.email,
      password: await bcrypt.hash(CLIENTE.clave, 10),
      rol_id: rolCliente.id,
      activo: true,
    },
  });

  await prisma.favorito.create({ data: { user_id: clienta.id, perfume_id: perfume.id } });

  // Una compra SUYA y pagada: sin `pagada` no hay ni reseña ni garantía.
  await prisma.venta.create({
    data: {
      dia: new Date('2026-08-20'),
      persona: 'Clienta Prueba',
      user_id: clienta.id,
      cantidad_perfumes: 1,
      presentacion: '30ml',
      referencia_perfume: 'Perfume del Portal',
      valor_venta: 60000,
      pagada: true,
      perfumes: { create: [{ perfume_id: perfume.id, cantidad: 1 }] },
    },
  });

  clientaId = clienta.id;
  perfumeId = perfume.id;
});

describe('el portal del cliente', () => {
  it('le enseña sus favoritos, sus compras y la garantía de su pedido', async () => {
    const { contexto, pagina } = await abrirComoCliente(CLIENTE.email, CLIENTE.clave);

    // "Mis favoritos" pinta lo que devuelve `/favoritos/detalle`, pero solo
    // deja ver lo que ADEMÁS está en la lista de ids del proveedor: si una de
    // las dos peticiones se rompe, la página queda vacía sin decir nada.
    await irA(pagina, '/mis-favoritos');
    await pagina.waitForSelector('text=Perfume del Portal');

    // "Mis compras" son dos peticiones distintas en la misma pantalla: la
    // tarjeta para reseñar (arriba) y la garantía del pedido (abajo).
    await irA(pagina, '/mis-compras');
    await pagina.waitForSelector('text=Perfume del Portal');
    await pagina.waitForSelector('text=Garantía de mis pedidos');

    // Y la reseña se puede dejar de verdad: es la única mutación del portal que
    // manda un formulario con archivos (multipart), el camino que más fácil se
    // rompe al cambiar de librería de red.
    await pagina.getByRole('button', { name: '5 estrellas' }).click();
    await pagina.getByPlaceholder(/qué te pareció/i).fill('Huele muy rico y duró todo el día.');
    await pagina.getByRole('button', { name: 'Enviar reseña' }).click();
    await pagina.waitForSelector('text=/quedó en revisión/i');

    await contexto.close();

    const resena = await prisma.resena.findFirstOrThrow({ where: { user_id: clientaId } });
    expect(resena.perfume_id).toBe(perfumeId);
    expect(resena.rating).toBe(5);
    expect(resena.estado).toBe('pendiente');
  });

  /**
   * Las otras dos pantallas del portal, que son las que más fácil MIENTEN: si
   * su petición falla, una dice que el programa de sellos no está activo y la
   * otra que no tienes créditos. Aquí las dos tienen algo real que enseñar, así
   * que si vuelven a decir eso es que la carga se rompió.
   */
  it('le enseña sus sellos y su deuda', async () => {
    /**
     * La tarjeta de sellos es UNA sola para toda la tienda, así que este
     * recorrido no puede darla por vacía: el de promociones también la
     * configura. Se escribe justo antes de mirarla, con un premio que solo
     * usa esta prueba, y así el orden de los archivos deja de importar.
     */
    const premio = 'Un llavero del Portal';
    const config = await prisma.recompensaConfig.findFirst();
    const datos = { activo: true, sellos_objetivo: 5, premio };
    if (config) await prisma.recompensaConfig.update({ where: { id: config.id }, data: datos });
    else await prisma.recompensaConfig.create({ data: datos });
    await prisma.credito.create({
      data: {
        fecha: new Date('2026-08-20'),
        user_id: clientaId,
        articulos: 'Perfume del Portal',
        deuda_inicial: 60000,
        abonos: {
          create: [
            // Cargado después (como los de antes del sistema): la hora de cuando se
            // tecleó no es la del pago, así que NO se muestra
            { monto: 20000, fecha: new Date('2026-08-22'), created_at: new Date('2026-09-01T15:00:00Z') },
            // Anotado el mismo día, a las 8:27 p.m. de Colombia (01:27 del 26 en UTC)
            { monto: 10000, fecha: new Date('2026-08-25'), created_at: new Date('2026-08-26T01:27:00Z') },
          ],
        },
      },
    });

    const { contexto, pagina } = await abrirComoCliente(CLIENTE.email, CLIENTE.clave);

    // Su compra pagada ya vale un sello: la tarjeta cuenta desde el historial.
    await irA(pagina, '/mis-recompensas');
    await pagina.waitForSelector('text=/Llevas/');
    await pagina.waitForSelector(`text=${premio}`);

    await irA(pagina, '/mi-credito');
    await pagina.waitForSelector('text=Deuda total actual');
    await pagina.waitForSelector('text=/60\.000/');

    // El historial de pagos: cuántos lleva, cuándo y en cuánto quedó la deuda
    await pagina.getByRole('button', { name: 'Ver historial de pagos (2)' }).click();
    await pagina.waitForSelector('text=25 ago 2026 · 8:27 p. m.');
    await pagina.waitForSelector('text=/Quedó en .*30\.000/');
    // El abono cargado después no enseña hora: sería la de cuando se tecleó
    expect(await pagina.getByText('22 ago 2026', { exact: true }).count()).toBe(1);
    // Y el cliente mira, no borra
    expect(await pagina.getByRole('button', { name: /Borrar abono de/ }).count()).toBe(0);

    await contexto.close();
  });
});
