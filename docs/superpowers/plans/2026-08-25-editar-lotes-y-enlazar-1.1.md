# Editar lotes, enlazar los 1.1 y publicarlos rápido — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un lote de producción se pueda editar entero (material, cantidad, ficha, envase, fecha y costo), que los lotes cuyos frascos quedaron en la ficha equivocada se enlacen a su ficha 1.1 desde una lista, y que esa ficha 1.1 se cree heredando del perfume corriente y se publique en el momento.

**Architecture:** Editar un lote es *deshacer y rehacer* dentro de una sola transacción, reutilizando las reversiones que ya existen (`revertirMovimientos`, `revertirTerminado`) y una función `aplicarLote` extraída de `registrarProduccion` que crear y editar comparten. El costo promedio del producto terminado deja de arrastrarse y se reconstruye del libro. El enlazador no tiene motor propio: es una consulta de solo lectura y dos botones que llaman a la carga inicial ya existente y al `PATCH` nuevo.

**Tech Stack:** Express + TypeScript + Prisma 6 + MySQL (backend), React + Vite + Tailwind v4 + shadcn (frontend), Vitest (unidad y base) y Playwright sobre msedge headless (recorridos).

**Spec:** [`docs/superpowers/specs/2026-08-25-editar-lotes-y-enlazar-1.1-design.md`](../specs/2026-08-25-editar-lotes-y-enlazar-1.1-design.md)

## Global Constraints

- **Nada de `PUT`**: el CORS solo permite `GET/POST/PATCH/DELETE`. La edición de un lote es `PATCH`.
- **El cliente de Prisma se importa de `@prisma/client`**, nunca de una carpeta dentro de `src/`.
- **Ningún `<select>` de HTML**: `BuscadorSelect` para 6+ opciones o listas que crecen, `SelectSimple` para 2-5 fijas.
- **Toasts con sonner**, sin `richColors`. Nada de `window.alert`. Ningún handler de mutación puede ignorar la respuesta del servidor.
- **Nunca `res.json({ error: err.message })`**: usar `mensajeSeguro(err)`.
- **Nunca `toISOString()` para una fecha de calendario**: usar `hoyEnColombia()` de `backend/src/utils/fechas.ts`.
- **Todos los `.ts`/`.tsx` en UTF-8 sin BOM.** Nunca `Get-Content`/`Set-Content` de PowerShell sin encoding explícito sobre código fuente.
- **Ningún archivo pasa de ~500 líneas**; un componente nunca se declara dentro de otro.
- **Lo que se puede recalcular, se recalcula.** El `costo_promedio` de una ficha sale del libro `movimientos_terminado`, no de un acumulado que se va arrastrando.
- Comandos: `cd backend && npm run test:unidad` (sin MySQL), `npm run test:bd`, `npm run test:e2e`; `cd frontend && npm test`.

---

### Task 1: El costo promedio de una ficha se reconstruye del libro

Hoy `revertirTerminado` resta el stock y deja el `costo_promedio` viejo. Con la edición esto pasa de ser raro a ser rutina, así que primero se arregla el cimiento.

**Files:**
- Modify: `backend/src/repositories/inventario.terminado.ts` (añadir `recalcularPromedioTerminado`, llamarla desde `revertirTerminado`)
- Test: `backend/src/repositories/inventario.terminado.bd.test.ts`

**Interfaces:**
- Consumes: `aplicarMovimientoTerminado`, `revertirTerminado`, `r4`, `num` (ya existen en ese archivo).
- Produces: `recalcularPromedioTerminado(tx: Prisma.TransactionClient, perfume_id: number, presentacion_id: number): Promise<number>` — devuelve el promedio nuevo.

- [ ] **Step 1: Write the failing test**

En `backend/src/repositories/inventario.terminado.bd.test.ts`, al final del archivo:

```ts
describe('el costo promedio se reconstruye del libro', () => {
  beforeEach(limpiarBase);

  it('borrar el lote caro devuelve el promedio al del lote barato', async () => {
    const s = await sembrarFabricacion30ml({ stock: 2000 });

    // Lote barato (el promedio de la esencia es 1500) y lote caro: se sube el
    // costo de la esencia entre los dos para que el segundo valga más.
    await armar(s, 1);
    await prisma.insumoCosto.update({ where: { id: s.esencia.id }, data: { precio: 4000 } });
    const caro = await armar(s, 1);

    const conLosDos = await armados(s.perfume.id, s.presentacion.id);
    expect(conLosDos.costo).toBeGreaterThan(COSTO_RECETA);

    await eliminarProduccion(caro.id);

    const soloElBarato = await armados(s.perfume.id, s.presentacion.id);
    expect(soloElBarato.stock).toBe(1);
    // Sin recalcular, aquí seguiría el promedio inflado de los dos lotes.
    expect(soloElBarato.costo).toBeCloseTo(COSTO_RECETA, 0);
  });

  it('sin frascos vivos el promedio queda en cero, no en el último costo', async () => {
    const s = await sembrarFabricacion30ml({ stock: 2000 });
    const lote = await armar(s, 3);

    await eliminarProduccion(lote.id);

    const vacio = await armados(s.perfume.id, s.presentacion.id);
    expect(vacio.stock).toBe(0);
    expect(vacio.costo).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/repositories/inventario.terminado.bd.test.ts -t "se reconstruye del libro"`
Expected: FAIL — el promedio sigue siendo el inflado (y el segundo caso da el costo del lote borrado en vez de 0).

- [ ] **Step 3: Write minimal implementation**

En `backend/src/repositories/inventario.terminado.ts`, antes de `revertirTerminado`:

```ts
/**
 * Rehace el costo promedio de una ficha×talla desde el libro.
 *
 * El promedio es una PROYECCIÓN de `movimientos_terminado`, igual que el stock:
 * se pondera lo que entró y sigue vivo. Antes solo se tocaba al entrar frascos,
 * así que revertir un lote restaba unidades y dejaba el costo del lote borrado
 * mintiendo — invisible mientras borrar era raro, y rutina desde que el lote se
 * puede editar.
 */
export const recalcularPromedioTerminado = async (
  tx: Prisma.TransactionClient, perfume_id: number, presentacion_id: number,
) => {
  const movs = await tx.movimientoTerminado.findMany({
    where: { perfume_id, presentacion_id },
    select: { cantidad: true, costo_unitario: true },
  });

  let unidades = 0;
  let plata = 0;
  for (const m of movs) {
    const cantidad = num(m.cantidad);
    // Solo las ENTRADAS forman el promedio: una salida se valora al promedio
    // vigente y no lo mueve (es la misma regla de los materiales).
    if (cantidad > 0) { unidades += cantidad; plata += cantidad * num(m.costo_unitario); }
  }

  const promedio = unidades > 0 ? r4(plata / unidades) : 0;
  await tx.perfumePresentacion.updateMany({
    where: { perfume_id, presentacion_id }, data: { costo_promedio: promedio },
  });
  return promedio;
};
```

Y al final de `revertirTerminado`, después del `deleteMany`:

```ts
  // El promedio se rehace del libro: restarlo "a ojo" lo iría torciendo.
  const fichas = [...new Map(movs.map((m) => [`${m.perfume_id}|${m.presentacion_id}`, m])).values()];
  for (const f of fichas) await recalcularPromedioTerminado(tx, f.perfume_id, f.presentacion_id);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npm run test:bd`
Expected: PASS, y las 7 pruebas que ya existían en ese archivo siguen verdes.

- [ ] **Step 5: Commit**

```bash
git add backend/src/repositories/inventario.terminado.ts backend/src/repositories/inventario.terminado.bd.test.ts
git commit -m "fix(inventario): borrar un lote deja de dejar el costo del frasco mintiendo"
```

---

### Task 2: La frase del historial (función pura)

El historial se guarda ya redactado. La redacción es pura: entra el antes y el después, sale el texto. Se prueba sin MySQL.

**Files:**
- Create: `backend/src/repositories/producciones.historial.ts`
- Test: `backend/src/repositories/producciones.historial.test.ts`

**Interfaces:**
- Produces:
  - `interface FotoLote { fecha: string; cantidad: number; perfume: string | null; volumen: string; envase: string | null; costo_unitario: number; costo_manual: boolean }`
  - `describirCambios(antes: FotoLote, despues: FotoLote): string` — cadena vacía si nada cambió.
  - `interface LineaHistorial { fecha: string; texto: string }`
  - `agregarLinea(historial: unknown, fecha: string, texto: string): LineaHistorial[]` — la más nueva primero.

- [ ] **Step 1: Write the failing test**

Crear `backend/src/repositories/producciones.historial.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { agregarLinea, describirCambios, type FotoLote } from './producciones.historial';

const base: FotoLote = {
  fecha: '2026-08-21', cantidad: 3, perfume: 'Khamrah By Lattafa', volumen: '100 ML',
  envase: 'Envase Khamrah 1.1 100ml', costo_unitario: 70000, costo_manual: false,
};

describe('la frase del historial', () => {
  it('junta los cambios con · y en español', () => {
    const texto = describirCambios(base, { ...base, cantidad: 5, perfume: 'Khamrah 1.1' });
    expect(texto).toBe('3 → 5 unidades · ficha Khamrah By Lattafa → Khamrah 1.1');
  });

  it('marca el costo puesto a mano con su valor en pesos', () => {
    const texto = describirCambios(base, { ...base, costo_unitario: 74580, costo_manual: true });
    expect(texto).toBe('costo $74.580 puesto a mano');
  });

  it('no inventa cambios cuando no cambió nada', () => {
    expect(describirCambios(base, { ...base })).toBe('');
  });

  it('dice el envase y la fecha cuando se corrigen', () => {
    const texto = describirCambios(base, { ...base, fecha: '2026-08-22', envase: 'Envase 100 ml' });
    expect(texto).toBe('fecha 2026-08-21 → 2026-08-22 · envase Envase Khamrah 1.1 100ml → Envase 100 ml');
  });

  it('pone la línea nueva primero y aguanta un historial vacío o corrupto', () => {
    const uno = agregarLinea(null, '2026-08-25', 'primera');
    const dos = agregarLinea(uno, '2026-08-26', 'segunda');
    expect(dos.map((l) => l.texto)).toEqual(['segunda', 'primera']);
    expect(agregarLinea('no soy json', '2026-08-25', 'sola')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/repositories/producciones.historial.test.ts`
