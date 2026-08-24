# Ola 1 — Pestaña Productos en el dashboard

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separar en el dashboard lo que se fabrica al vender (Perfumes) de lo que existe antes de venderse (Productos: los 1.1, los comprados y los accesorios), sin tocar la tienda pública.

**Architecture:** Una sola regla en el servidor (`familia`) parte el mismo listado en dos vistas; el frontend estrena una pestaña que reutiliza la ficha de Perfumes en vez de copiarla. Como la pestaña nace con 0 filas en la base real del dueño, trae su lista de primeros pasos deducida de los datos.

**Tech Stack:** Express + TypeScript + Prisma 6 + MySQL (backend); React + Vite + Tailwind v4 + shadcn (frontend); Vitest.

**Spec:** `docs/superpowers/specs/2026-08-23-productos-y-accesorios-design.md`

## Global Constraints

- **Ningún archivo supera ~500 líneas.** `PerfumesTab.tsx` está en 468: la extracción de la Tarea 3 lo baja antes de que la Tarea 4 le sume nada.
- **NADA de `PUT`**: el CORS solo permite `GET/POST/PATCH/DELETE`.
- **Ningún handler de mutación ignora la respuesta.** Nada de `if (!res.ok) return;` mudo: siempre toast con el mensaje del servidor.
- **Ningún `<select>` de HTML**: `BuscadorSelect` para 6+ opciones, `SelectSimple` para 2-5 fijas.
- **Un componente nunca se declara dentro de otro.**
- **Toda vista que cargue datos usa try/catch/finally.**
- **Nunca `res.json({ error: err.message })`**: usar `mensajeSeguro(err)`.
- **TODOS los .ts/.tsx son UTF-8 sin BOM.**
- **Toasts con sonner**, nunca `richColors`.
- **Sin migración.** `solo_armado`, `es_accesorio`, `tipo_producto` y `publicado` ya existen.
- **La tienda pública NO se toca en esta ola.** Cualquier cambio en `/perfumes` público es de la Ola 3.
- **Nada de `any`.** El backend está en cero y así se queda.
- Comandos: `cd backend && npm run test:bd` · `cd backend && npm run test:unidad` · `cd frontend && npm test` · `cd frontend && npm run build`

---

### Task 1: El filtro de familia en el servidor

**Files:**
- Modify: `backend/src/repositories/perfume.repository.ts` (junto a `SOLO_PUBLICADOS`, línea ~46, y en `selectParfumsPaginated`, línea ~106)
- Modify: `backend/src/controller/perfume.controller.ts:43-58`
- Test: `backend/src/repositories/perfume.familia.bd.test.ts` (crear)

**Interfaces:**
- Consumes: `prisma`, `limpiarBase`, `crearInsumo` de `../test/baseDePrueba`
- Produces:
  - `export type FamiliaProducto = 'fabricadas' | 'productos'`
  - `export const esFamilia = (v: string): v is FamiliaProducto`
  - `export const WHERE_FAMILIA: Record<FamiliaProducto, Prisma.PerfumeWhereInput>`
  - `selectParfumsPaginated(page, limit, search?, filtros?, todos?, columnasAnd?, familia?: FamiliaProducto)`

- [ ] **Step 1: Write the failing test**

Crear `backend/src/repositories/perfume.familia.bd.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../config/prisma';
import { limpiarBase } from '../test/baseDePrueba';
import { selectParfumsPaginated } from './perfume.repository';

/**
 * DOS VISTAS DE LA MISMA TABLA.
 *
 * El dashboard parte el catálogo por una regla que el sistema evalúa solo:
 * ¿existe antes de venderse (Productos) o se fabrica al venderlo (Perfumes)?
 * Si la regla se rompe, un 1.1 se esconde de las dos listas y desaparece sin
 * que nadie se entere. Ver docs/superpowers/specs/2026-08-23-productos-y-accesorios-design.md
 */

const nombres = async (familia?: 'fabricadas' | 'productos') => {
  const r = await selectParfumsPaginated(1, 50, undefined, undefined, true, undefined, familia);
  return r.data.map((p) => p.nombre).sort();
};

describe('familia de producto', () => {
  beforeEach(async () => {
    await limpiarBase();
    await prisma.perfume.createMany({
      data: [
        { nombre: 'Fabricado normal', precio: 60000, tipo_producto: 'fabricado', solo_armado: false },
        { nombre: 'Armado 1.1', precio: 120000, tipo_producto: 'fabricado', solo_armado: true },
        { nombre: 'Splash comprado', precio: 45000, tipo_producto: 'comprado', solo_armado: false },
        { nombre: 'Perfumero', precio: 5000, tipo_producto: 'comprado', es_accesorio: true },
      ],
    });
  });

  it('Perfumes solo trae lo que se fabrica al vender', async () => {
    expect(await nombres('fabricadas')).toEqual(['Fabricado normal']);
  });

  it('Productos trae los 1.1, los comprados y los accesorios', async () => {
    expect(await nombres('productos')).toEqual(['Armado 1.1', 'Perfumero', 'Splash comprado']);
  });

  it('sin familia no se filtra nada: la venta y la tienda siguen viéndolo todo', async () => {
    expect(await nombres()).toHaveLength(4);
  });

  it('las dos familias juntas son el catálogo entero: nada se pierde por el camino', async () => {
    const partes = [...(await nombres('fabricadas')), ...(await nombres('productos'))].sort();
    expect(partes).toEqual(await nombres());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/repositories/perfume.familia.bd.test.ts`
