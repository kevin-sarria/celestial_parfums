import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SelectSimple } from '@/components/ui/select-simple';
import { Field, FieldRow } from '../ui';
import { http } from '../../../infrastructure/api/http';
import { urls } from '../../../infrastructure/api/urls';
import BuscadorSelect from '../../../components/BuscadorSelect';
import type { Insumo } from '../../../domain/entities/cotizacion.types';

/**
 * Dar de alta un insumo SIN salir de la factura.
 *
 * Salió de `DetalleCompra.tsx` (iba en 513 líneas) con todo lo suyo: su
 * estado, sus gamas, las reglas de cuándo un material es una esencia o un
 * accesorio vendible, y el nombre que se le pone al perfume que nace con él.
 * La compra no necesita saber nada de eso — solo que se creó un insumo, para
 * meterlo como línea.
 *
 * Se monta al abrirlo y se desmonta al cerrarlo: por eso el formulario arranca
 * limpio cada vez sin que nadie tenga que acordarse de vaciarlo.
 */

interface NuevoInsumo {
  nombre: string;
  tipo: 'materia_prima' | 'envase' | 'accesorio';
  unidad: 'ml' | 'unidad';
  /** Gama de la esencia. Con gama elegida, el insumo ES una esencia. */
  gama_id: number | null;
  /** Para quién es la fragancia. '' = todavía no se dice. */
  genero: '' | 'dama' | 'caballero' | 'unisex';
  /** Crear además su producto del catálogo, ya enlazado a este material. */
  crear_perfume: boolean;
  /** Solo accesorios: a cuánto se le vende. Texto porque es un input. */
  precio_venta: string;
}

const GENERO_TEXTO: Record<string, string> = {
  dama: 'Dama', caballero: 'Caballero', unisex: 'Unisex',
};

interface Gama { id: number; nombre: string }

/** "Eros Caballero – Esencia" → "Eros Caballero". */
const sinSufijoEsencia = (s: string) =>
  s.replace(/\s*[–—-]\s*esencias?\s*$/i, '').replace(/^\s*esencias?\s+(de\s+)?/i, '').trim();

/**
 * Cómo se llamará cada cosa. El dueño teclea el nombre de la FRAGANCIA una sola
 * vez y de ahí salen los dos nombres: el material conserva el sufijo
 * "– Esencia" con el que están guardadas las otras 213, y el producto del
 * catálogo lleva el nombre limpio, que es el que ve el cliente.
 */
const nombresDe = (escrito: string) => {
  const limpio = escrito.trim();
  const fragancia = sinSufijoEsencia(limpio);
  return {
    fragancia,
    // Si ya lo escribió con sufijo se respeta tal cual: no se le agrega dos veces
    insumo: fragancia && fragancia !== limpio ? limpio : (fragancia ? `${fragancia} – Esencia` : ''),
  };
};

