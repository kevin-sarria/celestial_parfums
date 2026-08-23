import { Request, Response } from 'express';
import * as perfumeService from '../services/perfume.service';
import { mapaFiltrosPerfumes } from '../repositories/perfume.repository';
import { parsePagination, parseSearch } from '../utils/pagination';
import { parseFiltros } from '../utils/filtros';
import { mensajeSeguro } from '../utils/errorSeguro';
import { esAdminRequest } from '../middleware/auth.middleware';
import { traerImagenRemota } from '../utils/imagenRemota';

export const getRelatedPerfumes = async (req: Request, res: Response) => {
  try {
    const data = await perfumeService.getRelatedPerfumes(req.params.slug as string);
    res.status(200).json({ data });
  } catch (error) {
    res.status(404).json({ error: mensajeSeguro(error) });
  }
};

export const getDestacados = async (_req: Request, res: Response) => {
  try {
    const data = await perfumeService.getDestacados();
    res.json({ data });
  } catch (error) {
    res.status(400).json({ error: mensajeSeguro(error) });
  }
};

export const getPerfumeBySlug = async (req: Request, res: Response) => {
  try {
    const data = await perfumeService.getPerfumeBySlug(req.params.slug as string);
    res.status(200).json({ data });
  } catch (error) {
    res.status(404).json({ error: mensajeSeguro(error) });
  }
};

/** Lista separada por comas saneada (máx. 20 valores). */
const parseLista = (v: unknown): string[] | undefined => {
  if (typeof v !== 'string' || !v.trim()) return undefined;
  const items = v.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 20);
  return items.length ? items : undefined;
};

export const selectAllPerfumes = async (req: Request, res: Response) => {
  try {
    if (req.query.page) {
      const { page, limit } = parsePagination(req.query as any);
      const generoRaw = typeof req.query.genero === 'string' ? req.query.genero : '';
      const ordenRaw = typeof req.query.sort === 'string' ? req.query.sort : '';
      const ordenes = ['destacados', 'precio_asc', 'precio_desc', 'nombre'];
      const result = await perfumeService.allPerfumesPaginated(page, limit, parseSearch(req.query as any), {
        genero: ['dama', 'caballero', 'unisex'].includes(generoRaw) ? (generoRaw as 'dama' | 'caballero' | 'unisex') : undefined,
        categorias: parseLista(req.query.categorias),
        aromas: parseLista(req.query.aromas),
        ocasiones: parseLista(req.query.ocasiones),
        orden: ordenes.includes(ordenRaw) ? (ordenRaw as any) : undefined,
      }, req.query.todos === '1' && esAdminRequest(req), parseFiltros(req.query as any, mapaFiltrosPerfumes));
      res.json(result);
    } else {
      // `?todos=1` trae también los que están fuera de la tienda. Se honra SOLO
      // si quien pregunta es el admin: si no, cualquiera podría listar lo que el
      // dueño sacó del catálogo con solo agregar el parámetro a la URL.
      const todos = req.query.todos === '1' && esAdminRequest(req);
      const result = await perfumeService.allPerfumes(todos);
      res.status(200).json({ message: 'Datos Encontrados Correctamente', data: result });
    }
  } catch (error) {
    res.status(400).json({ error: mensajeSeguro(error) });
  }
};

export const createPerfume = async (req: Request, res: Response) => {
  try {
    const result = await perfumeService.createPerfume(req.body);
    res.status(201).json({ message: 'Perfume creado correctamente', data: result });
  } catch (error) {
    res.status(400).json({ error: mensajeSeguro(error) });
  }
};

export const editPerfume = async (req: Request, res: Response) => {
  try {
    const result = await perfumeService.editPerfume(req.params.id as string, req.body);
    res.status(200).json({ message: 'Perfume actualizado correctamente', data: result });
  } catch (error) {
    res.status(400).json({ error: mensajeSeguro(error) });
  }
};

export const deletePerfume = async (req: Request, res: Response) => {
  try {
    await perfumeService.deletePerfume(req.params.id as string);
    res.status(200).json({ message: 'Perfume eliminado correctamente' });
  } catch (error) {
    res.status(400).json({ error: mensajeSeguro(error) });
  }
};

export const patchDescuentoPerfume = async (req: Request, res: Response) => {
  try {
    await perfumeService.patchDescuentoPerfume(req.params.id as string, Number(req.body.descuento));
    res.json({ message: 'Descuento actualizado' });
  } catch (error) {
    res.status(400).json({ error: mensajeSeguro(error) });
  }
};

export const patchDescuentoCategoria = async (req: Request, res: Response) => {
  try {
    const count = await perfumeService.patchDescuentoPorCategoria(
      Number(req.body.categoria_id),
      Number(req.body.descuento),
    );
    res.json({ message: `Descuento aplicado a ${count} perfumes`, count });
  } catch (error) {
    res.status(400).json({ error: mensajeSeguro(error) });
  }
};