Expected: FAIL — `selectParfumsPaginated` no acepta el 7º parámetro, las cuatro devuelven lo mismo.

- [ ] **Step 3: Write minimal implementation**

En `backend/src/repositories/perfume.repository.ts`, debajo de `SOLO_PUBLICADOS` (~línea 46):

```ts
/**
 * LAS DOS FAMILIAS DEL DASHBOARD.
 *
 * Una sola pregunta decide de qué lado cae cada ficha: ¿existe ANTES de que lo
 * vendas, o se fabrica en el momento de venderlo? Es una regla que el sistema
 * evalúa solo, no una lista que el dueño mantenga a mano — el día que se marque
 * un producto mal, la lista no avisa; la regla sí.
 *
 * Ojo: el 212 VIP Black con frascos armados NO es "productos". Es un fabricado
 * que casualmente tiene stock, y se queda en Perfumes. Se descartó a propósito
 * el criterio "lo que tenga unidades hoy": un producto que entra y sale de una
 * pantalla según el stock es de lo que más confunde con el tiempo.
 */
export type FamiliaProducto = 'fabricadas' | 'productos';

export const WHERE_FAMILIA: Record<FamiliaProducto, Prisma.PerfumeWhereInput> = {
  fabricadas: { tipo_producto: 'fabricado', solo_armado: false },
  productos: { OR: [{ solo_armado: true }, { tipo_producto: 'comprado' }] },
};

export const esFamilia = (v: string): v is FamiliaProducto =>
  Object.prototype.hasOwnProperty.call(WHERE_FAMILIA, v);
```

En la firma de `selectParfumsPaginated` (~línea 106), agregar el parámetro al final:

```ts
  /** Solo el dashboard: parte el catálogo en Perfumes / Productos. */
  familia?: FamiliaProducto,
) => {
```

Y dentro, justo después del bloque de `columnasAnd`:

```ts
  if (familia) and.push(WHERE_FAMILIA[familia]);
```

En `backend/src/controller/perfume.controller.ts`, importar `esFamilia` junto a `esOrdenCatalogo` y pasar el parámetro en la llamada de `selectAllPerfumes`:

```ts
      const familiaRaw = typeof req.query.familia === 'string' ? req.query.familia : '';
      const result = await perfumeService.allPerfumesPaginated(page, limit, parseSearch(req.query), {
        // ...lo que ya estaba, sin tocar
      }, req.query.todos === '1' && esAdminRequest(req), parseFiltros(req.query, mapaFiltrosPerfumes),
        esFamilia(familiaRaw) ? familiaRaw : undefined);
```

Propagar el parámetro en `perfumeService.allPerfumesPaginated` (mismo orden, mismo tipo) hasta el repositorio.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run src/repositories/perfume.familia.bd.test.ts`
Expected: PASS, 4 pruebas.

- [ ] **Step 5: Run the whole backend suite (no regresión)**

Run: `cd backend && npm test`
Expected: PASS. El parámetro es opcional, así que la tienda y el buscador de la venta no cambian.

- [ ] **Step 6: Commit**

```bash
git add backend/src/repositories/perfume.repository.ts backend/src/controller/perfume.controller.ts backend/src/services backend/src/repositories/perfume.familia.bd.test.ts
git commit -m "feat(catalogo): el servidor sabe partir el catálogo en Perfumes y Productos"
```

---

### Task 2: Los contadores de los primeros pasos

**Files:**
- Modify: `backend/src/repositories/perfume.repository.ts` (añadir al final)
- Modify: `backend/src/routes/perfume.router.ts` (ruta nueva, junto a las demás de admin)
- Modify: `frontend/src/infrastructure/api/urls.ts:80-105` (bloque `perfumes`)
- Test: `backend/src/repositories/productos.primerosPasos.bd.test.ts` (crear)

**Interfaces:**
- Consumes: `WHERE_FAMILIA` de la Tarea 1
- Produces: `export const primerosPasosProductos = (): Promise<PrimerosPasosProductos>` con
  ```ts
  interface PrimerosPasosProductos {
    accesorios_sin_ficha: number;
    lotes_sin_ficha_propia: number;
    productos: number;
    productos_publicados: number;
    con_ficha_accesorio: number;
    con_ficha_armado: number;
  }
  ```
- URL: `GET /parfums/primeros-pasos` → `{ data: PrimerosPasosProductos }`

- [ ] **Step 1: Write the failing test**

Crear `backend/src/repositories/productos.primerosPasos.bd.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../config/prisma';
import { crearInsumo, limpiarBase } from '../test/baseDePrueba';
import { primerosPasosProductos } from './perfume.repository';