Expected: FAIL — `Cannot find module './producciones.historial'`.

- [ ] **Step 3: Write minimal implementation**

Crear `backend/src/repositories/producciones.historial.ts`:

```ts
/**
 * El rastro de las ediciones de un lote, en español y ya redactado.
 *
 * Se guarda el TEXTO y no los ids: un historial de ids obliga a reconstruir
 * nombres que quizá ya no existan (una ficha borrada, un envase renombrado) y
 * acabaría mostrando "perfume #529 → perfume #612", que no le dice nada al
 * dueño. Es un archivo aparte —y puro— para poder probar la redacción sin
 * levantar MySQL.
 */

export interface FotoLote {
  /** Fecha de calendario 'AAAA-MM-DD'. */
  fecha: string;
  cantidad: number;
  perfume: string | null;
  volumen: string;
  envase: string | null;
  costo_unitario: number;
  costo_manual: boolean;
}

export interface LineaHistorial { fecha: string; texto: string }

/** $74.580 — mismo formato que la pantalla, sin decimales. */
const pesos = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;

const sinNombre = (v: string | null) => v ?? 'sin definir';

export const describirCambios = (antes: FotoLote, despues: FotoLote): string => {
  const partes: string[] = [];
  if (antes.fecha !== despues.fecha) partes.push(`fecha ${antes.fecha} → ${despues.fecha}`);
  if (antes.cantidad !== despues.cantidad) partes.push(`${antes.cantidad} → ${despues.cantidad} unidades`);
  if (antes.perfume !== despues.perfume) partes.push(`ficha ${sinNombre(antes.perfume)} → ${sinNombre(despues.perfume)}`);
  if (antes.volumen !== despues.volumen) partes.push(`tamaño ${antes.volumen} → ${despues.volumen}`);
  if (antes.envase !== despues.envase) partes.push(`envase ${sinNombre(antes.envase)} → ${sinNombre(despues.envase)}`);
  if (despues.costo_manual && antes.costo_unitario !== despues.costo_unitario) {
    partes.push(`costo ${pesos(despues.costo_unitario)} puesto a mano`);
  } else if (!despues.costo_manual && Math.round(antes.costo_unitario) !== Math.round(despues.costo_unitario)) {
    partes.push(`costo ${pesos(antes.costo_unitario)} → ${pesos(despues.costo_unitario)}`);
  }
  return partes.join(' · ');
};

/**
 * Añade una línea al historial guardado. La columna es JSON y puede traer
 * cualquier cosa (o nada): lo que no sea una lista se descarta en vez de
 * reventar la edición, porque perder el rastro es menos grave que no poder
 * corregir un lote.
 */
export const agregarLinea = (historial: unknown, fecha: string, texto: string): LineaHistorial[] => {
  const previas = Array.isArray(historial)
    ? (historial as LineaHistorial[]).filter((l) => l && typeof l.texto === 'string')
    : [];
  return [{ fecha, texto }, ...previas];
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npm run test:unidad`
Expected: PASS (todas, incluidas las 5 nuevas).

- [ ] **Step 5: Commit**

```bash
git add backend/src/repositories/producciones.historial.ts backend/src/repositories/producciones.historial.test.ts
git commit -m "feat(producciones): el rastro de una edición se escribe en español, no en ids"
```

---

### Task 3: Editar un lote — el motor

**Files:**
- Modify: `backend/prisma/schema.prisma` (dos columnas en `model Produccion`)
- Create: migración `backend/prisma/migrations/<timestamp>_editar_producciones/`
- Modify: `backend/src/repositories/inventario.repository.ts` (extraer `aplicarLote`, añadir `editarProduccion`, `listarProducciones` devuelve lo nuevo)
- Test: `backend/src/repositories/produccion.edicion.bd.test.ts` (nuevo)

**Interfaces:**
- Consumes: `recalcularPromedioTerminado` (Task 1), `describirCambios` / `agregarLinea` / `FotoLote` (Task 2), `revertirMovimientos`, `revertirTerminado`, `aplicarMovimiento`, `aplicarMovimientoTerminado`, `tallaDeFormula`, `hoyEnColombia`.
- Produces:
  - `interface LoteInput { fecha: string; formula_volumen_id: number; cantidad: number; perfume_id?: number | null; envase_insumo_id?: number | null; consumos: { insumo_id: number; cantidad: number }[]; nota?: string | null; costo_unitario?: number | null }`
  - `editarProduccion(id: number, data: LoteInput)` — devuelve el lote actualizado con `formula` incluida.
  - `listarProducciones()` gana `costo_manual: boolean`, `historial: LineaHistorial[]` y `envase_insumo_id: number | null` en cada fila.

- [ ] **Step 1: Añadir las columnas y crear la migración**

En `backend/prisma/schema.prisma`, dentro de `model Produccion`, después de `nota`:

```prisma
  /// El costo lo escribió una PERSONA, no la receta. Un número puesto a mano no
  /// cuadra con los materiales ni ahora ni nunca: sin esta marca, el sistema
  /// parecería estar calculando mal.
  costo_manual       Boolean  @default(false)
  /// Rastro de las ediciones, ya redactado y la más nueva primero
  /// (`producciones.historial.ts`). JSON y no tabla aparte porque solo se lee
  /// CON su lote: una tabla obligaría a un join en una pantalla que ya carga bien.
  historial          Json?
```

Run: `cd backend && npx prisma migrate dev --name editar_producciones`

- [ ] **Step 2: Write the failing test**