export const patchEsenciaMasiva = async (req: Request, res: Response) => {
  try {
    const count = await perfumeService.asignarEsenciaMasiva(
      req.body.perfume_ids as number[],
      req.body.insumo_esencia_id as number | null,
    );
    const quita = req.body.insumo_esencia_id === null;
    res.json({
      message: quita
        ? `Esencia quitada a ${count} ${count === 1 ? 'perfume' : 'perfumes'}`
        : `Esencia asignada a ${count} ${count === 1 ? 'perfume' : 'perfumes'}`,
      count,
    });
  } catch (error) {
    res.status(400).json({ error: mensajeSeguro(error) });
  }
};

export const getSugerenciasEsencia = async (_req: Request, res: Response) => {
  try {
    res.json({ data: await perfumeService.sugerirEsencias() });
  } catch (error) {
    res.status(400).json({ error: mensajeSeguro(error) });
  }
};

export const patchEnlacesEsencia = async (req: Request, res: Response) => {
  try {
    const count = await perfumeService.aplicarEnlacesEsencia(req.body.enlaces);
    res.json({ message: `Esencia asignada a ${count} ${count === 1 ? 'perfume' : 'perfumes'}`, count });
  } catch (error) {
    res.status(400).json({ error: mensajeSeguro(error) });
  }
};

/** Qué esencias no tienen perfume y con cuál podrían emparejarse. Solo PROPONE. */
export const getEmparejarEsencias = async (_req: Request, res: Response) => {
  try {
    res.json({ data: await perfumeService.proponerEmparejamientos() });
  } catch (error) {
    res.status(400).json({ error: mensajeSeguro(error) });
  }
};

export const postEmparejarEsencias = async (req: Request, res: Response) => {
  try {
    const r = await perfumeService.aplicarEmparejamientos(req.body.acciones);
    const partes = [];
    if (r.enlazados) partes.push(`${r.enlazados} enlazada(s) con su perfume`);
    if (r.creados) partes.push(`${r.creados} perfume(s) creado(s) fuera de la tienda`);
    res.json({
      message: partes.length ? partes.join(' y ') : 'No se aplicó ningún cambio',
      data: r,
    });
  } catch (error) {
    res.status(400).json({ error: mensajeSeguro(error) });
  }
};

export const patchAgotadoPerfume = async (req: Request, res: Response) => {
  try {
    await perfumeService.patchAgotadoPerfume(req.params.id as string, Boolean(req.body.agotado));
    res.json({ message: 'Estado de stock actualizado' });
  } catch (error) {
    res.status(400).json({ error: mensajeSeguro(error) });
  }
};

export const patchPublicadoPerfume = async (req: Request, res: Response) => {
  try {
    const publicado = Boolean(req.body.publicado);
    await perfumeService.patchPublicadoPerfume(req.params.id as string, publicado);
    res.json({ message: publicado ? 'El perfume volvió a la tienda' : 'El perfume salió de la tienda' });
  } catch (error) {
    res.status(400).json({ error: mensajeSeguro(error) });
  }
};

/**
 * Sirve una imagen de otro sitio desde NUESTRO dominio.
 *
 * Lo pide el catálogo en PDF: las fotos que son enlaces externos no se podían
 * imprimir porque el navegador exige permiso CORS para copiarlas a un lienzo y
 * esos sitios no lo dan. Al pasar por aquí, el navegador las ve como propias.
 * Solo admin, y con los candados anti-SSRF de `traerImagenRemota`.
 */
export const getImagenProxy = async (req: Request, res: Response) => {
  try {
    const url = typeof req.query.url === 'string' ? req.query.url : '';
    if (!url) { res.status(400).json({ error: 'Falta la dirección de la imagen' }); return; }
    const { cuerpo, tipo } = await traerImagenRemota(url);
    // Se cachea: generar el catálogo dos veces no debe volver a bajar 212 fotos
    res.setHeader('Content-Type', tipo);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.send(cuerpo);
  } catch (error) {
    res.status(400).json({ error: mensajeSeguro(error) });
  }
};

export const getResumenPublicacion = async (_req: Request, res: Response) => {
  try {
    res.json({ data: await perfumeService.resumenPublicacion() });
  } catch (error) {
    res.status(400).json({ error: mensajeSeguro(error) });
  }
};

export const getAromas = async (_req: Request, res: Response) => {
  try {
    const data = await perfumeService.getAllAromas();
    res.status(200).json({ data });
  } catch (error) {
    res.status(400).json({ error: mensajeSeguro(error) });
  }
};

export const addAroma = async (req: Request, res: Response) => {
  try {
    const id = await perfumeService.createAroma(req.body.nombre);
    res.status(201).json({ message: 'Aroma creado', data: { id } });
  } catch (error) {
    res.status(400).json({ error: mensajeSeguro(error) });
  }
};

