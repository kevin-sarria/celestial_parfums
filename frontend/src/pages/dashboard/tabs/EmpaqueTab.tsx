import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Gift } from 'lucide-react';
import PerfumeSpinner from '../../../components/PerfumeSpinner';
import { NoSePudoCargar } from '../../../components/NoSePudoCargar';
import { http } from '../../../infrastructure/api/http';
import { urls } from '../../../infrastructure/api/urls';
import { olvidarEmpaque, type ConfigEmpaque } from '../../../application/hooks/useEmpaque';
import type { LineaEmpaque as Linea } from '../pedido/empaque.calculo';
import { LineaEmpaque } from './empaque/LineaEmpaque';
import { Section, SectionTitle, Toolbar } from '../ui';

/** Las líneas en el orden en que el dueño las nombra (2026-10-03). */
const LINEAS: { linea: Linea; titulo: string; ayuda: string }[] = [
  { linea: 'contratipo', titulo: 'Contratipo', ayuda: 'Los que preparas con esencia.' },
  { linea: 'uno_uno', titulo: '1.1', ayuda: 'Los de envase de lujo idéntico al original.' },
  { linea: 'decant', titulo: 'Decant de original', ayuda: 'El líquido de un original pasado a un frasco pequeño.' },
  { linea: 'botella_completa', titulo: 'Botella completa', ayuda: 'El original entero, tal como llegó.' },
  { linea: 'producto', titulo: 'Producto', ayuda: 'Lo que compras hecho para revender (un splash).' },
];

/**
 * EMPAQUE (2026-10-04): lo que se regala con cada venta según la línea y la
 * talla. Un combo manda sobre esto con su kit. Al vender, el formulario lo
 * ofrece marcado y entra como regalo. Diseño en
 * `docs/superpowers/specs/2026-10-04-empaque-por-linea-design.md`.
 */
export function EmpaqueTab() {
  const [config, setConfig] = useState<ConfigEmpaque | null>(null);
  const [fallo, setFallo] = useState('');
  const [cargando, setCargando] = useState(true);

  const cargar = async () => {
    setCargando(true);
    try {
      const res = await http.get<{ data: ConfigEmpaque }>(urls.empaque);
      if (!res.ok || !res.cuerpo) { setFallo(res.error); return; }
      setConfig(res.cuerpo.data); setFallo('');
    } catch { setFallo('No se pudo conectar con el servidor'); }
    finally { setCargando(false); }
  };
  useEffect(() => { cargar(); }, []);

  // Lo que devolvió el servidor ES el estado nuevo; las ventas abiertas lo releen
  const alGuardar = (nueva: ConfigEmpaque) => { setConfig(nueva); olvidarEmpaque(); };

  return (
    <Section>
      <Toolbar>
        <SectionTitle>Empaque</SectionTitle>
      </Toolbar>
      <p className="-mt-1 mb-4 flex items-start gap-2 rounded-xl border border-primary/25 bg-brand-soft/60 px-3.5 py-3 text-[13px] leading-relaxed text-primary">
        <Gift className="mt-0.5 size-4 shrink-0" />
        <span>
          Lo que se regala con cada venta, según la línea y la talla. Al vender sale marcado y se puede quitar.
          Un combo manda sobre esto: su empaque se configura en su ficha, en{' '}
          <Link to="/dashboard/combos" className="font-semibold underline underline-offset-2">Combos</Link>.
          {config && config.accesorios.length === 0 && ' Todavía no hay accesorios: créalos en Productos, marcados como accesorio.'}
        </span>
      </p>
      {fallo && <NoSePudoCargar que="el empaque" onReintentar={cargar} />}
      {cargando && !config && <PerfumeSpinner />}
      {config && (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {LINEAS.map(l => <LineaEmpaque key={l.linea} {...l} config={config} onGuardado={alGuardar} />)}
        </div>
      )}
    </Section>
  );
}