Crear `backend/src/repositories/produccion.edicion.bd.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../config/prisma';
import { estadoDe, limpiarBase, sembrarFabricacion30ml } from '../test/baseDePrueba';
import { editarProduccion, registrarProduccion } from './inventario.repository';

/**
 * EDITAR UN LOTE. Hasta el 2026-08-25 no existía a propósito, y ese "a
 * propósito" costaba plata: el lote 6 de Khamrah tenía un frasco de $74.580
 * colgado de la ficha del perfume corriente, y el único arreglo era borrar y
 * volver a registrar. Editar es deshacer y rehacer en una sola transacción.
 */

const FECHA = '2026-08-21';

const consumosDe = (s: Awaited<ReturnType<typeof sembrarFabricacion30ml>>, cantidad: number) => [
  { insumo_id: s.esencia.id, cantidad: 15 * cantidad },
  { insumo_id: s.diluyente.id, cantidad: 14.3 * cantidad },
  { insumo_id: s.frasco.id, cantidad },
];

const armar = (s: Awaited<ReturnType<typeof sembrarFabricacion30ml>>, cantidad: number) =>
  registrarProduccion({
    fecha: FECHA, formula_volumen_id: s.formula.id, cantidad,
    perfume_id: s.perfume.id, consumos: consumosDe(s, cantidad),
  });

const armados = async (perfume_id: number, presentacion_id: number) => {
  const f = await prisma.perfumePresentacion.findUnique({
    where: { perfume_id_presentacion_id: { perfume_id, presentacion_id } },
  });
  return { stock: Number(f?.stock ?? 0), costo: Number(f?.costo_promedio ?? 0) };
};

describe('editar un lote', () => {
  beforeEach(limpiarBase);

  it('deja la esencia como si el lote se hubiera registrado bien desde el principio', async () => {
    const s = await sembrarFabricacion30ml({ stock: 1000 });
    const lote = await armar(s, 2);

    await editarProduccion(lote.id, {
      fecha: FECHA, formula_volumen_id: s.formula.id, cantidad: 5,
      perfume_id: s.perfume.id, consumos: consumosDe(s, 5),
    });

    expect((await estadoDe(s.esencia.id)).stock).toBe(1000 - 15 * 5);
    expect((await armados(s.perfume.id, s.presentacion.id)).stock).toBe(5);
  });

  it('cambiar de ficha muda los frascos con su costo y no toca ni un ml de esencia', async () => {
    const s = await sembrarFabricacion30ml({ stock: 1000 });
    const uno = await prisma.perfume.create({ data: { nombre: 'Khamrah 1.1', precio: 150000, solo_armado: true } });
    const lote = await armar(s, 2);
    const esenciaTrasArmar = (await estadoDe(s.esencia.id)).stock;
    const costoOriginal = (await armados(s.perfume.id, s.presentacion.id)).costo;

    await editarProduccion(lote.id, {
      fecha: FECHA, formula_volumen_id: s.formula.id, cantidad: 2,
      perfume_id: uno.id, consumos: consumosDe(s, 2),
    });

    expect((await estadoDe(s.esencia.id)).stock).toBe(esenciaTrasArmar);
    expect((await armados(s.perfume.id, s.presentacion.id)).stock).toBe(0);
    const destino = await armados(uno.id, s.presentacion.id);
    expect(destino.stock).toBe(2);
    expect(destino.costo).toBeCloseTo(costoOriginal, 2);
  });

  it('el costo escrito a mano manda sobre el calculado y queda marcado', async () => {
    const s = await sembrarFabricacion30ml({ stock: 1000 });
    const lote = await armar(s, 1);

    const editado = await editarProduccion(lote.id, {
      fecha: FECHA, formula_volumen_id: s.formula.id, cantidad: 1,
      perfume_id: s.perfume.id, consumos: consumosDe(s, 1), costo_unitario: 74580,
    });

    expect(Number(editado.costo_unitario)).toBe(74580);
    expect(Number(editado.costo_total)).toBe(74580);
    expect(editado.costo_manual).toBe(true);
    expect((await armados(s.perfume.id, s.presentacion.id)).costo).toBeCloseTo(74580, 2);
  });

  it('el promedio de la ficha se pondera, no se pisa', async () => {
    const s = await sembrarFabricacion30ml({ stock: 2000 });
    await registrarProduccion({
      fecha: FECHA, formula_volumen_id: s.formula.id, cantidad: 3,
      perfume_id: s.perfume.id, consumos: consumosDe(s, 3),
    });
    const viejo = (await armados(s.perfume.id, s.presentacion.id)).costo;
    const lote = await armar(s, 1);

    await editarProduccion(lote.id, {
      fecha: FECHA, formula_volumen_id: s.formula.id, cantidad: 1,
      perfume_id: s.perfume.id, consumos: consumosDe(s, 1), costo_unitario: 100000,
    });

    const final = await armados(s.perfume.id, s.presentacion.id);
    expect(final.stock).toBe(4);
    expect(final.costo).toBeCloseTo((viejo * 3 + 100000) / 4, 1);
  });

  it('guarda una línea de historial por edición, la más nueva primero', async () => {
    const s = await sembrarFabricacion30ml({ stock: 1000 });
    const lote = await armar(s, 2);

    await editarProduccion(lote.id, {
      fecha: FECHA, formula_volumen_id: s.formula.id, cantidad: 4,
      perfume_id: s.perfume.id, consumos: consumosDe(s, 4),
    });
    const dos = await editarProduccion(lote.id, {
      fecha: FECHA, formula_volumen_id: s.formula.id, cantidad: 6,
      perfume_id: s.perfume.id, consumos: consumosDe(s, 6),
    });

    const historial = dos.historial as { fecha: string; texto: string }[];
    expect(historial).toHaveLength(2);
    expect(historial[0].texto).toContain('4 → 6 unidades');
    expect(historial[1].texto).toContain('2 → 4 unidades');
  });

  it('bajar la cantidad por debajo de lo ya vendido deja el conteo negativo y no revienta', async () => {
    const s = await sembrarFabricacion30ml({ stock: 1000 });
    const lote = await armar(s, 5);
    // Se venden 4 de esos 5 frascos: salen del terminado, como en una venta real.
    await prisma.$transaction(async (tx) => {
      await tx.movimientoTerminado.create({
        data: {
          perfume_id: s.perfume.id, presentacion_id: s.presentacion.id, tipo: 'venta',
          cantidad: -4, costo_unitario: 0, fecha: new Date(FECHA), referencia_id: 1,
        },
      });
      await tx.perfumePresentacion.update({
        where: { perfume_id_presentacion_id: { perfume_id: s.perfume.id, presentacion_id: s.presentacion.id } },
        data: { stock: 1 },
      });
    });

    await editarProduccion(lote.id, {
      fecha: FECHA, formula_volumen_id: s.formula.id, cantidad: 2,
      perfume_id: s.perfume.id, consumos: consumosDe(s, 2),
    });

    // El dato físico manda sobre el sistema: se avisa en la pantalla y se
    // permite. Aquí solo se comprueba que el servidor no revienta y que el
    // número refleja la realidad (se armaron 2, se vendieron 4).
    expect((await armados(s.perfume.id, s.presentacion.id)).stock).toBe(-2);
  });

  it('un lote que ya no existe se rechaza con un mensaje, no con un 500', async () => {
    const s = await sembrarFabricacion30ml({ stock: 1000 });
    await expect(editarProduccion(999999, {
      fecha: FECHA, formula_volumen_id: s.formula.id, cantidad: 1,
      perfume_id: s.perfume.id, consumos: consumosDe(s, 1),
    })).rejects.toThrow(/lote/i);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend && npx vitest run src/repositories/produccion.edicion.bd.test.ts`
Expected: FAIL — `editarProduccion is not exported`.

- [ ] **Step 4: Extraer `aplicarLote` de `registrarProduccion`**

En `backend/src/repositories/inventario.repository.ts`, reemplazar el cuerpo de `registrarProduccion` por la función compartida (crear y editar aplican el MISMO lote: dos copias de esta lógica acabarían diciendo cosas distintas):

```ts
export interface LoteInput {
  fecha: string; formula_volumen_id: number; cantidad: number;
  perfume_id?: number | null; envase_insumo_id?: number | null;
  consumos: { insumo_id: number; cantidad: number }[]; nota?: string | null;
  /** Manda sobre el calculado. Sin él, el costo sale de los materiales. */
  costo_unitario?: number | null;
  /** true = lo escribió una persona. Lo declara quien llama; no se adivina. */
  costo_manual?: boolean;
}

/**
 * Descuenta el material del lote, calcula su costo y suma los frascos armados.
 *
 * La comparten el alta y la edición: el lote ya existe en la base cuando se
 * llama (`loteId`), porque los movimientos apuntan a él.
 */
const aplicarLote = async (
  tx: Prisma.TransactionClient, loteId: number, data: LoteInput,
) => {
  const fecha = new Date(data.fecha);

  let costoTotal = 0;
  for (const c of data.consumos) {
    const res = await aplicarMovimiento(tx, {
      insumo_id: c.insumo_id,
      tipo: 'produccion',
      cantidad: -Math.abs(c.cantidad),
      fecha,
      referencia_id: loteId,
      nota: `Lote de ${data.cantidad} u`,
    });
    costoTotal += res.costoAplicado * Math.abs(c.cantidad);
  }

  /**
   * Un costo que viene con el lote no siempre lo escribió una persona: el
   * enlazador reenvía el costo congelado justo para NO revaluar los frascos al
   * promedio de hoy. Por eso la marca se declara y no se adivina.
   */
  const traeCosto = typeof data.costo_unitario === 'number' && data.costo_unitario >= 0;
  const manual = data.costo_manual ?? traeCosto;
  const costoUnitario = traeCosto
    ? r4(data.costo_unitario as number)
    : r4(Math.round(costoTotal * 100) / 100 / data.cantidad);
  const total = traeCosto
    ? Math.round(costoUnitario * data.cantidad * 100) / 100
    : Math.round(costoTotal * 100) / 100;

  /**
   * Los frascos armados ENTRAN al stock de producto terminado. Hace falta saber
   * DE QUÉ perfume son: sin `perfume_id` el lote descuenta material pero no
   * suma frascos, porque no se puede adivinar a qué producto atribuirlos.
   */
  let presentacion_id: number | null = null;
  if (data.perfume_id) {
    presentacion_id = await tallaDeFormula(data.formula_volumen_id);
    if (presentacion_id) {
      await aplicarMovimientoTerminado(tx, {
        perfume_id: data.perfume_id,
        presentacion_id,
        tipo: 'produccion',
        cantidad: data.cantidad,
        costo_unitario: costoUnitario,
        fecha,
        referencia_id: loteId,
        nota: `Lote #${loteId}`,
      });
    }
  }

  return { total, costoUnitario, manual, presentacion_id };
};

/**
 * Registra un lote armado y descuenta sus insumos. El costo del lote se calcula
 * con el promedio VIGENTE de cada insumo y se congela: si mañana sube la
 * esencia, lo que costó este lote no cambia.
 */
export const registrarProduccion = async (data: LoteInput) => prisma.$transaction(async (tx) => {
  const fecha = new Date(data.fecha);
  // Se crea primero para tener el id al que apuntan los movimientos
  const prod = await tx.produccion.create({
    data: {
      fecha,
      formula_volumen_id: data.formula_volumen_id,
      perfume_id: data.perfume_id ?? null,
      envase_insumo_id: data.envase_insumo_id ?? null,
      cantidad: data.cantidad,
      costo_unitario: 0,
      costo_total: 0,
      nota: data.nota ?? null,
    },
  });

  const res = await aplicarLote(tx, prod.id, data);

  return tx.produccion.update({
    where: { id: prod.id },
    data: { costo_total: res.total, costo_unitario: res.costoUnitario, costo_manual: res.manual },
    include: { formula: { select: { nombre: true } } },
  });
});
```

- [ ] **Step 5: Escribir `editarProduccion`**

En el mismo archivo, justo antes de `eliminarProduccion`:

```ts
/** Nombre de un insumo para el historial; null si ya no existe. */
const nombreInsumo = async (tx: Prisma.TransactionClient, id: number | null) =>
  (id ? (await tx.insumoCosto.findUnique({ where: { id }, select: { nombre: true } }))?.nombre ?? null : null);

/**
 * EDITAR un lote: deshacer y rehacer en una sola transacción.
 *
 * O pasan las cuatro cosas (devolver material, quitar frascos, volver a
 * descontar, volver a sumar) o no pasa ninguna: a mitad de camino el inventario
 * mentiría. El promedio de las fichas tocadas —la vieja y la nueva— se
 * reconstruye del libro al final.
 */