export function AltaInsumoEnCompra({ onCerrar, onCreado }: {
  onCerrar: () => void;
  /** El insumo recién creado, para que la compra lo agregue como línea. */
  onCreado: (insumo: Insumo) => void;
}) {
  const [nuevo, setNuevo] = useState<NuevoInsumo>({
    nombre: '', tipo: 'materia_prima', unidad: 'ml',
    gama_id: null, genero: '', crear_perfume: true, precio_venta: '',
  });
  const [creando, setCreando] = useState(false);
  const [gamas, setGamas] = useState<Gama[]>([]);

  /** Las gamas se piden al abrir el mini-form, no al montar: casi ninguna
   *  compra da de alta material nuevo y sería una petición desperdiciada. */
  const cargarGamas = async () => {
    if (gamas.length) return;
    // Si falla no se avisa: sin gamas el alta sigue funcionando, solo que el
    // material queda sin clasificar.
    const res = await http.get<{ data?: Gama[] }>(urls.costeo.gamas);
    if (res.ok) setGamas(res.cuerpo?.data ?? []);
  };

  /** Las gamas se piden al abrirlo: casi ninguna compra da de alta material. */
  useEffect(() => { void cargarGamas(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Con gama elegida el material ES una esencia: solo entonces hay perfume. */
  const esEsencia = nuevo.tipo === 'materia_prima' && nuevo.gama_id !== null;
  const nombres = nombresDe(nuevo.nombre);
  const conPerfume = esEsencia && !!nuevo.crear_perfume && !!nombres.fragancia;

  /**
   * Un accesorio —perfumero, bolsa, tarjeta— también se le vende al cliente, y
   * hasta hoy no había forma de decirlo: quedaba solo como material, así que no
   * aparecía en Registrar venta y lo que regalabas no descontaba de nada.
   * Necesita SU precio, que no es el costo: el costo lo fija esta compra.
   */
  const esAccesorio = nuevo.tipo === 'accesorio';
  const precioVenta = Number(nuevo.precio_venta);
  const conAccesorio = esAccesorio && !!nuevo.crear_perfume
    && !!nuevo.nombre.trim() && precioVenta > 0;

  /** Crea el insumo con precio 0: su costo lo fija ESTA compra al guardarse. */
  const crearInsumo = async () => {
    if (!nombres.insumo) { toast.error('Ponle un nombre al insumo', { id: 'insumo-nuevo' }); return; }
    setCreando(true);
    try {
      const res = await http.post<{ message?: string; data: Insumo }>(urls.costeo.crearInsumo, {
        tipo: nuevo.tipo,
        unidad: nuevo.unidad,
        // El sufijo "– Esencia" solo se agrega cuando de verdad lo es
        nombre: esEsencia ? nombres.insumo : nuevo.nombre.trim(),
        gama_id: esEsencia ? nuevo.gama_id : null,
        genero: esEsencia && nuevo.genero ? nuevo.genero : null,
        crear_perfume: conPerfume || conAccesorio,
        ...(conPerfume ? { perfume_nombre: nombres.fragancia } : {}),
        ...(conAccesorio ? { perfume_nombre: nuevo.nombre.trim(), precio_venta: precioVenta } : {}),
        alcance: 'unidad',
        precio: 0,
      });
      if (!res.ok || !res.cuerpo) { toast.error(res.error || 'No se pudo crear el insumo', { id: 'insumo-nuevo' }); return; }
      const creado = res.cuerpo.data;
      onCreado(creado);
      // El mensaje lo redacta el servidor: es el único que sabe si el perfume se
      // creó, se enlazó a uno que ya existía o se dejó como estaba.
      toast.success(res.cuerpo.message ?? `"${creado.nombre}" quedó creado y agregado a la compra`);
    } finally { setCreando(false); }
  };

  return (
    <div className="rounded-lg border border-primary/40 bg-card p-3">
      <p className="mb-2.5 text-[13px] font-medium text-foreground">Insumo nuevo</p>
      <FieldRow>
        <Field label={esEsencia ? '¿Qué fragancia llegó?' : '¿Cómo se llama?'} className="min-w-52 flex-1">
          <Input autoFocus value={nuevo.nombre} maxLength={120}
            placeholder={esEsencia ? 'Ej: Khamrah, Eros Caballero' : 'Ej: Diluyente, Frasco luxury 30 ml'}
            onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
        </Field>
        <Field label="¿Qué es?" className="w-44">
          <SelectSimple value={nuevo.tipo}
            onChange={(e) => setNuevo({ ...nuevo, tipo: e.target.value as NuevoInsumo['tipo'] })}>
            <option value="materia_prima">Materia prima (esencia, alcohol…)</option>
            <option value="envase">Envase (frasco, tapa)</option>
            <option value="accesorio">Accesorio (bolsa, tarjeta)</option>
          </SelectSimple>
        </Field>
        <Field label="¿Cómo se mide?" className="w-40">
          <SelectSimple value={nuevo.unidad}
            onChange={(e) => setNuevo({ ...nuevo, unidad: e.target.value as NuevoInsumo['unidad'] })}>
            <option value="ml">Por mililitro o gramo</option>
            <option value="unidad">Por unidad</option>
          </SelectSimple>
        </Field>
        {/* La gama solo aplica a materia prima, y es lo que distingue una
            ESENCIA del diluyente o el sellador: con gama elegida el sistema
            ya sabe cuánto cuesta por ml esa calidad y puede cotizar al
            mayoreo sin saber todavía qué fragancias van. */}
        {nuevo.tipo === 'materia_prima' && (
          <Field label="¿De qué gama es?" className="w-52">
            <BuscadorSelect
              opciones={[
                { id: 0, nombre: 'No es una esencia (diluyente, sellador…)' },
                ...gamas.map((g) => ({ id: g.id as number | string, nombre: g.nombre })),
              ]}
              value={nuevo.gama_id ?? 0}
              placeholder="Elegir gama…"
              onSelect={(id) => setNuevo({ ...nuevo, gama_id: Number(id) || null })}
              vacio="Todavía no has creado gamas"
            />
          </Field>
        )}
        {/* Solo 3 opciones fijas: aquí el buscador estorbaría más de lo que
            ayuda (la regla del proyecto lo reserva para listas que crecen). */}
        {esEsencia && (
          <Field label="¿Para quién es?" className="w-40">
            <SelectSimple value={nuevo.genero}
              onChange={(e) => setNuevo({ ...nuevo, genero: e.target.value as NuevoInsumo['genero'] })}>
              <option value="">Todavía no sé</option>
              <option value="dama">Dama</option>
              <option value="caballero">Caballero</option>
              <option value="unisex">Unisex</option>
            </SelectSimple>
          </Field>
        )}
      </FieldRow>

      {/* Con gama elegida es una esencia, y toda esencia tiene su perfume.
          Crearlo aquí es lo que deja la cadena completa desde que llega el
          material hasta que se descuenta al vender. */}
      {esEsencia && (
        <label className="mt-2.5 flex items-start gap-2 rounded-lg border border-border bg-secondary/50 p-2.5">
          <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-primary"
            checked={nuevo.crear_perfume}
            onChange={(e) => setNuevo({ ...nuevo, crear_perfume: e.target.checked })} />
          <span className="text-[12.5px] leading-snug">
            <span className="font-medium text-foreground">
              Crear también el perfume en el catálogo
            </span>
            {conPerfume ? (
              <span className="mt-1 block text-muted-foreground">
                Se guardarán dos cosas:{' '}
                <strong className="font-medium text-foreground">{nombres.insumo}</strong>{' '}
                como material de esta compra, y{' '}
                <strong className="font-medium text-foreground">{nombres.fragancia}</strong>{' '}
                {nuevo.genero && ` (${GENERO_TEXTO[nuevo.genero]})`} como producto —{' '}
                <strong className="font-medium text-primary">fuera de la tienda</strong>, con su
                esencia ya enlazada, para que le pongas precio y foto cuando quieras. Si ese
                perfume ya existe, se enlaza en vez de duplicarlo.
              </span>
            ) : (
              <span className="mt-1 block text-muted-foreground">
                Escribe el nombre de la fragancia y te digo cómo va a quedar.
              </span>
            )}
          </span>
        </label>
      )}

      {/* Un accesorio no tiene receta ni talla: se compra hecho y se
          revende tal cual. Por eso aquí sí se pide precio — sin él, el
          producto nacería en cero y meterlo en una venta sería regalarlo. */}
      {esAccesorio && (
        <>
          <label className="mt-2.5 flex items-start gap-2 rounded-lg border border-border bg-secondary/50 p-2.5">
            <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-primary"
              checked={nuevo.crear_perfume}
              onChange={(e) => setNuevo({ ...nuevo, crear_perfume: e.target.checked })} />
            <span className="text-[12.5px] leading-snug">
              <span className="font-medium text-foreground">
                También se lo vendo a los clientes
              </span>
              <span className="mt-1 block text-muted-foreground">
                Queda disponible en <strong className="font-medium text-foreground">Registrar
                venta</strong>, en el buscador de accesorios, para agregarlo a cualquier pedido
                como extra o como regalo. Nace{' '}
                <strong className="font-medium text-primary">fuera de la tienda</strong>: tú
                decides después si además quieres venderlo suelto en el catálogo.
              </span>
            </span>
          </label>

          {/* FUERA de la etiqueta de arriba a propósito: un input dentro de
              un <label> hace que escribir el precio marque y desmarque la
              casilla. Aquí es un campo normal, como el resto del modal. */}
          {nuevo.crear_perfume && (
            <div className="mt-2">
              <Field label="Precio de venta *">
                <Input
                  type="number" min="0" value={nuevo.precio_venta}
                  placeholder="Ej: 5000"
                  onChange={(e) => setNuevo({ ...nuevo, precio_venta: e.target.value })}
                />
              </Field>
              <p className="mt-1 text-[11.5px] text-muted-foreground">
                Lo que le cobras al cliente. Lo que a ti te cuesta lo fija esta compra.
              </p>
            </div>
          )}
        </>
      )}

      {/* No se pregunta el precio a propósito: sale del costo promedio que
          calcula esta misma compra. Teclearlo a mano sería inventárselo. */}
      <p className="mt-1.5 text-[12px] text-muted-foreground">
        No hace falta el precio: lo fija esta compra cuando la guardes.
      </p>
      <div className="mt-2.5 flex gap-2">
        <Button size="sm" onClick={crearInsumo} disabled={creando}>
          {creando ? 'Creando…' : 'Crear y agregar'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCerrar}>Cancelar</Button>
      </div>
    </div>
  );
}
