import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Droplets, FlaskConical, PackagePlus, Pencil, Plus, Scale, ShoppingCart, ToggleLeft, ToggleRight, Trash2, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PerfumeSpinner from '../../../components/PerfumeSpinner';
import Modal from '../../../components/Modal';
import ExportMenu from '../../../components/ExportMenu';
import ImportModal from '../../../components/ImportModal';
import MenuAcciones from '../../../components/MenuAcciones';
import { SmartTable } from '../../../components/table/SmartTable';
import { http } from '../../../infrastructure/api/http';
import { urls } from '../../../infrastructure/api/urls';
import { formatPrice } from '../helpers';
import { inventarioColumns, terminadoColumns } from '../columns';
import { EncabezadoPagina, Field, FieldRow, FranjaMetricas, Section, SectionTitle, StatCard } from '../ui';
import { SalidaModal } from './inventario/SalidaModal';
import { PrimerosPasos } from './inventario/PrimerosPasos';
import { AsignarEsenciasModal } from './inventario/AsignarEsenciasModal';
import { AvisoEsenciasSinPerfume } from './inventario/EmparejarEsenciasModal';
import { MaterialModal } from './inventario/MaterialModal';
import { ProduccionModal, type PerfumeLite } from './inventario/ProduccionModal';
import type {
  CatalogoItem, CatalogoRespuesta, FrascoArmado, InventarioInsumo, ResumenInventario,
} from '../types';
import type { FormulaVolumen, Insumo } from '../../../domain/entities/cotizacion.types';

const hoy = () => new Date().toISOString().slice(0, 10);

/**
 * Inventario de insumos: qué hay, cuánto vale y por dónde se mueve.
 *
 * El stock y el costo promedio NO se teclean: entran por compras y salen por
 * producción. Aquí solo se siembra el arranque (conteo físico) y se registra
 * lo que se arma.
 */