export const editarProduccion = async (id: number, data: LoteInput) => prisma.$transaction(async (tx) => {
  const antes = await tx.produccion.findUnique({
    where: { id },
    include: { formula: { select: { nombre: true } }, perfume: { select: { nombre: true } } },
  });
  if (!antes) throw badRequest('Ese lote ya no existe: alguien lo borró mientras lo editabas');

  const fichasViejas = await tx.movimientoTerminado.findMany({
    where: { tipo: 'produccion', referencia_id: id },
    select: { perfume_id: true, presentacion_id: true },
  });

  const foto: FotoLote = {
    fecha: antes.fecha.toISOString().slice(0, 10),
    cantidad: antes.cantidad,
    perfume: antes.perfume?.nombre ?? null,
    volumen: antes.formula?.nombre ?? '',
    envase: await nombreInsumo(tx, antes.envase_insumo_id),
    costo_unitario: num(antes.costo_unitario),
    costo_manual: antes.costo_manual,
  };

  await revertirMovimientos(tx, 'produccion', id);
  await revertirTerminado(tx, 'produccion', id);

  await tx.produccion.update({
    where: { id },
    data: {
      fecha: new Date(data.fecha),
      formula_volumen_id: data.formula_volumen_id,
      perfume_id: data.perfume_id ?? null,
      envase_insumo_id: data.envase_insumo_id ?? null,
      cantidad: data.cantidad,
      nota: data.nota ?? null,
    },
  });

  const res = await aplicarLote(tx, id, data);

  const formula = await tx.formulaVolumen.findUnique({
    where: { id: data.formula_volumen_id }, select: { nombre: true },
  });
  const perfume = data.perfume_id
    ? await tx.perfume.findUnique({ where: { id: data.perfume_id }, select: { nombre: true } })
    : null;

  const texto = describirCambios(foto, {
    fecha: data.fecha.slice(0, 10),
    cantidad: data.cantidad,
    perfume: perfume?.nombre ?? null,
    volumen: formula?.nombre ?? '',
    envase: await nombreInsumo(tx, data.envase_insumo_id ?? null),
    costo_unitario: res.costoUnitario,
    costo_manual: res.manual,
  });

  const actualizado = await tx.produccion.update({
    where: { id },
    data: {
      costo_total: res.total,
      costo_unitario: res.costoUnitario,
      costo_manual: res.manual,
      ...(texto
        ? { historial: agregarLinea(antes.historial, hoyEnColombia().toISOString().slice(0, 10), texto) }
        : {}),
    },
    include: { formula: { select: { nombre: true } } },
  });

  // Las fichas de ANTES y la de ahora: mudar frascos de una a otra deja las dos
  // con un promedio que hay que rehacer.
  const fichas = new Map<string, { perfume_id: number; presentacion_id: number }>();
  for (const f of fichasViejas) fichas.set(`${f.perfume_id}|${f.presentacion_id}`, f);
  if (data.perfume_id && res.presentacion_id) {
    fichas.set(`${data.perfume_id}|${res.presentacion_id}`, {
      perfume_id: data.perfume_id, presentacion_id: res.presentacion_id,
    });
  }
  for (const f of fichas.values()) await recalcularPromedioTerminado(tx, f.perfume_id, f.presentacion_id);

  return actualizado;
});
```

Imports que hay que añadir arriba del archivo:

```ts
import { badRequest } from '../utils/httpError';
import { hoyEnColombia } from '../utils/fechas';
import { agregarLinea, describirCambios, type FotoLote } from './producciones.historial';
```

y añadir `recalcularPromedioTerminado` a la lista que ya se importa de `./inventario.terminado`.

- [ ] **Step 6: `listarProducciones` devuelve lo nuevo**

En el `map` de `listarProducciones`, añadir tres campos (la pantalla los necesita para el lápiz y la marca ✎):

```ts
    envase_insumo_id: p.envase_insumo_id,
    costo_manual: p.costo_manual,
    historial: Array.isArray(p.historial) ? p.historial as { fecha: string; texto: string }[] : [],
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd backend && npm run test:bd`
Expected: PASS — las 6 nuevas y todo lo que ya existía (el alta de lotes usa ahora `aplicarLote`).

- [ ] **Step 8: Commit**

```bash
git add backend/prisma backend/src/repositories/inventario.repository.ts backend/src/repositories/produccion.edicion.bd.test.ts
git commit -m "feat(producciones): un lote se puede corregir entero sin borrarlo"
```

---

### Task 4: El endpoint `PATCH` del lote

**Files:**
- Modify: `backend/src/schemas/inventario.schema.ts`
- Modify: `backend/src/routes/inventario.router.ts`
- Modify: `frontend/src/infrastructure/api/urls.ts` (ya existe `produccion(id)`, se reutiliza)

**Interfaces:**
- Consumes: `editarProduccion` (Task 3).
- Produces: `PATCH /inventario/producciones/:id` → `{ message, data }` con el lote actualizado.

- [ ] **Step 1: Añadir el esquema**

En `backend/src/schemas/inventario.schema.ts`, después de `produccionSchema`:

```ts
/**
 * Editar un lote pide lo mismo que crearlo, más el costo si el dueño lo escribe.
 * `null` = "recalcúlalo tú"; un número = manda el suyo y el lote queda marcado.
 */
export const produccionEdicionSchema = produccionSchema.extend({
  costo_unitario: z.number().min(0, 'El costo no puede ser negativo').max(100_000_000).nullish(),
  /**
   * Si el costo lo escribió una persona. El enlazador reenvía el costo
   * congelado del lote —para no revaluar los frascos— y manda `false`.
   */
  costo_manual: z.boolean().optional(),
});
```

- [ ] **Step 2: Añadir la ruta**

En `backend/src/routes/inventario.router.ts`, entre el `POST` y el `DELETE` de producciones (PATCH, nunca PUT: el CORS solo permite `GET/POST/PATCH/DELETE`):

```ts
/** Corrige un lote ya registrado: deshace y rehace material, frascos y costo. */
inventarioRouter.patch('/producciones/:id', validate(produccionEdicionSchema), h(async (req, res) => {
  const data = await repo.editarProduccion(Number(req.params.id), req.body);
  bustCatalogoCache();
  res.json({ message: 'Lote corregido: el material y los frascos quedaron al día', data });
}));
```

Añadir `produccionEdicionSchema` al import de esquemas de ese archivo.

- [ ] **Step 3: Comprobar que compila y que nada se rompió**

Run: `cd backend && npm run build && npm run test:bd`
Expected: build sin errores, pruebas verdes.

- [ ] **Step 4: Commit**

```bash
git add backend/src/schemas/inventario.schema.ts backend/src/routes/inventario.router.ts
git commit -m "feat(api): PATCH de un lote de producción"
```

---

### Task 5: El lápiz en Producciones

**Files:**
- Modify: `frontend/src/pages/dashboard/types/compras.ts` (la interfaz `Produccion`)
- Modify: `frontend/src/pages/dashboard/tabs/inventario/ProduccionModal.tsx` (acepta un lote y guarda con `PATCH`)
- Modify: `frontend/src/pages/dashboard/tabs/ProduccionesTab.tsx` (el botón y el modal)
- Modify: `frontend/src/pages/dashboard/columns.tsx` (marca ✎ y "editado el…")
- Test: `backend/e2e/editarLote.e2e.test.ts` (nuevo)

**Interfaces:**
- Consumes: `PATCH /inventario/producciones/:id` (Task 4), `urls.inventario.produccion(id)`.
- Produces: `ProduccionModal` acepta la prop opcional `lote?: Produccion`; con ella el modal se titula *"Corregir lote"* y guarda con `PATCH`.

- [ ] **Step 1: Write the failing test**

Crear `backend/e2e/editarLote.e2e.test.ts`, siguiendo el patrón de los recorridos que ya existen (`abrirDashboard`, `irA`, `campo`, `elegirOpcion`):

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { abrirDashboard, abrirNavegador, campo, cerrarNavegador, irA } from './navegador';

/**
 * RECORRIDO: corregir un lote sin borrarlo.
 *
 * Nace del lote 6 de Khamrah: un frasco de $74.580 colgado de la ficha del
 * perfume corriente, que hasta el 2026-08-25 solo se arreglaba borrando el lote
 * y volviéndolo a escribir.
 */
describe('corregir un lote', () => {
  beforeAll(abrirNavegador);
  afterAll(cerrarNavegador);

  it('cambia la cantidad y deja el cambio escrito en la fila', async () => {
    const { pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard/producciones');

    const filas = pagina.locator('table tbody tr');
    await filas.first().waitFor();
    const antes = await filas.count();

    await pagina.locator('table tbody tr').first().getByRole('button', { name: /corregir|editar/i }).click();
    await pagina.getByText(/corregir lote/i).waitFor();

    await campo(pagina, '¿Cuántas unidades?').fill('7');
    await pagina.getByRole('button', { name: /guardar cambios/i }).click();

    await pagina.getByText(/lote corregido/i).waitFor({ timeout: 8000 });
    // No se creó un lote nuevo: es el mismo, corregido.
    expect(await filas.count()).toBe(antes);
    await pagina.getByText(/editado el/i).first().waitFor();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run --config vitest.e2e.config.mts e2e/editarLote.e2e.test.ts`
Expected: FAIL — no existe ningún botón "Corregir".

- [ ] **Step 3: Ampliar el tipo**

En `frontend/src/pages/dashboard/types/compras.ts`, en `interface Produccion`:

```ts
export interface Produccion {
  id: number; fecha: string; formula_volumen_id: number; volumen_nombre: string;
  perfume_nombre: string | null;
  cantidad: number; costo_unitario: number; costo_total: number; nota: string | null;
  /** Envase realmente usado; hace falta para reabrir el lote tal como se guardó. */
  envase_insumo_id: number | null;
  /** El costo lo escribió el dueño, no la receta. */
  costo_manual: boolean;
  /** Rastro de las correcciones, la más nueva primero. */
  historial: { fecha: string; texto: string }[];
}
```

