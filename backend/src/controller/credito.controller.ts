import { Request, Response } from 'express';
import * as creditoService from '../services/credito.service';
import { mapaFiltrosCreditos } from '../repositories/credito.repository';
import { parsePagination, parseSearch } from '../utils/pagination';
import { parseFiltros } from '../utils/filtros';
import { mensajeSeguro } from '../utils/errorSeguro';
import { h } from '../middleware/error.middleware';

export const getCreditos = async (req: Request, res: Response) => {
  try {
    const { page, limit } = parsePagination(req.query);
    const result = await creditoService.getAllCreditos(
      page, limit, parseSearch(req.query), req.query.con_totales === '1',
      parseFiltros(req.query, mapaFiltrosCreditos),
    );
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: mensajeSeguro(error) });
  }
};

export const getTotales = async (_req: Request, res: Response) => {
  try {
    res.json({ data: await creditoService.getTotales() });
  } catch (error) {
    res.status(400).json({ error: mensajeSeguro(error) });
  }
};

export const addCredito = async (req: Request, res: Response) => {
  try {
    const { avisos, ...data } = await creditoService.createCredito(req.body);
    res.status(201).json({ message: 'Crédito registrado', data, avisos });
  } catch (error) {
    res.status(400).json({ error: mensajeSeguro(error) });
  }
};

export const editCredito = async (req: Request, res: Response) => {
  try {
    const { avisos, ...data } = await creditoService.updateCredito(req.params.id as string, req.body);
    res.json({ message: 'Crédito actualizado', data, avisos });
  } catch (error) {
    res.status(400).json({ error: mensajeSeguro(error) });
  }
};

// Con h(): el abono repetido responde 409 y el que no existe 404, no un 400
// genérico (ver `error.middleware`).
export const addAbono = h(async (req, res) => {
  const data = await creditoService.addAbono(req.params.id as string, Number(req.body.monto));
  res.json({ message: 'Abono registrado', data });
});

/** Devuelve el crédito como queda, para que la pantalla no tenga que volver a pedirlo. */
export const removeAbono = h(async (req, res) => {
  const data = await creditoService.deleteAbono(req.params.id as string, req.params.abonoId as string);
  res.json({ message: 'Abono eliminado', data });
});

export const removeCredito = async (req: Request, res: Response) => {
  try {
    await creditoService.deleteCredito(req.params.id as string);
    res.json({ message: 'Crédito eliminado' });
  } catch (error) {
    res.status(400).json({ error: mensajeSeguro(error) });
  }
};