export function InventarioTab() {
  const [insumos, setInsumos] = useState<InventarioInsumo[]>([]);
  const [catalogo, setCatalogo] = useState<Insumo[]>([]);
  const [formulas, setFormulas] = useState<FormulaVolumen[]>([]);
  const [valorTotal, setValorTotal] = useState(0);
  // Frascos ya armados: inventario que hasta el 2026-08-14 no se veía en ningún lado
  const [terminado, setTerminado] = useState<{ filas: FrascoArmado[]; unidades: number; valor: number }>(
    { filas: [], unidades: 0, valor: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [ajuste, setAjuste] = useState<InventarioInsumo | null>(null);
  const [cantidadFinal, setCantidadFinal] = useState('');
  const [costoAjuste, setCostoAjuste] = useState('');
  const [minimoAjuste, setMinimoAjuste] = useState('');
  const [prodAbierta, setProdAbierta] = useState(false);
  const [perfumes, setPerfumes] = useState<PerfumeLite[]>([]);
  // Salidas sin venta: rolones del mostrario, minis de regalo, derrames
  const [salidaAbierta, setSalidaAbierta] = useState(false);
  const [salidasMes, setSalidasMes] = useState({ muestras: 0, mermas: 0, ajustes: 0 });
  const [importOpen, setImportOpen] = useState(false);
  const [guardando, setGuardando] = useState(false);
  // Arranque: la lista de primeros pasos y la asignación de esencias en bloque
  const [esenciasAbierto, setEsenciasAbierto] = useState(false);
  const [pasosVersion, setPasosVersion] = useState(0);
  const recargarPasos = () => setPasosVersion(v => v + 1);
  // Alta y edición de materiales: vive aquí desde que se fusionó con la pestaña
  // "Insumos y precios", que enseñaba estos mismos registros desde otro ángulo.
  const [material, setMaterial] = useState<{ abierto: boolean; dato: InventarioInsumo | null }>(
    { abierto: false, dato: null });

  const load = async () => {
    setLoading(true);
    try {
      const [ri, rc, rf, rpf] = await Promise.all([
        http.get<{ data: ResumenInventario }>(urls.inventario.resumen),
        http.get<{ data: Insumo[] }>(urls.costeo.insumos),
        http.get<{ data: FormulaVolumen[] }>(urls.costeo.formulas),
        http.get<CatalogoRespuesta>(urls.perfumes.todos),
      ]);
      if (!ri.ok || !rc.ok || !rf.ok) throw new Error(ri.error || rc.error || rf.error);
      const inv = ri.cuerpo?.data;
      setInsumos(inv?.insumos ?? []);
      setValorTotal(inv?.valor_total ?? 0);
      setSalidasMes(inv?.salidas_mes ?? { muestras: 0, mermas: 0, ajustes: 0 });
      setTerminado(inv?.terminado ?? { filas: [], unidades: 0, valor: 0 });
      setCatalogo(rc.cuerpo?.data ?? []);
      setFormulas(rf.cuerpo?.data ?? []);
      // /api/parfums sin paginar responde { data: { data: [...] } }
      const jp = rpf.cuerpo?.data;
      const lista = Array.isArray(jp) ? jp : (jp?.data ?? []);
      setPerfumes(lista.map((p: CatalogoItem) => ({
        id: p.id, nombre: p.nombre, insumo_esencia_id: p.insumo_esencia_id ?? null,
      })));
      setError('');
    } catch {
      setError('No se pudo cargar el inventario. Revisa tu conexión y reintenta.');
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const abrirAjuste = (i: InventarioInsumo) => {
    setAjuste(i); setCantidadFinal(String(i.stock)); setCostoAjuste(String(i.costo_promedio));
    setMinimoAjuste(String(i.stock_minimo || ''));
  };

  const guardarAjuste = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (!ajuste) return;
    setGuardando(true);
    try {
      const res = await http.post(urls.inventario.ajustes, {
        insumo_id: ajuste.id,
        cantidad_final: Number(cantidadFinal) || 0,
        costo_unitario: Number(costoAjuste) || 0,
        stock_minimo: Number(minimoAjuste) || 0,
        fecha: hoy(),
        nota: 'Conteo físico',
      });
      if (!res.ok) { toast.error(res.error, { id: 'ajuste' }); return; }
      toast.success('Inventario ajustado');
      setAjuste(null); load(); recargarPasos();
    } finally { setGuardando(false); }
  };

  /**
   * Jubila un material sin tocar su historial: deja de aparecer al comprar y
   * producir, y no suma al valor del inventario. Es lo que hay que usar cuando
   * ya tiene movimientos — borrarlo dejaría esos registros sin referencia.
   */
  const alternarActivo = async (i: InventarioInsumo) => {
    const activo = !i.activo;
    const res = await http.patch(urls.costeo.insumo(i.id), {
      nombre: i.nombre, tipo: i.tipo, unidad: i.unidad,
      alcance: 'unidad', precio: i.costo_promedio, activo,
    });
    if (!res.ok) { toast.error(res.error, { id: 'insumo-activo' }); return; }
    toast.success(activo
      ? `"${i.nombre}" vuelve a estar disponible`
      : `"${i.nombre}" apagado: ya no aparecerá al comprar ni producir`);
    load(); recargarPasos();
  };

  /** Solo funciona con lo que nunca se usó; el servidor dice qué lo retiene. */
  const eliminarInsumo = async (i: InventarioInsumo) => {
    if (!window.confirm(
      `¿Eliminar "${i.nombre}"?\n\n`
      + 'Solo se puede si nunca se usó. Si ya tiene compras o movimientos, el sistema '
      + 'te lo dirá: en ese caso apágalo en vez de borrarlo.',
    )) return;
    const res = await http.borrar(urls.costeo.insumo(i.id));
    if (!res.ok) { toast.error(res.error, { id: 'insumo-del', duration: 9000 }); return; }
    toast.success(`"${i.nombre}" eliminado`);
    load(); recargarPasos();
  };

  if (loading) return <Section><PerfumeSpinner /></Section>;

  // Los apagados están jubilados: no cuentan como material de trabajo ni
  // disparan la alerta de "sin existencias".
  const activos = insumos.filter((i) => i.activo);
  const sinStock = activos.filter((i) => i.stock <= 0).length;
  /** Los que ya tocaron su punto de pedido: esta es la lista de compras. */
  const porPedir = insumos.filter((i) => i.bajo_minimo);

  return (
    <div className="space-y-4">
      <EncabezadoPagina titulo="Inventario" count={activos.length} />

      {/* Guía de arranque. Se esconde sola cuando los 4 pasos están hechos. */}
      <PrimerosPasos
        recargar={pasosVersion}
        onContar={() => {
          // Lleva al primero sin existencias, que es por donde se empieza a contar
          const primero = insumos.find(i => i.stock <= 0) ?? insumos[0];
          if (primero) abrirAjuste(primero);
        }}
        onAsignarEsencias={() => setEsenciasAbierto(true)}
        onAgregarMaterial={() => setMaterial({ abierto: true, dato: null })}
      />

      {/* Se esconde solo cuando ya no queda ninguna esencia sin su perfume. */}
      <AvisoEsenciasSinPerfume onGuardado={recargarPasos} />

      {error && (
        <p className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-[13px] font-medium text-destructive">
          {error}
          <Button size="sm" variant="outline" className="h-7" onClick={load}>Reintentar</Button>
        </p>
      )}

      <FranjaMetricas>
        <StatCard label="Valor del inventario" value={formatPrice(valorTotal)}
          nota="Lo que tienes guardado, al costo promedio" />
        <StatCard label="Insumos registrados" value={String(activos.length)}
          nota={insumos.length > activos.length
            ? `Materias primas, envases y accesorios · ${insumos.length - activos.length} apagado(s)`
            : 'Materias primas, envases y accesorios'} />
        <StatCard label="Sin existencias" value={String(sinStock)}
          nota={sinStock === 0 ? 'Todo con stock' : 'Insumos en cero: revisa antes de producir'} />
        {/* Va aparte del valor del inventario a propósito: son dos cifras que el
            dueño lee distinto ("material que puedo usar" contra "producto listo
            para vender"), y meterlas en una sola cambiaría en silencio un número
            que él ya venía siguiendo. */}
        {terminado.unidades !== 0 && (
          <StatCard label="Frascos armados" value={String(terminado.unidades)}
            nota={`${formatPrice(terminado.valor)} en producto listo para vender`} />
        )}
      </FranjaMetricas>

      {/**
        * UNA línea, no la lista.
        *
        * Aquí se pintaban todos los materiales bajo mínimo, uno por renglón. Se
        * escribió cuando solo 1 de 226 tenía mínimo configurado, así que se veía
        * bien; en cuanto se configuraron los mínimos por gama pasó a **55
        * renglones** tapando la pantalla y el dueño lo rechazó. El detalle
        * (cuánto pedir, a qué costo, listo para WhatsApp) ya tiene su propia
        * pestaña desde el 2026-08-10: repetirlo aquí era duplicar una pantalla.
        */}
      {porPedir.length > 0 && (
        <Link
          to="/dashboard/reposicion"
          className="flex w-full items-center gap-2 rounded-lg border border-amber-400/45 bg-amber-400/10 px-3.5 py-2.5 text-left text-[12.5px] text-amber-900 transition-colors hover:bg-amber-400/20"
        >
          <ShoppingCart className="size-4 shrink-0 text-amber-700" />
          <span className="flex-1">
            <strong className="font-medium">{porPedir.length}</strong>{' '}
            {porPedir.length === 1 ? 'material llegó' : 'materiales llegaron'} a su mínimo
          </span>
          <span className="shrink-0 font-medium text-amber-800">Ver el pedido sugerido →</span>
        </Link>
      )}

      {/* Lo que se fue sin vender: muestras es marketing, merma es pérdida */}
      {(salidasMes.muestras > 0 || salidasMes.mermas > 0 || salidasMes.ajustes > 0) && (
        <p className="rounded-lg border border-border bg-secondary/40 px-3.5 py-2.5 text-[12.5px] text-muted-foreground">
          Este mes salió material sin venta:
          {salidasMes.muestras > 0 && <> <strong className="text-foreground">{formatPrice(salidasMes.muestras)}</strong> en muestras y mostrario</>}
          {salidasMes.mermas > 0 && <> · <strong className="text-foreground">{formatPrice(salidasMes.mermas)}</strong> en mermas</>}
          {salidasMes.ajustes > 0 && <> · <strong className="text-foreground">{formatPrice(salidasMes.ajustes)}</strong> de diferencia en conteos</>}
          . Las muestras son inversión en vender; las mermas y las diferencias, plata perdida.
        </p>
      )}

      {/**
        * Los frascos ya armados, cuando los hay.
        *
        * Se esconde en cero (mismo criterio que el resto de la pantalla: solo se
        * pinta lo que hay que mirar). Va ARRIBA de los materiales porque es lo
        * que se puede vender hoy mismo, y porque la tabla de materiales tiene
        * 226 renglones: debajo de ella no lo vería nadie.
        */}
      {terminado.filas.length > 0 && (
        <Section>
          <SectionTitle count={terminado.filas.length}>Frascos ya armados</SectionTitle>
          <p className="text-[12.5px] text-muted-foreground">
            Producto terminado, listo para entregar. Su material ya se descontó el día que lo
            armaste, así que al venderlo <strong className="text-foreground">no se vuelve a
            descontar</strong>. El costo de cada uno quedó congelado en ese momento.
          </p>
          <SmartTable
            columns={terminadoColumns}
            rows={terminado.filas}
            rowKey={f => `${f.perfume_id}-${f.presentacion_id}`}
            paginadoLocal
            tarjetaMovil
            emptyText="Todavía no has armado frascos por adelantado."
          />
        </Section>
      )}

      <Section>
        <p className="text-[12.5px] text-muted-foreground">
          El stock entra con las compras a proveedores y sale con la producción. Usa
          <strong className="text-foreground"> Ajustar</strong> para sembrar lo que ya tienes hoy
          o corregir tras un conteo — la diferencia que aparezca es el desperdicio del día a día
          (los gramos que se van de más al servir), no hace falta anotarlos uno por uno.
        </p>

        <SmartTable
          columns={inventarioColumns}
          rows={insumos}
          rowKey={i => i.id}
          numerada
          paginadoLocal
          tarjetaMovil
          emptyText="Todavía no has registrado insumos."
          renderActions={i => (
            <span className="flex items-center justify-end gap-0.5">
              {i.activo && (
                <Button size="sm" variant="ghost" className="h-7" onClick={() => abrirAjuste(i)}>
                  Ajustar
                </Button>
              )}
              <Button size="icon" variant="ghost" className="size-8 text-muted-foreground"
                title="Editar nombre, tipo o unidad"
                onClick={() => setMaterial({ abierto: true, dato: i })}>
                <Pencil className="size-4" />
              </Button>
              <Button size="icon" variant="ghost" className="size-8 text-muted-foreground"
                title={i.activo
                  ? 'Apagar: deja de aparecer al comprar y producir. Su historial queda intacto.'
                  : 'Encender: vuelve a estar disponible.'}
                onClick={() => alternarActivo(i)}>
                {i.activo ? <ToggleRight className="size-4" /> : <ToggleLeft className="size-4" />}
              </Button>
              <Button size="icon" variant="ghost" className="size-8 text-muted-foreground hover:text-destructive"
                title="Eliminar (solo si nunca se usó)"
                onClick={() => eliminarInsumo(i)}>
                <Trash2 className="size-4" />
              </Button>
            </span>
          )}
          accionesMovil={i => (
            <>
              {i.activo && (
                <Button size="sm" variant="outline" onClick={() => abrirAjuste(i)}>
                  <Scale className="size-4" /> Ajustar existencias
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => alternarActivo(i)}>
                {i.activo ? <ToggleRight className="size-4" /> : <ToggleLeft className="size-4" />}
                {i.activo ? 'Apagar' : 'Encender'}
              </Button>
              <Button size="sm" variant="outline" className="text-destructive"
                onClick={() => eliminarInsumo(i)}>
                <Trash2 className="size-4" /> Eliminar
              </Button>
            </>
          )}
          acciones={
            <>
              {/* Excel es mantenimiento: cabe detrás de un clic para no competir
                  con las tres acciones reales del día. Los nombres van en el idioma
                  del dueño, no del sistema: "Movimientos" e "Insumos" no le dicen
                  nada a quien no construyó esto. */}
              <ExportMenu
                onImportar={() => setImportOpen(true)}
                importarLabel="Subir hoja de conteo"
                descargas={[
                  { entity: 'inventario', label: 'Hoja de conteo', nota: 'Para contar y volver a subirla' },
                  { entity: 'insumos', label: 'Lista de materiales', nota: 'Qué usas y cuánto cuesta' },
                  { entity: 'movimientos', label: 'Historial de entradas y salidas', nota: 'Solo se descarga' },
                ]}
              />
              {/**
                * Agrupados por la PREGUNTA que responden, no por orden de llegada.
                *
                * Esta barra había crecido a seis botones del mismo peso —uno por
                * cada función nueva— y encontrar lo que se hace a diario costaba
                * lo mismo que encontrar lo de una vez al mes. Ahora: lo que se
                * configura de vez en cuando en un menú, lo que consume material
                * en otro, y **una sola acción destacada**, que es la que de
                * verdad se usa (61 compras registradas contra 0 producciones).
                *
                * Los nombres van en el idioma del dueño: "Registrar uso", nunca
                * "Movimientos" — esa palabra es del sistema, no del negocio.
                */}
              <MenuAcciones
                label="Materiales" icon={Plus} titulo="Dar de alta y clasificar"
                acciones={[
                  {
                    label: 'Material nuevo', icon: Plus,
                    nota: 'Una esencia, un frasco, un accesorio',
                    onSelect: () => setMaterial({ abierto: true, dato: null }),
                  },
                  {
                    // Vive aquí y no solo en Primeros pasos: esa caja desaparece
                    // al completarse, y sin esto la asignación quedaría
                    // inalcanzable para el próximo perfume nuevo.
                    label: 'Asignar esencias', icon: Wand2,
                    nota: 'Enlazar varias fragancias de una vez',
                    onSelect: () => setEsenciasAbierto(true),
                  },
                ]}
              />
              <MenuAcciones
                label="Registrar uso" icon={Droplets} titulo="Material que salió"
                acciones={[
                  {
                    label: 'Armé perfumes', icon: FlaskConical,
                    nota: 'Descuenta la receta del tamaño',
                    onSelect: () => setProdAbierta(true),
                  },
                  {
                    label: 'Muestra, regalo o daño', icon: Droplets,
                    nota: 'Salió sin venta: mostrario o pérdida',
                    onSelect: () => setSalidaAbierta(true),
                  },
                ]}
              />
              <Button size="sm" asChild>
                <Link to="/dashboard/pagos?nueva=1">
                  <PackagePlus className="size-4" /> Registrar llegada
                </Link>
              </Button>
            </>
          }
        />
      </Section>


      {/* Ajuste por conteo físico */}
      {ajuste && (
        <Modal open onClose={() => setAjuste(null)} title={`Ajustar ${ajuste.nombre}`}
          onSubmit={guardarAjuste} submitLabel={guardando ? 'Guardando…' : 'Ajustar'} loading={guardando}>
          <p className="text-[13px] text-muted-foreground">
            Escribe cuánto tienes <strong className="text-foreground">de verdad</strong>. El sistema calcula
            la diferencia y la registra como movimiento.
          </p>
          <FieldRow>
            <Field label={`Cantidad real (${ajuste.unidad})`}>
              <Input type="number" min="0" step="0.001" value={cantidadFinal}
                onChange={(e) => setCantidadFinal(e.target.value)} />
            </Field>
            <Field label="Costo por unidad">
              <Input type="number" min="0" step="0.0001" value={costoAjuste}
                onChange={(e) => setCostoAjuste(e.target.value)} />
            </Field>
            <Field label="Avísame cuando baje de">
              <Input type="number" min="0" step="0.001" value={minimoAjuste}
                placeholder="0 = sin aviso"
                onChange={(e) => setMinimoAjuste(e.target.value)} />
            </Field>
          </FieldRow>
          <p className="text-[12px] text-muted-foreground">
            El punto de pedido se guarda aunque no cambies la cantidad. Ponle lo que gastas
            entre un pedido y otro, con algo de margen: así te avisa con tiempo de encargar.
          </p>
          <p className="text-[12px] text-muted-foreground">
            El costo solo se usa si el ajuste <strong>suma</strong> material (por ejemplo al cargar el
            stock inicial). Si estás quitando, se valora al promedio que ya tiene.
          </p>
        </Modal>
      )}

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        entity="inventario"
        onImported={load}
      />

      {material.abierto && (
        <MaterialModal
          material={material.dato}
          onClose={() => setMaterial({ abierto: false, dato: null })}
          onGuardado={() => { load(); recargarPasos(); }}
        />
      )}

      {esenciasAbierto && (
        <AsignarEsenciasModal
          onClose={() => setEsenciasAbierto(false)}
          onGuardado={recargarPasos}
        />
      )}

      {/* Salida sin venta: mostrario, regalos, derrames */}
      {salidaAbierta && (
        <SalidaModal
          insumos={insumos}
          onClose={() => setSalidaAbierta(false)}
          onGuardado={load}
        />
      )}

      {/* Registrar un lote */}
      {prodAbierta && (
        <ProduccionModal
          formulas={formulas}
          perfumes={perfumes}
          catalogo={catalogo}
          insumos={insumos}
          onClose={() => setProdAbierta(false)}
          onGuardado={load}
        />
      )}
    </div>
  );
}