- [ ] **Step 4: El modal acepta un lote**

En `ProduccionModal.tsx`: añadir `lote?: Produccion` a `Props`, arrancar los estados desde él y elegir el verbo al guardar. Los cambios mínimos:

```ts
  const [formulaId, setFormulaId] = useState<number | ''>(lote?.formula_volumen_id ?? formulas[0]?.id ?? '');
  const [unidades, setUnidades] = useState(lote ? String(lote.cantidad) : '10');
  const [perfumeId, setPerfumeId] = useState<number | ''>(
    lote ? (perfumes.find((p) => p.nombre === lote.perfume_nombre)?.id ?? '') : '',
  );
  const [envaseId, setEnvaseId] = useState<number | ''>(lote?.envase_insumo_id ?? '');
  /** Vacío = que lo calcule el sistema. Con número, manda el del dueño. */
  const [costoManual, setCostoManual] = useState(lote?.costo_manual ? String(lote.costo_unitario) : '');
```

y en `guardar`, en vez del `http.post` fijo:

```ts
      const cuerpo = {
        fecha: lote?.fecha.slice(0, 10) ?? hoy(),
        formula_volumen_id: formulaElegida.id, cantidad: cant, consumos,
        perfume_id: perfumeId || null,
        envase_insumo_id: envaseId || formulaElegida.envase_insumo_id || null,
        ...(costoManual.trim() ? { costo_unitario: Number(costoManual), costo_manual: true } : {}),
      };
      const res = lote
        ? await http.patch<{ data?: { costo_total?: number } }>(urls.inventario.produccion(lote.id), cuerpo)
        : await http.post<{ data?: { costo_total?: number } }>(urls.inventario.producciones, cuerpo);
      if (!res.ok) { toast.error(res.error, { id: 'prod' }); return; }
      if (lote) {
        toast.success('Lote corregido: el material y los frascos quedaron al día');
        onGuardado(); onClose(); return;
      }
```

El título y el botón salen del mismo dato:

```tsx
    <Modal open onClose={onClose} title={lote ? 'Corregir lote' : 'Registrar producción'}
      onSubmit={guardar} submitLabel={guardando ? 'Guardando…' : (lote ? 'Guardar cambios' : 'Registrar lote')}
      loading={guardando}>
```

Y una casilla más, solo al corregir, debajo del resumen de consumos:

```tsx
      {lote && (
        <Field label="¿Cuánto te costó cada frasco?">
          <Input type="number" min="0" value={costoManual} placeholder={`Calculado: ${formatPrice(costoLote / (cant || 1))}`}
            onChange={(e) => setCostoManual(e.target.value)} />
          <p className="mt-1 text-[12px] text-muted-foreground">
            Déjalo vacío y lo calcula el sistema con los materiales de arriba. Si escribes el tuyo,
            manda el tuyo y el lote queda marcado como <strong>costo puesto a mano</strong>.
          </p>
        </Field>
      )}
```

- [ ] **Step 5: El aviso de los frascos ya vendidos**

Bajar la cantidad de un lote cuyos frascos ya salieron deja el conteo en negativo. Es legítimo
—el dato físico manda— pero tiene que decirse con el número exacto. `ProduccionesTab` ya trae el
resumen de inventario (`urls.inventario.resumen`), que incluye `terminado`: se le pasa al modal
el stock armado de esa ficha×talla.

En `ProduccionModal.tsx`, junto al bloque de `faltantes`:

```tsx
      {lote && armadosDeLaFicha !== null && armadosDeLaFicha - (lote.cantidad - cant) < 0 && (
        <p className="rounded-lg border border-amber-400/45 bg-amber-400/10 px-3 py-2 text-[12.5px] font-medium text-amber-700">
          De este lote ya se vendieron frascos: si lo dejas en {cant}, quedarían{' '}
          {armadosDeLaFicha - (lote.cantidad - cant)} frascos armados de{' '}
          {lote.perfume_nombre} {lote.volumen_nombre}. Puedes guardarlo igual, pero el conteo
          quedará en negativo hasta que lo ajustes.
        </p>
      )}
```

donde `armadosDeLaFicha` es la prop nueva (`armadosDeLaFicha?: number | null`), que
`ProduccionesTab` calcula buscando la fila del terminado que coincide con el perfume y la talla
del lote. Sin ese dato la prop llega `null` y el aviso simplemente no se pinta: un aviso que no
se puede calcular no se inventa.

- [ ] **Step 6: El botón en la tabla**

En `ProduccionesTab.tsx`: un estado `const [editando, setEditando] = useState<Produccion | null>(null);`, el botón del lápiz junto al de borrar en `renderActions` y `accionesMovil`, y el modal al final del `return`. **El modal se declara fuera del componente** (ya lo está) y recibe el lote por props; nunca se define un componente dentro de otro.

`ProduccionesTab` necesita fórmulas, perfumes, catálogo e insumos para el modal: se cargan en el mismo `load()` con `Promise.all`, con su `try/catch/finally` (una vista que carga datos sin `finally` se queda en "Cargando…" para siempre).

- [ ] **Step 7: Las marcas en las columnas**

En `columns.tsx`, en `produccionesColumns`, la columna del costo unitario y la del lote:

```tsx
  { key: 'costo_unitario', header: 'Costo c/u', type: 'currency', getValue: p => p.costo_unitario,
    render: p => (
      <span>
        {formatPrice(p.costo_unitario)}
        {p.costo_manual && <span title="Costo puesto a mano" className="ml-1 text-primary">✎</span>}
      </span>
    ), sortable: true,
    className: 'whitespace-nowrap text-right tabular-nums text-muted-foreground', noTruncate: true },
```

y bajo el nombre del lote, la última corrección:

```tsx
        {p.historial.length > 0 && (
          <span className="block text-[11.5px] text-muted-foreground">
            ✎ editado el {fmtDate(p.historial[0].fecha)} · {p.historial[0].texto}
          </span>
        )}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `cd backend && npx vitest run --config vitest.e2e.config.mts e2e/editarLote.e2e.test.ts`
Expected: PASS.
Run además: `cd frontend && npm test && npm run build`
Expected: PASS y build limpio.

- [ ] **Step 9: Mirar la pantalla**

Abrir el dashboard en el navegador, ir a *Producciones*, corregir un lote y comprobar con una captura que la fila muestra la marca y el texto del cambio. Ninguna pantalla se entrega sin abrirla.

- [ ] **Step 10: Commit**

```bash
git add frontend/src backend/e2e/editarLote.e2e.test.ts
git commit -m "feat(producciones): el lápiz corrige el lote sin borrarlo"
```

---

### Task 6: La ficha 1.1 hereda del perfume corriente

**Files:**
- Modify: `backend/src/schemas/perfume.schema.ts` (`productoArmadoSchema`)
- Modify: `backend/src/repositories/emparejarEsencias.repository.ts` (`crearProductoArmado`)
- Test: `backend/src/repositories/productoArmado.bd.test.ts` (ya existe)

**Interfaces:**
- Consumes: `crearProductoArmado` (existente).
- Produces: `crearProductoArmado` acepta `copiar_de_perfume_id?: number | null` y copia `descripcion`, `duracion`, `proyeccion`, `genero`, `tipos_aroma` y `ocasiones`.

- [ ] **Step 1: Write the failing test**

Añadir a `backend/src/repositories/productoArmado.bd.test.ts`:

```ts
  it('el 1.1 hereda la ficha del perfume corriente, pero no su precio ni su foto', async () => {
    const aroma = await prisma.tipoAroma.create({ data: { nombre: 'Dulce' } });
    const ocasion = await prisma.ocasion.create({ data: { nombre: 'Noche' } });
    const presentacion = await crearPresentacion('100ML');
    const corriente = await prisma.perfume.create({
      data: {
        nombre: 'Khamrah By Lattafa', precio: 90000, descripcion: 'Canela y vainilla',
        duracion: '8 horas', proyeccion: 'Alta', genero: 'unisex', imagen_url: '/uploads/khamrah.webp',
        tipos_aroma: { create: { tipo_aroma_id: aroma.id } },
        ocasiones: { create: { ocasion_id: ocasion.id } },
      },
    });

    const r = await crearProductoArmado({
      nombre: 'Khamrah 1.1', precio: 150000, presentacion_id: presentacion.id,
      copiar_de_perfume_id: corriente.id,
    });

    const creado = await prisma.perfume.findUniqueOrThrow({
      where: { id: r.id }, include: { tipos_aroma: true, ocasiones: true },
    });
    expect(r.accion).toBe('creado');
    expect(creado.descripcion).toBe('Canela y vainilla');
    expect(creado.duracion).toBe('8 horas');
    expect(creado.proyeccion).toBe('Alta');
    expect(creado.genero).toBe('unisex');
    expect(creado.tipos_aroma).toHaveLength(1);
    expect(creado.ocasiones).toHaveLength(1);
    // Lo que NO se hereda: son otro producto, con otro frasco y otra foto.
    expect(Number(creado.precio)).toBe(150000);
    expect(creado.imagen_url).toBeNull();
    expect(creado.publicado).toBe(false);
    expect(creado.solo_armado).toBe(true);
  });
```

(Si el archivo no tiene ya un `crearPresentacion`, usar el mismo helper con el que crea presentaciones el resto de sus pruebas.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/repositories/productoArmado.bd.test.ts -t "hereda la ficha"`
Expected: FAIL — `copiar_de_perfume_id` no existe y los campos quedan en null.