export const removeAroma = async (req: Request, res: Response) => {
  try {
    await perfumeService.deleteAroma(req.params.id as string);
    res.status(200).json({ message: 'Aroma eliminado' });
  } catch (error) {
    res.status(400).json({ error: mensajeSeguro(error) });
  }
};

export const editAroma = async (req: Request, res: Response) => {
  try {
    await perfumeService.updateAroma(req.params.id as string, req.body.nombre);
    res.status(200).json({ message: 'Aroma actualizado' });
  } catch (error) {
    res.status(400).json({ error: mensajeSeguro(error) });
  }
};

export const getOcasiones = async (_req: Request, res: Response) => {
  try {
    const data = await perfumeService.getAllOcasiones();
    res.status(200).json({ data });
  } catch (error) {
    res.status(400).json({ error: mensajeSeguro(error) });
  }
};

export const addOcasion = async (req: Request, res: Response) => {
  try {
    const id = await perfumeService.createOcasion(req.body.nombre);
    res.status(201).json({ message: 'Ocasión creada', data: { id } });
  } catch (error) {
    res.status(400).json({ error: mensajeSeguro(error) });
  }
};

export const removeOcasion = async (req: Request, res: Response) => {
  try {
    await perfumeService.deleteOcasion(req.params.id as string);
    res.status(200).json({ message: 'Ocasión eliminada' });
  } catch (error) {
    res.status(400).json({ error: mensajeSeguro(error) });
  }
};

export const editOcasion = async (req: Request, res: Response) => {
  try {
    await perfumeService.updateOcasion(req.params.id as string, req.body.nombre);
    res.status(200).json({ message: 'Ocasión actualizada' });
  } catch (error) {
    res.status(400).json({ error: mensajeSeguro(error) });
  }
};

export const getCategorias = async (_req: Request, res: Response) => {
  try {
    const data = await perfumeService.getAllCategorias();
    res.status(200).json({ data });
  } catch (error) {
    res.status(400).json({ error: mensajeSeguro(error) });
  }
};

export const addCategoria = async (req: Request, res: Response) => {
  try {
    const id = await perfumeService.createCategoria(req.body.nombre);
    res.status(201).json({ message: 'Categoría creada', data: { id } });
  } catch (error) {
    res.status(400).json({ error: mensajeSeguro(error) });
  }
};

export const removeCategoria = async (req: Request, res: Response) => {
  try {
    // ?mover_a=<id> — a dónde pasan sus perfumes (obligatorio si la usa alguno)
    const destino = req.query.mover_a as string | undefined;
    const { movidos } = await perfumeService.deleteCategoria(req.params.id as string, destino);
    res.status(200).json({
      message: movidos > 0
        ? `Categoría eliminada y ${movidos} perfume(s) movidos`
        : 'Categoría eliminada',
    });
  } catch (error) {
    res.status(400).json({ error: mensajeSeguro(error) });
  }
};

export const editCategoria = async (req: Request, res: Response) => {
  try {
    await perfumeService.updateCategoria(req.params.id as string, req.body.nombre);
    res.status(200).json({ message: 'Categoría actualizada' });
  } catch (error) {
    res.status(400).json({ error: mensajeSeguro(error) });
  }
};

export const getPrecios = async (_req: Request, res: Response) => {
  try {
    const data = await perfumeService.getPrecios();
    res.status(200).json({ data });
  } catch (error) {
    res.status(400).json({ error: mensajeSeguro(error) });
  }
};

export const putPrecio = async (req: Request, res: Response) => {
  try {
    const { categoria_id, presentacion_id, precio } = req.body;
    const data = await perfumeService.setPrecioLista(categoria_id, presentacion_id, precio ?? null);
    res.status(200).json({ message: 'Precio actualizado', data });
  } catch (error) {
    res.status(400).json({ error: mensajeSeguro(error) });
  }
};

export const getPresentaciones = async (_req: Request, res: Response) => {
  try {
    const data = await perfumeService.getAllPresentaciones();
    res.status(200).json({ data });
  } catch (error) {
    res.status(400).json({ error: mensajeSeguro(error) });
  }
};

export const addPresentacion = async (req: Request, res: Response) => {
  try {
    const id = await perfumeService.createPresentacion(req.body.nombre);
    res.status(201).json({ message: 'Presentación creada', data: { id } });
  } catch (error) {
    res.status(400).json({ error: mensajeSeguro(error) });
  }
};

export const removePresentacion = async (req: Request, res: Response) => {
  try {
    await perfumeService.deletePresentacion(req.params.id as string);
    res.status(200).json({ message: 'Presentación eliminada' });
  } catch (error) {
    res.status(400).json({ error: mensajeSeguro(error) });
  }
};

export const editPresentacion = async (req: Request, res: Response) => {
  try {
    await perfumeService.updatePresentacion(req.params.id as string, req.body.nombre);
    res.status(200).json({ message: 'Presentación actualizada' });
  } catch (error) {
    res.status(400).json({ error: mensajeSeguro(error) });
  }
};
