import { useEffect, useRef, useState } from 'react';
import { Download, Upload, TriangleAlert, CircleCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import Modal from './Modal';
import { http } from '../infrastructure/api/http';
import { urls } from '../infrastructure/api/urls';
import { guardarArchivo } from './useExportEntity';

interface ImportColumn {
  key: string;
  required: boolean;
  descripcion: string;
  ejemplo: string | number;
}

interface ImportSpec {
  titulo: string;
  columnas: ImportColumn[];
  notas: string[];
}

interface ImportResult {
  insertados: number;
  actualizados: number;
  omitidos: number;
  errores: string[];
  /** Mensajes informativos del backend (ej: cuántas ventas quedaron enlazadas). */
  info: string[];
}

interface ImportModalProps {
  open: boolean;
  onClose: () => void;
  /** Entidad del backend: perfumes, aromas, ocasiones, categorias, presentaciones, combos, descuentos, ventas, creditos, proveedores */
  entity: string;
  /** Se llama cuando la importacion inserto o actualizo al menos un registro. */
  onImported: () => void;
}

const headCell = 'text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground';

export default function ImportModal({ open, onClose, entity, onImported }: ImportModalProps) {
  const [spec, setSpec] = useState<ImportSpec | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setFile(null); setResult(null); setError('');
    let active = true;
    (async () => {
      const res = await http.get<{ data?: ImportSpec }>(urls.excel(entity).spec);
      if (!active) return;
      if (!res.ok) { setError(res.error); return; }
      setSpec(res.cuerpo?.data ?? null);
    })();
    return () => { active = false; };
  }, [open, entity]);

  const handleFile = (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.xlsx')) {
      setError('Solo se admiten archivos Excel (.xlsx)');
      setFile(null);
      return;
    }
    setError('');
    setFile(f);
  };

  const handleTemplate = async () => {
    setDownloading(true); setError('');
    try {
      const res = await http.descargar(urls.excel(entity).plantilla);
      if (!res.ok || !res.cuerpo) { setError(res.error || 'No se pudo descargar la plantilla'); return; }
      guardarArchivo(res.cuerpo, `plantilla_${entity}.xlsx`);
    } finally { setDownloading(false); }
  };

  const handleImport = async () => {
    if (!file) return;
    setLoading(true); setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      // Un archivo a medias responde 207: para axios es éxito (2xx), así que el
      // resumen con sus errores línea a línea llega igual y se pinta completo.
      const res = await http.subir<Partial<ImportResult>>(urls.excel(entity).importar, fd);
      if (!res.ok || !res.cuerpo) { setError(res.error || 'Error al importar el archivo'); return; }
      const j = res.cuerpo;
      setResult({
        insertados: j.insertados ?? 0,
        actualizados: j.actualizados ?? 0,
        omitidos: j.omitidos ?? 0,
        errores: j.errores ?? [],
        info: j.info ?? [],
      });
      if ((j.insertados ?? 0) > 0 || (j.actualizados ?? 0) > 0) onImported();
    } finally { setLoading(false); }
  };

  const reset = () => { setFile(null); setResult(null); setError(''); if (fileRef.current) fileRef.current.value = ''; };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={spec?.titulo ?? 'Importar desde Excel'}
      maxWidth={640}
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cerrar</Button>
          {result ? (
            <Button type="button" onClick={reset}>Importar otro archivo</Button>
          ) : (
            <Button type="button" disabled={!file || loading} onClick={handleImport}>
              {loading ? 'Importando...' : 'Importar'}
            </Button>
          )}
        </div>
      }
    >
      {result ? (
        <div className="space-y-3">
          <p className="flex items-center gap-2 font-semibold text-foreground">
            <CircleCheck className={result.errores.length ? 'size-5 text-amber-500' : 'size-5 text-emerald-600'} />
            Importacion finalizada
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="border-primary/30 bg-brand-soft text-primary">
              Insertados: {result.insertados}
            </Badge>
            {result.actualizados > 0 && (
              <Badge variant="outline" className="border-primary/30 bg-brand-soft text-primary">
                Actualizados: {result.actualizados}
              </Badge>
            )}
            {result.omitidos > 0 && (
              <Badge variant="secondary">Omitidos: {result.omitidos}</Badge>
            )}
          </div>
          {result.info.length > 0 && (
            <ul className="space-y-1 rounded-lg border border-primary/25 bg-brand-soft/60 p-3 text-[13px] text-primary">
              {result.info.map((m, i) => <li key={i}>{m}</li>)}
            </ul>
          )}
          {result.errores.length > 0 && (
            <div>
              <p className="mb-1.5 text-[13px] font-semibold text-foreground">Errores ({result.errores.length}):</p>
              <ul className="max-h-44 list-disc space-y-1 overflow-y-auto rounded-lg border border-border bg-secondary/40 p-3 pl-7 text-[13px] text-muted-foreground">
                {result.errores.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3.5">
          <p className="flex items-center gap-2 rounded-lg border border-amber-400/45 bg-amber-400/10 px-3 py-2 text-[13px] font-semibold text-amber-700">
            <TriangleAlert className="size-4 shrink-0" /> Solo se admiten archivos Excel (.xlsx)
          </p>

          <p className="text-[13px] text-muted-foreground">
            El archivo debe tener una fila de encabezados con estas columnas (la primera hoja del libro):
          </p>

          {spec ? (
            <>
              {/* Móvil: tarjetas apiladas (la tabla no cabe en pantallas pequeñas) */}
              <div className="max-h-64 space-y-2 overflow-y-auto sm:hidden">
                {spec.columnas.map(c => (
                  <div key={c.key} className="rounded-lg border border-border bg-secondary/30 p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[12.5px] font-semibold text-foreground">{c.key}</span>
                      {c.required ? (
                        <Badge variant="outline" className="border-primary/30 bg-brand-soft text-primary">
                          Obligatoria
                        </Badge>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">Opcional</span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{c.descripcion}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground/70">Ej: {String(c.ejemplo)}</p>
                  </div>
                ))}
              </div>

              {/* Escritorio: tabla */}
              <div className="hidden max-h-64 overflow-auto rounded-xl border border-border sm:block">
                <Table>
                  <TableHeader className="sticky top-0 bg-secondary">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className={headCell}>Columna</TableHead>
                      <TableHead className={headCell}>Obligatoria</TableHead>
                      <TableHead className={headCell}>Descripcion</TableHead>
                      <TableHead className={headCell}>Ejemplo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {spec.columnas.map(c => (
                      <TableRow key={c.key} className="text-[12.5px]">
                        <TableCell className="font-mono font-semibold text-foreground">{c.key}</TableCell>
                        <TableCell>
                          {c.required
                            ? <Badge variant="outline" className="border-primary/30 bg-brand-soft text-primary">Si *</Badge>
                            : <span className="text-muted-foreground">No</span>}
                        </TableCell>
                        <TableCell className="min-w-40 whitespace-normal text-muted-foreground">{c.descripcion}</TableCell>
                        <TableCell className="max-w-40 whitespace-normal wrap-break-word text-muted-foreground/80">{String(c.ejemplo)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {spec.notas.length > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                  {spec.notas.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              )}
            </>
          ) : (
            <p className="text-[13px] text-muted-foreground">Cargando estructura...</p>
          )}

          <Button type="button" variant="outline" size="sm" onClick={handleTemplate} disabled={downloading || !spec}>
            <Download className="size-4" /> {downloading ? 'Descargando...' : 'Descargar plantilla'}
          </Button>

          <div
            className="flex min-h-20 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border p-4 text-center text-[13px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            onClick={() => fileRef.current?.click()}
          >
            {file ? (
              <span className="inline-flex items-center gap-2">
                <Upload className="size-4" /> {file.name}
                <span className="opacity-60">(clic para cambiar)</span>
              </span>
            ) : (
              '📁 Haz clic para seleccionar tu archivo Excel (.xlsx)'
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={e => handleFile(e.target.files)}
          />

          {error && <p className="text-[13px] font-medium text-destructive">{error}</p>}
        </div>
      )}
    </Modal>
  );
}