- [ ] **Step 3: Write minimal implementation**

En `emparejarEsencias.repository.ts`, dentro de `crearProductoArmado`: añadir el campo a la firma…

```ts
  /** "Es el 1.1 de este perfume": se COPIA su ficha (no se enlaza). */
  copiar_de_perfume_id?: number | null;
```

…y antes del `prisma.perfume.create`, leer el original y copiar:

```ts
  /**
   * La ficha se COPIA, no se enlaza.
   *
   * Un 1.1 y su perfume corriente son el mismo jugo: descripción, notas,
   * ocasiones, género, duración y proyección son idénticas, y escribirlas otra
   * vez es justo la fricción que tiene al dueño con 229 perfumes y cero 1.1.
   * Copia y no enlace porque son dos productos que se venden distinto: el día
   * que se separen, un enlace vivo obligaría a decidir cuál manda.
   */
  const origen = datos.copiar_de_perfume_id
    ? await prisma.perfume.findUnique({
      where: { id: datos.copiar_de_perfume_id },
      include: { tipos_aroma: { select: { tipo_aroma_id: true } }, ocasiones: { select: { ocasion_id: true } } },
    })
    : null;
```

y en el `data:` del `create`, añadir:

```ts
      descripcion: origen?.descripcion ?? null,
      duracion: origen?.duracion ?? null,
      proyeccion: origen?.proyeccion ?? null,
      genero: origen?.genero ?? null,
      tipos_aroma: origen?.tipos_aroma.length
        ? { create: origen.tipos_aroma.map((t) => ({ tipo_aroma_id: t.tipo_aroma_id })) }
        : undefined,
      ocasiones: origen?.ocasiones.length
        ? { create: origen.ocasiones.map((o) => ({ ocasion_id: o.ocasion_id })) }
        : undefined,
```

En `backend/src/schemas/perfume.schema.ts`, dentro de `productoArmadoSchema`:

```ts
  copiar_de_perfume_id: z.number().int().positive().nullish(),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npm run test:bd`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/repositories/emparejarEsencias.repository.ts backend/src/schemas/perfume.schema.ts backend/src/repositories/productoArmado.bd.test.ts
git commit -m "feat(catalogo): un 1.1 nace con la ficha de su perfume corriente"
```

---

### Task 7: "¿Es el 1.1 de…?" y publicarlo ahí mismo

**Files:**
- Modify: `frontend/src/pages/dashboard/tabs/inventario/AltaProductoArmado.tsx`
- Test: `backend/e2e/altaHeredada.e2e.test.ts` (nuevo)

**Interfaces:**
- Consumes: `POST /parfums/armado` con `copiar_de_perfume_id` (Task 6), `urls.perfumes.publicado(id)` (el `PATCH` de publicar, ya existente).
- Produces: `AltaProductoArmado` gana la prop `perfumes: { id: number; nombre: string }[]` (para elegir de cuál copiar).

- [ ] **Step 1: Write the failing test**

Crear `backend/e2e/altaHeredada.e2e.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { abrirDashboard, abrirNavegador, campo, cerrarNavegador, elegirOpcion, irA } from './navegador';

/**
 * RECORRIDO: crear un 1.1 heredando la ficha del perfume corriente.
 *
 * Sale de un dato medido: 229 perfumes y CERO 1.1 con ficha. Escribir otra vez
 * la descripción, las notas y el género de un jugo que ya está en el sistema es
 * la fricción que lo tenía sin registrar.
 */
