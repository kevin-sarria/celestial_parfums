import { Router } from 'express';
import * as repo from '../repositories/favorito.repository';
import { requireAuth } from '../middleware/auth.middleware';
import { h } from '../middleware/error.middleware';
import { badRequest } from '../utils/httpError';

export const favoritoRouter = Router();

/** IDs favoritos del cliente (para pintar los corazones). */
favoritoRouter.get('/', requireAuth, h(async (req, res) => {
  res.json({ data: await repo.idsFavoritos(req.jwtUser!.id) });
}));

/** Perfumes favoritos completos (página "Mis favoritos"). */
favoritoRouter.get('/detalle', requireAuth, h(async (req, res) => {
  res.json({ data: await repo.perfumesFavoritos(req.jwtUser!.id) });
}));

/** Marca/desmarca un perfume como favorito. */
favoritoRouter.post('/:perfumeId', requireAuth, h(async (req, res) => {
  const perfumeId = Number(req.params.perfumeId);
  if (!perfumeId) throw badRequest('Perfume inválido');
  res.json({ data: await repo.toggleFavorito(req.jwtUser!.id, perfumeId) });
}));