/**
 * EL PROGRESO SE DEDUCE DE LOS DATOS, NUNCA DE UNA BANDERA.
 *
 * Una bandera "ya lo configuró" miente el día que se importe por Excel o se
 * borre un registro. Aquí cada paso se cuenta contra la base, así que quien ya
 * trabajó nunca ve la lista. Ver la skill `arranque-guiado`.
 */

describe('primeros pasos de Productos', () => {
  beforeEach(limpiarBase);

  it('base sin nada: los tres pasos están pendientes', async () => {
    const p = await primerosPasosProductos();
    expect(p.con_ficha_accesorio).toBe(0);
    expect(p.con_ficha_armado).toBe(0);
    expect(p.productos_publicados).toBe(0);
  });

  it('cuenta los accesorios del inventario que todavía no tienen ficha', async () => {
    await crearInsumo('Perfumero Recargable', { tipo: 'accesorio', precio: 2100, stock: 20 });
    await crearInsumo('Bolsa Organza', { tipo: 'accesorio', precio: 300, stock: 50 });
    expect((await primerosPasosProductos()).accesorios_sin_ficha).toBe(2);
  });

  it('un accesorio deja de contarse en cuanto tiene su ficha', async () => {
    const insumo = await crearInsumo('Perfumero Recargable', { tipo: 'accesorio', precio: 2100, stock: 20 });
    await prisma.perfume.create({
      data: {
        nombre: 'Perfumero Recargable', precio: 5000, publicado: false,
        tipo_producto: 'comprado', es_accesorio: true, insumo_producto_id: insumo.id,
      },
    });
    const p = await primerosPasosProductos();
    expect(p.accesorios_sin_ficha).toBe(0);
    expect(p.con_ficha_accesorio).toBe(1);
  });

  it('un producto sin publicar no marca el paso de la tienda', async () => {
    await prisma.perfume.create({
      data: { nombre: 'Bon Bon 1.1', precio: 150000, solo_armado: true, publicado: false },
    });
    const p = await primerosPasosProductos();
    expect(p.con_ficha_armado).toBe(1);
    expect(p.productos).toBe(1);
    expect(p.productos_publicados).toBe(0);
  });

  it('los perfumes normales publicados NO cuentan como productos publicados', async () => {
    await prisma.perfume.create({
      data: { nombre: 'Khamrah', precio: 95000, tipo_producto: 'fabricado', publicado: true },
    });
    expect((await primerosPasosProductos()).productos_publicados).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/repositories/productos.primerosPasos.bd.test.ts`
Expected: FAIL con "primerosPasosProductos is not a function".

- [ ] **Step 3: Write minimal implementation**

Al final de `backend/src/repositories/perfume.repository.ts`:

```ts
/**
 * Los contadores del arranque de la pestaña Productos.
 *
 * Todo se CUENTA contra la base, nada se guarda: quien ya tiene sus productos
 * cargados no ve la lista nunca, y el día que borre uno la lista reaparece
 * sola diciendo la verdad.
 */
export const primerosPasosProductos = async () => {
  const [insumosAccesorio, conFichaAccesorio, conFichaArmado, productos, publicados, lotes] =
    await Promise.all([
      prisma.insumoCosto.findMany({ where: { tipo: 'accesorio' }, select: { id: true } }),
      prisma.perfume.count({ where: { es_accesorio: true } }),
      prisma.perfume.count({ where: { solo_armado: true } }),
      prisma.perfume.count({ where: WHERE_FAMILIA.productos }),
      prisma.perfume.count({ where: { AND: [WHERE_FAMILIA.productos, SOLO_PUBLICADOS] } }),
      prisma.produccion.count(),
    ]);

  const enlazados = await prisma.perfume.findMany({
    where: { insumo_producto_id: { in: insumosAccesorio.map((i) => i.id) } },
    select: { insumo_producto_id: true },
  });
  const yaTienen = new Set(enlazados.map((p) => p.insumo_producto_id));

  return {
    accesorios_sin_ficha: insumosAccesorio.filter((i) => !yaTienen.has(i.id)).length,
    lotes_sin_ficha_propia: conFichaArmado === 0 ? lotes : 0,
    productos,
    productos_publicados: publicados,
    con_ficha_accesorio: conFichaAccesorio,
    con_ficha_armado: conFichaArmado,
  };
};
```

En `backend/src/controller/perfume.controller.ts`, una función más, con el manejo de error
del resto del archivo (**`mensajeSeguro`, nunca `err.message`**):

```ts
export const getPrimerosPasosProductos = async (_req: Request, res: Response) => {
  try {
    res.json({ data: await perfumeService.primerosPasosProductos() });
  } catch (error) {
    res.status(400).json({ error: mensajeSeguro(error) });
  }
};
```

En `backend/src/routes/perfume.router.ts`, con las demás rutas de admin (el guard se llama
`requireAdmin`, ya importado en la línea 40):

```ts
perfumeRouter.get('/primeros-pasos', requireAdmin, getPrimerosPasosProductos);
```

> Ponerla **ANTES** de cualquier `/:id` del mismo router, o Express la tomará por
> un id y devolverá 404. Las rutas fijas como `/esencia/sugerencias` ya están
> arriba por esa misma razón: seguir ese orden.

En `frontend/src/infrastructure/api/urls.ts`, dentro del bloque `perfumes`:

```ts
    /** Contadores del arranque de la pestaña Productos. Solo admin. */
    primerosPasosProductos: '/parfums/primeros-pasos',
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run src/repositories/productos.primerosPasos.bd.test.ts`
Expected: PASS, 5 pruebas.

- [ ] **Step 5: Commit**

```bash
git add backend/src/repositories/perfume.repository.ts backend/src/routes/perfume.router.ts backend/src/repositories/productos.primerosPasos.bd.test.ts frontend/src/infrastructure/api/urls.ts
git commit -m "feat(productos): los contadores del arranque salen de los datos, no de una bandera"
```

---

### Task 3: Sacar la ficha de Perfumes a una pieza compartida

Esta tarea **no cambia nada visible**. Es la que evita que la Tarea 4 sea un copiar y pegar de 468 líneas.

**Files:**
- Create: `frontend/src/pages/dashboard/tabs/perfumes/useFichaPerfume.ts`
- Create: `frontend/src/pages/dashboard/tabs/perfumes/FichaPerfumeModal.tsx`
- Modify: `frontend/src/pages/dashboard/tabs/PerfumesTab.tsx` (queda solo con barra + tabla)

**Interfaces:**
- Produces:
  ```ts
  // useFichaPerfume.ts
  interface UsarFichaArgs {
    aromas: Lookup[]; ocasiones: Lookup[]; categorias: Lookup[]; presentaciones: Lookup[];
    onMutate: () => void;
  }
  interface FichaPerfume {
    modal: { open: boolean; editId: number | null };
    form: PerfumeForm;
    setForm: React.Dispatch<React.SetStateAction<PerfumeForm>>;
    formError: string; formLoading: boolean;
    esencias: Insumo[]; insumosProducto: Insumo[]; envases: Insumo[];
    imgMode: 'url' | 'file'; setImgMode: (m: 'url' | 'file') => void;
    uploading: boolean;
    precioDeLista: (presentacionId: number) => number | null;
    abrirNuevo: () => void;
    abrirEdicion: (p: Perfume) => void;
    cerrar: () => void;
    guardar: (e: { preventDefault(): void }) => Promise<void>;
    eliminar: (id: number) => Promise<void>;
    subirImagen: (e: { target: { files: FileList | null } }) => Promise<void>;
  }
  export function useFichaPerfume(args: UsarFichaArgs): FichaPerfume
  ```
  ```ts
  // FichaPerfumeModal.tsx
  interface FichaPerfumeModalProps {
    ficha: FichaPerfume;
    aromas: Lookup[]; ocasiones: Lookup[]; categorias: Lookup[]; presentaciones: Lookup[];
    /** Texto del título y del botón: "perfume" en Perfumes, "producto" en Productos. */
    sustantivo: 'perfume' | 'producto';
  }
  export function FichaPerfumeModal(props: FichaPerfumeModalProps): JSX.Element
  ```

- [ ] **Step 1: Anotar el estado ANTES de mover nada**

```bash
cd frontend && npx eslint src --max-warnings=-1 2>&1 | tail -3 && wc -l src/pages/dashboard/tabs/PerfumesTab.tsx
```

Apuntar los dos números. Al final de la tarea el linter debe estar igual o mejor, y `PerfumesTab.tsx` claramente por debajo de 468.

- [ ] **Step 2: Mover el estado y los handlers al hook**

Crear `useFichaPerfume.ts` moviendo **tal cual**, sin reescribir la lógica: los `useState` (`modal`, `form`, `formLoading`, `esencias`, `insumosProducto`, `envases`, `formError`, `imgMode`, `uploading`, `precios`), los dos `useEffect` de carga, `precioDeLista`, `openCreate` → `abrirNuevo`, `openEdit` → `abrirEdicion`, `closeModal` → `cerrar`, `handleSubmit` → `guardar`, `handleDelete` → `eliminar`, `handleFileUpload` → `subirImagen`.

Conservar los comentarios que explican el porqué (el de `esEsencia`, el de "solo viajan los precios propios", el de `solo_armado`/`es_accesorio`). Son la memoria del proyecto.

`eliminar` mantiene su toast: la respuesta nunca se ignora.

- [ ] **Step 3: Mover el JSX del modal al componente**

Crear `FichaPerfumeModal.tsx` con el `<Modal>` entero de `PerfumesTab.tsx` (líneas ~241 al cierre). El título y el botón salen de `sustantivo`:

```tsx
title={ficha.modal.editId ? `Editar ${sustantivo}` : `Nuevo ${sustantivo}`}
submitLabel={ficha.formLoading ? 'Guardando...' : ficha.modal.editId ? 'Guardar cambios' : `Crear ${sustantivo}`}
```

**No declarar ningún componente dentro de otro.** Si el modal necesita piezas auxiliares, van a su propio archivo o al nivel superior del módulo.

- [ ] **Step 4: Dejar PerfumesTab usando las dos piezas**

`PerfumesTab.tsx` queda con la barra, la `SmartTable`, el `ImportModal` y:

```tsx
const ficha = useFichaPerfume({ aromas, ocasiones, categorias, presentaciones, onMutate });
// ...
<Button size="sm" onClick={ficha.abrirNuevo}>+ Nuevo perfume</Button>
// ...
<FichaPerfumeModal ficha={ficha} aromas={aromas} ocasiones={ocasiones}
  categorias={categorias} presentaciones={presentaciones} sustantivo="perfume" />
```

Los textos visibles de Perfumes **no cambian**: sigue diciendo "Perfumes", "+ Nuevo perfume", "Editar perfume".

- [ ] **Step 5: Compilar y comprobar que no ensuciamos**

```bash
cd frontend && npm run build && npx eslint src --max-warnings=-1 2>&1 | tail -3 && wc -l src/pages/dashboard/tabs/PerfumesTab.tsx src/pages/dashboard/tabs/perfumes/useFichaPerfume.ts src/pages/dashboard/tabs/perfumes/FichaPerfumeModal.tsx
```

Expected: build OK, avisos del linter iguales o menos que en el Step 1, y **ningún archivo por encima de 500 líneas**.

- [ ] **Step 6: Comprobar en el navegador que Perfumes se ve IGUAL**

Abrir `/dashboard/perfumes`, cerrar el popup de anuncios con "Entendido", y verificar a mano:
crear un perfume, editarlo, subirle una imagen, cambiarle las tallas y borrarlo. Capturar la pantalla en escritorio y en celular.

Es un refactor: si algo se ve distinto, está mal.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/dashboard/tabs/PerfumesTab.tsx frontend/src/pages/dashboard/tabs/perfumes/useFichaPerfume.ts frontend/src/pages/dashboard/tabs/perfumes/FichaPerfumeModal.tsx
git commit -m "refactor(perfumes): la ficha sale de la pestaña para que Productos la reutilice"
```

---

### Task 4: La pestaña Productos

**Files:**
- Modify: `frontend/src/pages/dashboard/types/index.ts:20` (añadir `'productos'` al tipo `Tab`)
- Modify: `frontend/src/pages/dashboard/navegacion.ts:19` y `:54`
- Modify: `frontend/src/pages/dashboard/columns.tsx` (añadir `productosColumns` después de `perfumesColumns`, línea ~289)
- Create: `frontend/src/pages/dashboard/tabs/ProductosTab.tsx`
- Modify: `frontend/src/pages/dashboard/DashboardPage.tsx` (estado, carga y render)

**Interfaces:**
- Consumes: `useFichaPerfume`, `FichaPerfumeModal` (Tarea 3); el parámetro `familia` (Tarea 1)
- Produces: `export const productosColumns: ColumnDef<Perfume>[]`, `export function ProductosTab(props: ProductosTabProps)` con las mismas props que `PerfumesTab`

- [ ] **Step 1: Añadir la pestaña al mapa del dashboard**

En `types/index.ts`, añadir `| 'productos'` al tipo `Tab`.

En `navegacion.ts`, importar `PackageCheck` de `lucide-react`, y:

```ts
  productos: { label: 'Productos', icon: PackageCheck },
```

```ts
  { id: 'catalogo', label: 'Catálogo', tabs: ['perfumes', 'productos', 'combos', 'precios', 'descuentos'] },
```

Va **justo después de `perfumes`**: son las dos caras de lo mismo y se buscan juntas.

- [ ] **Step 2: Las columnas propias**

En `columns.tsx`, después de `perfumesColumns`:

```tsx
/**
 * PRODUCTOS: lo que existe antes de venderse.
 *
 * Sin aromas ni duración: un accesorio no los tiene y un 1.1 los hereda de su
 * fragancia. A cambio entran las dos que aquí sí se miran a diario — de qué
 * clase es y cuántas unidades quedan.
 */
export const productosColumns: ColumnDef<Perfume>[] = [
  columnaImagen<Perfume>(p => p.imagen_url, p => p.nombre),
  { key: 'nombre', header: 'Nombre', type: 'string', getValue: p => p.nombre, className: cellName },
  // El TIPO se deduce, no se guarda. El orden importa: un accesorio SIEMPRE es
  // comprado, así que preguntar por `es_accesorio` primero es lo que evita que
  // se pierda lo único que lo distingue.
  { key: 'tipo', header: 'Tipo', type: 'string',
    getValue: p => (p.solo_armado ? '1.1' : p.es_accesorio ? 'Accesorio' : 'Comprado'),
    className: cellMeta, noTruncate: true, filterable: false },
  { key: 'precio', header: 'Precio', type: 'currency', getValue: p => p.precio,
    render: p => formatPrice(p.precio), className: cellPrice, noTruncate: true },
  { key: 'categoria', header: 'Categoria', type: 'string', getValue: p => p.categoria ?? '',
    render: p => p.categoria ?? '—', className: cellMeta, noTruncate: true },
  { key: 'estado', header: 'Estado', type: 'string',
    getValue: p => [
      p.publicado ? '' : 'Fuera de la tienda',
      p.agotado_manual ? 'Agotado' : '',
      faltaParaVender(p)?.etiqueta ?? '',
    ].filter(Boolean).join(', ') || 'En la tienda',
    render: p => <EstadoPerfume perfume={p} />,
    noTruncate: true, filterable: false },
];
```

> **STOCK queda FUERA de esta ola.** El listado de perfumes no trae hoy las
> unidades armadas ni el stock del insumo enlazado, y traerlas es una consulta
> más en el camino caliente del catálogo. Entra en la Ola 2, junto con
> Producciones, que es donde se mide de verdad. Ponerlo aquí a medias sería un
> número que miente.

- [ ] **Step 3: La pestaña**

Crear `ProductosTab.tsx`. Las props son las mismas que `PerfumesTab` menos las que no aplican
(no hay import de Excel aquí):

```tsx
export function ProductosTab({
  productos, page, total, pageSize, aromas, ocasiones, categorias, presentaciones,
  onPageChange, onPageSizeChange, onSearch, onFilter, onClearAll, onMutate,
}: ProductosTabProps) {
  const ficha = useFichaPerfume({ aromas, ocasiones, categorias, presentaciones, onMutate });

  return (
    <>
      <Section>
        <Toolbar>
          <SectionTitle count={productos.length}>Productos</SectionTitle>
          <ToolbarActions>
            <ExportButton entity="perfumes" />
            <Button size="sm" onClick={ficha.abrirNuevo}>+ Nuevo producto</Button>
          </ToolbarActions>
        </Toolbar>

        <SmartTable
          columns={productosColumns}
          rows={productos}
          rowKey={p => p.id}
          onServerSearch={onSearch}
          onServerFilter={onFilter}
          onServerClearAll={onClearAll}
          pagination={{ page, totalRows: total, pageSize, onPageChange, onPageSizeChange }}
          emptyText="Todavía no tienes productos. Aquí van los 1.1 que armas, los splash que compras hechos y los accesorios."
          renderActions={p => (
            <AccionesPerfume
              perfume={p}
              onCambiado={onMutate}
              onEditar={() => ficha.abrirEdicion(p)}
              onEliminar={() => ficha.eliminar(p.id)}
            />
          )}
        />
      </Section>

      <FichaPerfumeModal ficha={ficha} aromas={aromas} ocasiones={ocasiones}
        categorias={categorias} presentaciones={presentaciones} sustantivo="producto" />
    </>
  );
}
```

**Sin `ImportModal` ni `DescargarCatalogoButton`**: el importador de Excel es de fragancias y el PDF del catálogo también. Ofrecerlos aquí sería prometer algo que no hace lo que parece.

- [ ] **Step 4: Cablearla en DashboardPage**

Copiar el patrón exacto de `perfumes`: estado (`productos`, `productosPage`, `productosTotal`, `productosPageSize`, `productosSearch`, `productosFiltros`), un `loadProductos` idéntico a `loadPerfumes` pero con `familia: 'productos'` en los `params`, la recarga en el `useEffect` de cambio de pestaña (`if (tab === 'productos') loadProductos(1);`), y el bloque de render.

`refreshAll` pasa a recargar también los productos, o crear un 1.1 no se ve hasta cambiar de pestaña.

- [ ] **Step 5: Perfumes pide su familia**

En `loadPerfumes`, añadir `familia: 'fabricadas'` a los `params`. Es el cambio que saca los 1.1, los comprados y los accesorios de la lista de Perfumes.

- [ ] **Step 6: Compilar y mirar**

```bash
cd frontend && npm run build
```

Después, en el navegador (popup cerrado con "Entendido"):
- Perfumes ya **no** muestra los 1.1 ni los accesorios, y el contador bajó.
- Productos los muestra, con su columna Tipo bien deducida.
- Crear un producto desde Productos aparece en Productos, no en Perfumes.
- La paginación, el buscador y los filtros de columna funcionan en la pestaña nueva.

Capturar las dos pestañas en escritorio y celular.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/dashboard/types/index.ts frontend/src/pages/dashboard/navegacion.ts frontend/src/pages/dashboard/columns.tsx frontend/src/pages/dashboard/tabs/ProductosTab.tsx frontend/src/pages/dashboard/DashboardPage.tsx
git commit -m "feat(catalogo): Productos tiene su pestaña y Perfumes vuelve a ser solo fragancias"
```

---

### Task 5: Los primeros pasos de la pestaña vacía

**Files:**
- Create: `frontend/src/pages/dashboard/tabs/productos/PrimerosPasosProductos.tsx`
- Modify: `frontend/src/pages/dashboard/tabs/ProductosTab.tsx` (pintarlo encima de la tabla)

**Interfaces:**
- Consumes: `urls.perfumes.primerosPasosProductos` (Tarea 2), `ficha.abrirNuevo` (Tarea 3)
- Produces: `export function PrimerosPasosProductos(props: { onNuevoProducto: () => void; recargar?: number })`

- [ ] **Step 1: Copiar el patrón que ya existe**

Tomar `frontend/src/pages/dashboard/tabs/inventario/PrimerosPasos.tsx` como plantilla exacta: misma caja, mismo "N de 3", mismo colapsable, misma regla de desaparecer sola. **No inventar un diseño nuevo**: el dueño ya conoce esta caja del inventario.

- [ ] **Step 2: Los tres pasos**

El tipo que devuelve el endpoint de la Tarea 2, declarado en este mismo archivo:

```ts
interface Progreso {
  accesorios_sin_ficha: number;
  lotes_sin_ficha_propia: number;
  productos: number;
  productos_publicados: number;
  con_ficha_accesorio: number;
  con_ficha_armado: number;
}
```

```tsx
const pasos: Paso[] = [
  {
    n: 1,
    titulo: 'Pon a la venta un accesorio que ya tienes',
    hecho: p.con_ficha_accesorio > 0,
    detalle: p.accesorios_sin_ficha > 0
      ? `Tienes ${p.accesorios_sin_ficha} en tu inventario sin ficha: hasta que la tengan, venderlos no descuenta nada y su costo entra en cero.`
      : 'El perfumero, la bolsa, la tarjeta. Se dan de alta desde el material, en Inventario.',
    accion: <Button size="sm" variant="outline" asChild><Link to="/dashboard/inventario">Empezar</Link></Button>,
  },
  {
    n: 2,
    titulo: 'Dale su ficha a un 1.1 que ya armaste',
    hecho: p.con_ficha_armado > 0,
    detalle: p.lotes_sin_ficha_propia > 0
      ? `Tienes ${p.lotes_sin_ficha_propia} lotes armados apuntando al perfume normal. Vender uno cobraría el precio del corriente.`
      : 'Un 1.1 es un perfume con envase premium: lleva su propia ficha y su propio precio.',
    accion: <Button size="sm" variant="outline" onClick={onNuevoProducto}>Empezar</Button>,
  },
  {
    n: 3,
    titulo: 'Muéstralos en tu tienda',
    hecho: p.productos_publicados > 0,
    detalle: p.productos > 0
      ? `${p.productos_publicados} de ${p.productos} se ven en la tienda. Los demás solo se pueden vender por aquí.`
      : 'Nacen apagados a propósito: nadie ve una ficha a medio llenar.',
    accion: <Button size="sm" variant="outline" onClick={onNuevoProducto}>Empezar</Button>,
  },
];
```

Reglas que se respetan tal cual, y que **no** hay que "mejorar":
- **Ningún paso bloquea nada.** No hay candados: aquí no existe un orden que corrompa datos si se invierte.
- **El progreso se deduce de los datos.** Nada de banderas.
- **La caja desaparece sola** cuando los tres están hechos (`if (listos === pasos.length) return null`).
- **La carga es silenciosa**: si el endpoint falla, la pestaña sigue sirviendo y no se alarma a nadie.

- [ ] **Step 3: Pintarlo en la pestaña**

En `ProductosTab.tsx`, encima de la `<Section>` de la tabla:

```tsx
<PrimerosPasosProductos onNuevoProducto={ficha.abrirNuevo} recargar={recargarPasos} />
```

Subir `recargarPasos` un número cada vez que se guarde o borre algo, para que los contadores se refresquen sin recargar la página.

- [ ] **Step 4: Comprobar los cuatro casos que pide la skill**

Los dos últimos son los que fallan siempre — probarlos primero:

1. **Base sin productos** → la caja aparece y el paso 1 es obvio.
2. **Base ya trabajada** (crear un accesorio, un 1.1 y publicar uno) → la caja **no** aparece.
3. **Completar un paso por fuera**: crear la ficha del accesorio desde Inventario, sin tocar la caja → el paso 1 se marca solo al volver.
4. **Borrar el único producto publicado** → el paso 3 vuelve a aparecer pendiente.

- [ ] **Step 5: Compilar, mirar y capturar**

```bash
cd frontend && npm run build
```

Capturar la pestaña Productos vacía (con la caja) y llena (sin la caja), en escritorio y celular.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/dashboard/tabs/productos/PrimerosPasosProductos.tsx frontend/src/pages/dashboard/tabs/ProductosTab.tsx
git commit -m "feat(productos): la pestaña vacía enseña qué hacer en vez de mostrar una tabla en blanco"
```

---

### Task 6: Verificación final y documentación

**Files:**
- Modify: `docs/arquitectura.md` (sección del dashboard)
- Modify: `docs/pendientes.md` (bajar la Ola 1 a hecho, dejar Olas 2 y 3)

- [ ] **Step 1: Toda la suite**

```bash
cd backend && npm test && cd ../frontend && npm test && npm run build
```

Expected: todo en verde. Anotar el número de pruebas: eran **276** antes de esta ola.

- [ ] **Step 2: No regresión donde no tocamos**

Abrir **Ventas → Registrar venta** y comprobar que el buscador sigue viendo TODO el catálogo (fragancias, 1.1 y accesorios). Es lo que más fácil se rompe: si `familia` se colara en `todosConOcultos`, el dueño volvería al problema del principio.

Abrir también la tienda pública `/perfumes` y confirmar que no cambió nada — esta ola no la toca.

- [ ] **Step 3: Medir contra los datos reales del dueño**

Con MySQL de XAMPP encendido y la base `perfumes_db`:

```bash
"/c/xampp/mysql/bin/mysql.exe" -u root --default-character-set=utf8mb4 -D perfumes_db -e "
SELECT 'perfumes' familia, COUNT(*) n FROM perfumes WHERE tipo_producto='fabricado' AND solo_armado=0
UNION ALL
SELECT 'productos', COUNT(*) FROM perfumes WHERE solo_armado=1 OR tipo_producto='comprado';"
```

Los dos números tienen que sumar el total del catálogo y coincidir con los contadores de las dos pestañas. Si no coinciden, **parar y avisar**: significa que la regla se rompió por algún lado.

- [ ] **Step 4: Dejar el entorno como estaba**

Borrar los productos de prueba que se hayan creado. La base local es la del dueño: lo que no se borre lo va a ver.

- [ ] **Step 5: Escribir el porqué donde va**

En `docs/arquitectura.md`, en la sección del dashboard: que Catálogo tiene dos pestañas sobre la MISMA tabla, cuál es la regla que las parte, y **que el dashboard y la tienda agrupan con criterios distintos** — es lo que un futuro lector deshará por error si no lo encuentra escrito.

En `docs/pendientes.md`: bajar la Ola 1 a hecho y dejar anotadas la Ola 2 (Producciones y el alta desde el lote) y la Ola 3 (la tienda).

- [ ] **Step 6: Commit**

```bash
git add docs/arquitectura.md docs/pendientes.md
git commit -m "docs: por qué el Catálogo tiene dos pestañas y por qué la tienda no las copia"
```

---

## Dos desvíos respecto al boceto que aprobó el dueño

Están aquí para que no pasen por descuido. Los dos son a la baja, ninguno agrega alcance:

1. **La columna TIENDA del boceto se sirve con la columna ESTADO que ya existe.** `EstadoPerfume`
   ya dice "Fuera de la tienda", y además marca agotado y lo que falta para vender. Una columna
   nueva al lado diría lo mismo con menos información — y serían dos sitios donde vive la misma
   regla, que es justo lo que el proyecto prohíbe.
2. **La columna STOCK no entra en esta ola.** El listado no trae hoy las unidades armadas ni el
   stock del insumo enlazado; traerlas es una consulta más en el camino caliente del catálogo.
   Entra en la Ola 2, junto a Producciones, que es donde el dueño mira las unidades de verdad.

**Si el dueño quiere STOCK ya, dígalo antes de empezar**: es una tarea más en esta ola, no un
ajuste al final.

## Lo que esta ola NO hace

- **No toca la tienda pública.** `/accesorios` y sacar los accesorios de `/perfumes` son la Ola 3.
- **No toca Producciones** ni el alta del 1.1 desde el lote: Ola 2.
- **No muestra el stock** en la tabla de Productos: entra en la Ola 2 con Producciones.
- **No cambia el modal de la ficha campo por campo.** Se reutiliza tal cual; ajustarlo por familia es una mejora posterior, y solo si el dueño la pide.
- **No arregla los envases en 0** del desplegable de producción ni el Perfumero en −5.000: están anotados en `pendientes.md` como defectos aparte.
- **No toca la maceración.** Decisión del dueño del 2026-08-23: va después de las tres olas.