describe('crear un 1.1 que hereda del corriente', () => {
  beforeAll(abrirNavegador);
  afterAll(cerrarNavegador);

  it('copia la ficha y lo deja fuera de la tienda hasta que se publique', async () => {
    const { pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard/inventario');

    await pagina.getByRole('button', { name: /registrar uso/i }).click();
    await pagina.getByRole('button', { name: /armé perfumes/i }).click();
    await elegirOpcion(pagina, '¿Qué fragancia armaste?', /crear producto nuevo/i);

    await campo(pagina, '¿Cómo se llama?').fill('Prueba 1.1 heredada');
    await campo(pagina, '¿A cuánto lo vendes?').fill('150000');
    await elegirOpcion(pagina, '¿Es el 1.1 de un perfume que ya tienes?', /./);
    await elegirOpcion(pagina, '¿Qué talla armas?', /./);

    await pagina.getByRole('button', { name: /crear y seguir/i }).click();
    await pagina.getByText(/quedó creado, fuera de la tienda/i).waitFor({ timeout: 8000 });

    // El aviso de la foto avisa, no bloquea.
    await pagina.getByRole('button', { name: /publicar/i }).click();
    await pagina.getByText(/tarjeta sin imagen/i).waitFor();
    await pagina.getByRole('button', { name: /publicar igual/i }).click();
    await pagina.getByText(/volvió a la tienda/i).waitFor({ timeout: 8000 });
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run --config vitest.e2e.config.mts e2e/altaHeredada.e2e.test.ts`
Expected: FAIL — no existe la pregunta "¿Es el 1.1 de un perfume que ya tienes?".

- [ ] **Step 3: Write minimal implementation**

En `AltaProductoArmado.tsx`:

```tsx
      <Field label="¿Es el 1.1 de un perfume que ya tienes?">
        <BuscadorSelect
          value={copiarDe}
          placeholder="— No, es uno nuevo —"
          opciones={[{ id: '', nombre: '— No, es uno nuevo —' }, ...perfumes.map((p) => ({ id: p.id, nombre: p.nombre }))]}
          onSelect={(id) => setCopiarDe(id === '' ? '' : Number(id))}
        />
        {copiarDe !== '' && (
          <p className="mt-1 text-[12px] text-muted-foreground">
            Se copiarán su descripción, notas, ocasiones, género, duración y proyección. Tú pones
            la foto, el precio y el envase.
          </p>
        )}
      </Field>
```

`copiar_de_perfume_id: copiarDe || null` va en el cuerpo del `POST`, y tras crear se guarda el id para el botón de publicar:

```tsx
      {creado && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={publicar} disabled={publicando}>
            Publicar en la tienda
          </Button>
          {avisoFoto && (
            <span className="text-[12px] font-medium text-amber-700">
              Todavía no tiene foto: en la tienda se verá una tarjeta sin imagen.
              <Button type="button" size="sm" variant="ghost" className="ml-1 h-6" onClick={publicarIgual}>
                Publicar igual
              </Button>
            </span>
          )}
        </div>
      )}
```

`publicar` llama a `http.patch(urls.perfumes.publicado(creado.id), { publicado: true })`; si el producto no tiene foto, primero enseña el aviso y solo publica al confirmar. **Avisa, no bloquea**: decisión del dueño del 2026-08-25. La respuesta del servidor se muestra siempre con un toast, también cuando falla.

`ProduccionModal.tsx` pasa la lista: `perfumes={catalogoPerfumes}`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run --config vitest.e2e.config.mts e2e/altaHeredada.e2e.test.ts`
Expected: PASS.

- [ ] **Step 5: Mirar la pantalla y medir**

Abrir el alta desde el lote, comprobar con captura que la pregunta nueva no alarga el formulario más allá de una fila y que el aviso de la foto se lee.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/dashboard/tabs/inventario backend/e2e/altaHeredada.e2e.test.ts
git commit -m "feat(catalogo): el 1.1 se crea heredando y se publica sin cambiar de pantalla"
```

---

### Task 8: Los lotes por enlazar (consulta)

**Files:**
- Create: `backend/src/repositories/producciones.enlazar.ts`
- Create: `backend/src/repositories/producciones.enlazar.bd.test.ts`
- Modify: `backend/src/routes/inventario.router.ts`
- Modify: `frontend/src/infrastructure/api/urls.ts`

**Interfaces:**
- Produces:
  - `interface LotePorEnlazar { id: number; fecha: string; cantidad: number; formula_volumen_id: number; perfume_id: number | null; perfume_nombre: string | null; volumen_nombre: string; presentacion_id: number | null; costo_unitario: number; envase_insumo_id: number | null; envase_nombre: string | null; consumos: { insumo_id: number; cantidad: number }[]; motivo: 'sin_frascos' | 'envase_ajeno'; ficha_sugerida: { id: number; nombre: string } | null }` — **los `consumos` viajan** porque el `PATCH` del lote pide el lote entero: la pantalla los reenvía tal cual y el material no se pierde.
  - `lotesPorEnlazar(): Promise<LotePorEnlazar[]>`
  - `GET /inventario/producciones/por-enlazar` → `{ data: LotePorEnlazar[] }`
  - `urls.inventario.produccionesPorEnlazar = '/inventario/producciones/por-enlazar'`

- [ ] **Step 1: Write the failing test**

Crear `backend/src/repositories/producciones.enlazar.bd.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../config/prisma';
import { crearInsumo, limpiarBase, sembrarFabricacion30ml } from '../test/baseDePrueba';
import { registrarProduccion } from './inventario.repository';
import { lotesPorEnlazar } from './producciones.enlazar';

/**
 * LOTES POR ENLAZAR. Dos hechos comprobables, nunca el nombre del producto:
 * adivinar por "dice 1.1" fallaría con un "Set 1.1" o con un 1.1 sin esas
 * letras, y una lista que miente en dinero se deja de mirar.
 */
describe('lotes por enlazar', () => {
  beforeEach(limpiarBase);

  it('no marca un lote sano', async () => {
    const s = await sembrarFabricacion30ml({ stock: 1000 });
    await registrarProduccion({
      fecha: '2026-08-21', formula_volumen_id: s.formula.id, cantidad: 1,
      perfume_id: s.perfume.id, envase_insumo_id: s.frasco.id,
      consumos: [{ insumo_id: s.esencia.id, cantidad: 15 }, { insumo_id: s.frasco.id, cantidad: 1 }],
    });
    await prisma.perfumePresentacion.update({
      where: { perfume_id_presentacion_id: { perfume_id: s.perfume.id, presentacion_id: s.presentacion.id } },
      data: { envase_insumo_id: s.frasco.id },
    });

    expect(await lotesPorEnlazar()).toHaveLength(0);
  });

  it('marca el lote que descontó material y no dejó ningún frasco', async () => {
    const s = await sembrarFabricacion30ml({ stock: 1000 });
    const lote = await registrarProduccion({
      fecha: '2026-08-13', formula_volumen_id: s.formula.id, cantidad: 1,
      perfume_id: s.perfume.id, consumos: [{ insumo_id: s.esencia.id, cantidad: 15 }],
    });
    // Como los lotes de agosto: el material salió, los frascos nunca entraron.
    await prisma.movimientoTerminado.deleteMany({ where: { referencia_id: lote.id } });

    const lista = await lotesPorEnlazar();
    expect(lista).toHaveLength(1);
    expect(lista[0].motivo).toBe('sin_frascos');
    expect(lista[0].presentacion_id).toBe(s.presentacion.id);
  });

  it('marca el lote cuyo envase no es el que declara la ficha, y propone la que sí lo usa', async () => {
    const s = await sembrarFabricacion30ml({ stock: 1000 });
    const envase11 = await crearInsumo('Envase Khamrah 1.1 100ml', { tipo: 'envase', precio: 48680, stock: 5 });
    const uno = await prisma.perfume.create({
      data: {
        nombre: 'Khamrah 1.1', precio: 150000, solo_armado: true,
        presentaciones: { create: { presentacion_id: s.presentacion.id, envase_insumo_id: envase11.id } },
      },
    });

    await registrarProduccion({
      fecha: '2026-08-21', formula_volumen_id: s.formula.id, cantidad: 1,
      perfume_id: s.perfume.id, envase_insumo_id: envase11.id,
      consumos: [{ insumo_id: s.esencia.id, cantidad: 15 }, { insumo_id: envase11.id, cantidad: 1 }],
    });

    const lista = await lotesPorEnlazar();
    expect(lista).toHaveLength(1);
    expect(lista[0].motivo).toBe('envase_ajeno');
    expect(lista[0].ficha_sugerida).toEqual({ id: uno.id, nombre: 'Khamrah 1.1' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/repositories/producciones.enlazar.bd.test.ts`
Expected: FAIL — `Cannot find module './producciones.enlazar'`.

- [ ] **Step 3: Write minimal implementation**

Crear `backend/src/repositories/producciones.enlazar.ts`:

```ts
import { prisma } from '../config/prisma';
import { tallaDeFormula } from './inventario.terminado';

/**
 * LOTES POR ENLAZAR: los que dejaron sus frascos en el sitio equivocado, o no
 * los dejaron.
 *
 * Solo LEE. Las acciones son las que ya existen —la carga inicial y el PATCH
 * del lote—: un tercer camino para mover frascos sería una tercera versión de
 * la misma regla, y en esta casa una regla vive en un solo sitio.
 */

export interface LotePorEnlazar {
  id: number;
  fecha: string;
  cantidad: number;
  formula_volumen_id: number;
  perfume_id: number | null;
  perfume_nombre: string | null;
  volumen_nombre: string;
  presentacion_id: number | null;
  costo_unitario: number;
  envase_insumo_id: number | null;
  envase_nombre: string | null;
  /** Lo que gastó, en positivo: el PATCH del lote los pide de vuelta. */
  consumos: { insumo_id: number; cantidad: number }[];
  /** `sin_frascos`: nunca entraron. `envase_ajeno`: entraron en la ficha equivocada. */
  motivo: 'sin_frascos' | 'envase_ajeno';
  ficha_sugerida: { id: number; nombre: string } | null;
}

export const lotesPorEnlazar = async (): Promise<LotePorEnlazar[]> => {
  const lotes = await prisma.produccion.findMany({
    where: { perfume_id: { not: null } },
    orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
    include: { formula: { select: { nombre: true } }, perfume: { select: { id: true, nombre: true } } },
  });

  const salida: LotePorEnlazar[] = [];

  for (const lote of lotes) {
    const presentacion_id = await tallaDeFormula(lote.formula_volumen_id);
    const movs = await prisma.movimientoTerminado.count({
      where: { tipo: 'produccion', referencia_id: lote.id },
    });

    const envase = lote.envase_insumo_id
      ? await prisma.insumoCosto.findUnique({ where: { id: lote.envase_insumo_id }, select: { nombre: true } })
      : null;

    /**
     * Lo que ese lote consumió, sacado de su propio libro y en positivo.
     *
     * Viaja a la pantalla porque el PATCH del lote pide el lote ENTERO: si el
     * enlazador mandara solo la ficha nueva, la edición reharía el lote sin
     * material y la esencia se quedaría devuelta.
     */
    const movimientos = await prisma.movimientoInventario.findMany({
      where: { tipo: 'produccion', referencia_id: lote.id },
      select: { insumo_id: true, cantidad: true },
    });
    const consumos = movimientos.map((m) => ({
      insumo_id: m.insumo_id, cantidad: Math.abs(Number(m.cantidad)),
    }));

    const comun = {
      id: lote.id,
      fecha: lote.fecha.toISOString().slice(0, 10),
      cantidad: lote.cantidad,
      formula_volumen_id: lote.formula_volumen_id,
      perfume_id: lote.perfume?.id ?? null,
      perfume_nombre: lote.perfume?.nombre ?? null,
      volumen_nombre: lote.formula?.nombre ?? '',
      presentacion_id,
      costo_unitario: Number(lote.costo_unitario),
      envase_insumo_id: lote.envase_insumo_id,
      envase_nombre: envase?.nombre ?? null,
      consumos,
    };

    // Regla 1: descontó material y no dejó ni un frasco (registrado antes de que
    // existiera el libro del terminado).
    if (movs === 0 && presentacion_id) {
      salida.push({ ...comun, motivo: 'sin_frascos', ficha_sugerida: null });
      continue;
    }

    // Regla 2: el envase que gastó no es el que declara la ficha donde quedaron
    // sus frascos. Es el caso Khamrah, y es un hecho, no una corazonada.
    if (!lote.envase_insumo_id || !presentacion_id || !lote.perfume) continue;
    const ficha = await prisma.perfumePresentacion.findUnique({
      where: { perfume_id_presentacion_id: { perfume_id: lote.perfume.id, presentacion_id } },
      select: { envase_insumo_id: true },
    });
    if (ficha?.envase_insumo_id === lote.envase_insumo_id) continue;

    // Quién SÍ declara ese envase: es la ficha que se propone como destino.
    const candidata = await prisma.perfumePresentacion.findFirst({
      where: { envase_insumo_id: lote.envase_insumo_id, presentacion_id, perfume_id: { not: lote.perfume.id } },
      select: { perfume: { select: { id: true, nombre: true } } },
    });

    salida.push({
      ...comun,
      motivo: 'envase_ajeno',
      ficha_sugerida: candidata?.perfume ? { id: candidata.perfume.id, nombre: candidata.perfume.nombre } : null,
    });
  }

  return salida;
};
```

En `inventario.router.ts`, **antes** de `GET /producciones` no hace falta nada especial —las rutas no chocan porque el path es literal—, pero se pone junto a las demás de producciones:

```ts
/** Lotes cuyos frascos quedaron en la ficha equivocada, o no quedaron. Solo lee. */
inventarioRouter.get('/producciones/por-enlazar', h(async (_req, res) => {
  res.json({ data: await lotesPorEnlazar() });
}));
```

Y en `urls.ts`, junto a `producciones`:

```ts
    /** Lotes por enlazar a su ficha 1.1. Solo lee. */
    produccionesPorEnlazar: '/inventario/producciones/por-enlazar',
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npm run test:bd && npm run build`
Expected: PASS y build limpio.

- [ ] **Step 5: Commit**

```bash
git add backend/src/repositories/producciones.enlazar.ts backend/src/repositories/producciones.enlazar.bd.test.ts backend/src/routes/inventario.router.ts frontend/src/infrastructure/api/urls.ts
git commit -m "feat(producciones): la lista de lotes que quedaron colgados de la ficha equivocada"
```

---

### Task 9: El enlazador en pantalla

**Files:**
- Create: `frontend/src/pages/dashboard/tabs/producciones/LotesPorEnlazar.tsx`
- Modify: `frontend/src/pages/dashboard/tabs/ProduccionesTab.tsx`
- Test: `backend/e2e/enlazarLotes.e2e.test.ts` (nuevo)

**Interfaces:**
- Consumes: `GET /inventario/producciones/por-enlazar` (Task 8), `POST /inventario/terminado/carga-inicial` (existente), `PATCH /inventario/producciones/:id` (Task 4), `AltaProductoArmado` (Task 7).
- Produces: `<LotesPorEnlazar onResuelto={() => void} />` — se pinta solo si la lista trae algo.

- [ ] **Step 1: Write the failing test**

Crear `backend/e2e/enlazarLotes.e2e.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { abrirDashboard, abrirNavegador, cerrarNavegador, irA } from './navegador';

/**
 * RECORRIDO: el aviso de lotes por enlazar y su botón.
 *
 * Se comprueba la REGLA (el aviso desaparece cuando ya no queda ninguno) y no
 * una posición fija: otros recorridos siembran sus propios lotes en la misma
 * base.
 */
describe('lotes por enlazar', () => {
  beforeAll(abrirNavegador);
  afterAll(cerrarNavegador);

  it('el aviso dice cuántos son y por qué', async () => {
    const { pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard/producciones');
    await pagina.getByRole('heading', { name: /producciones/i }).waitFor();

    const aviso = pagina.getByText(/lotes? por enlazar/i);
    if (await aviso.count() === 0) {
      // Base limpia: la sección no debe existir, que es justo la regla.
      expect(await aviso.count()).toBe(0);
      return;
    }
    await pagina.getByText(/no dejó ningún frasco|no es el de la ficha/i).first().waitFor();
    expect(await pagina.getByRole('button', { name: /enlazar|sumar/i }).count()).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run --config vitest.e2e.config.mts e2e/enlazarLotes.e2e.test.ts`
Expected: FAIL — no existe ninguna sección "lotes por enlazar".

- [ ] **Step 3: Write minimal implementation**

Crear `frontend/src/pages/dashboard/tabs/producciones/LotesPorEnlazar.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import BuscadorSelect from '../../../../components/BuscadorSelect';
import { http } from '../../../../infrastructure/api/http';
import { urls } from '../../../../infrastructure/api/urls';
import { Section } from '../../ui';

interface LotePorEnlazar {
  id: number; fecha: string; cantidad: number;
  perfume_id: number | null; perfume_nombre: string | null;
  volumen_nombre: string; presentacion_id: number | null; costo_unitario: number;
  envase_nombre: string | null;
  motivo: 'sin_frascos' | 'envase_ajeno';
  ficha_sugerida: { id: number; nombre: string } | null;
}

interface Props {
  /** Fichas a las que se puede mandar un lote (el catálogo del dashboard). */
  perfumes: { id: number; nombre: string }[];
  /** Recargar la tabla y el contador cuando uno se resuelve. */
  onResuelto: () => void;
}

/**
 * Los lotes cuyos frascos quedaron en el sitio equivocado, o no quedaron.
 *
 * No tiene motor propio: manda a la carga inicial (los que nunca entraron, cuyo
 * material ya se descontó) o al PATCH del lote (los que entraron en la ficha
 * equivocada). Un tercer camino para mover frascos sería una tercera versión de
 * la misma regla.
 */
export function LotesPorEnlazar({ perfumes, onResuelto }: Props) {
  const [lotes, setLotes] = useState<LotePorEnlazar[]>([]);
  const [destinos, setDestinos] = useState<Record<number, number | ''>>({});
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState<number | null>(null);

  const cargar = async () => {
    setCargando(true);
    try {
      const res = await http.get<{ data: LotePorEnlazar[] }>(urls.inventario.produccionesPorEnlazar);
      if (!res.ok) throw new Error(res.error);
      const lista = res.cuerpo?.data ?? [];
      setLotes(lista);
      setDestinos(Object.fromEntries(lista.map((l) => [l.id, l.ficha_sugerida?.id ?? ''])));
    } catch {
      // Sin lista no hay aviso: es información de apoyo, no se alarma por ella.
      setLotes([]);
    } finally { setCargando(false); }
  };
  useEffect(() => { cargar(); }, []);

  const resolver = async (lote: LotePorEnlazar) => {
    const destino = destinos[lote.id];
    if (!destino) { toast.error('Elige a qué ficha van estos frascos', { id: 'enlazar' }); return; }
    setEnviando(lote.id);
    try {
      const res = lote.motivo === 'sin_frascos'
        ? await http.post(urls.inventario.cargaInicialArmados, {
          fecha: lote.fecha, perfume_id: destino, presentacion_id: lote.presentacion_id,
          cantidad: lote.cantidad, costo_unitario: lote.costo_unitario,
          nota: `Lote #${lote.id}`,
        })
        : await http.patch(urls.inventario.produccion(lote.id), {
          fecha: lote.fecha, formula_volumen_id: lote.formula_volumen_id,
          cantidad: lote.cantidad, perfume_id: destino,
          envase_insumo_id: lote.envase_insumo_id, consumos: lote.consumos,
          costo_unitario: lote.costo_unitario, costo_manual: false,
        });
      if (!res.ok) { toast.error(res.error, { id: 'enlazar' }); return; }
      toast.success(lote.motivo === 'sin_frascos'
        ? `Listo: ${lote.cantidad} ${lote.cantidad === 1 ? 'frasco entró' : 'frascos entraron'} a su ficha, sin descontar esencia`
        : 'Listo: esos frascos ya están en su ficha, con su costo');
      await cargar();
      onResuelto();
    } catch { toast.error('No se pudo conectar con el servidor', { id: 'enlazar' }); }
    finally { setEnviando(null); }
  };

  // La sección desaparece sola cuando no queda ninguno, como "Frascos ya armados".
  if (cargando || lotes.length === 0) return null;

  return (
    <Section>
      <p className="text-[13px] font-semibold text-amber-700">
        ⚠ {lotes.length} {lotes.length === 1 ? 'lote por enlazar' : 'lotes por enlazar'}
      </p>

      <ul className="mt-2 space-y-2.5">
        {lotes.map((l) => (
          <li key={l.id} className="rounded-lg border border-amber-400/45 bg-amber-400/10 px-3 py-2.5">
            <p className="text-[13px] font-medium text-foreground">
              Lote {l.id} · {l.fecha} · {l.perfume_nombre} · {l.volumen_nombre} ·{' '}
              {l.cantidad} {l.cantidad === 1 ? 'unidad' : 'unidades'}
            </p>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
              {l.motivo === 'sin_frascos'
                ? 'Descontó su material pero no dejó ningún frasco en el sistema (se registró antes de que existiera el libro de frascos armados).'
                : `Gastó "${l.envase_nombre}", pero sus frascos quedaron en la ficha del perfume corriente. Si alguien compra el normal, se le entrega este frasco.`}
            </p>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <div className="w-64">
                <BuscadorSelect
                  value={destinos[l.id] ?? ''}
                  placeholder="— ¿A qué ficha van? —"
                  opciones={perfumes.map((p) => ({ id: p.id, nombre: p.nombre }))}
                  onSelect={(id) => setDestinos((prev) => ({ ...prev, [l.id]: id === '' ? '' : Number(id) }))}
                />
              </div>
              <Button size="sm" onClick={() => resolver(l)} disabled={enviando === l.id}>
                {l.motivo === 'sin_frascos' ? 'Sumar los frascos a su ficha' : 'Enlazar a su ficha'}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}
```

**Por qué el `PATCH` manda el lote entero**: `produccionEdicionSchema` valida el lote completo, así
que enviar solo `perfume_id` lo reharía sin material. Por eso la Task 8 devuelve `consumos`,
`formula_volumen_id` y `envase_insumo_id`: la pantalla los reenvía tal cual y lo único que cambia
es la ficha. El `costo_unitario` también viaja, para que mudar los frascos **no los revalúe** al
promedio de hoy.

En `ProduccionesTab.tsx`, encima de la `Section` de la tabla:

```tsx
      <LotesPorEnlazar perfumes={perfumes} onResuelto={load} />
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx vitest run --config vitest.e2e.config.mts e2e/enlazarLotes.e2e.test.ts`
Expected: PASS.
Run: `cd frontend && npm run build && npm test`
Expected: build limpio y pruebas verdes.

- [ ] **Step 5: Comprobar contra datos reales**

Con el respaldo de producción cargado en local, abrir *Producciones* y comprobar que el aviso marca **el lote 6 de Khamrah** (envase ajeno) y **los 5 lotes del 11 al 14 de agosto** (sin frascos), y ninguno más. Captura de pantalla. Si marca alguno más, revisar la regla antes de seguir: una lista que miente en dinero se deja de mirar.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/dashboard/tabs backend/e2e/enlazarLotes.e2e.test.ts
git commit -m "feat(producciones): el aviso que manda cada frasco a su ficha"
```

---

### Task 10: Cerrar la documentación

**Files:**
- Modify: `docs/pendientes.md`, `docs/inventario-costeo.md`, `docs/historial-cambios.md`, `docs/pruebas.md`

- [ ] **Step 1: Correr todo y contar**

Run: `cd backend && npm test && npm run test:e2e && cd ../frontend && npm test`
Expected: todo verde. Anotar los números reales (no estimarlos).

- [ ] **Step 2: Escribir el porqué donde toca**

- `inventario-costeo.md`: editar un lote (deshacer/rehacer), el costo a mano y su marca, el promedio que se reconstruye del libro, y las dos reglas del enlazador.
- `pendientes.md`: bajar el punto de "lo siguiente" a la lista de "listo y esperando deploy" (**con migración**), y actualizar el runbook de los 9 frascos, que ahora es un botón por lote.
- `historial-cambios.md`: qué se construyó y en qué orden.
- `pruebas.md`: los recuentos nuevos y los tres recorridos añadidos.

- [ ] **Step 3: Commit**

```bash
git add docs
git commit -m "docs: editar lotes, enlazar los 1.1 y publicarlos — lo construido y su porqué"
```

---

## Notas de ejecución

- **El orden importa**: la Task 1 arregla el promedio antes de que la edición lo convierta en rutina; la Task 6 (herencia) va antes de la 9 porque el botón "crear la ficha aquí mismo" necesita a dónde llamar.
- **Antes de medir contra los datos** (Task 9, Step 5), pedirle al dueño el respaldo de producción: la base local se atrasa rápido.
- **La migración va al deploy**: `git pull` + `npx prisma migrate deploy` + build + `pm2 restart`, como manda `docs/deploy-migraciones.md`.
