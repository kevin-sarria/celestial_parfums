import { Router } from 'express';
import {
  getContacto,
  getContactoAdmin,
  saveContactoConfig,
  uploadContactoAvatar,
  uploadContactoFondo,
  addContactoLink,
  editContactoLink,
  removeContactoLink,
  reorderContactoLinks,
  exportContacto,
  importContacto,
} from '../controller/contacto.controller';
import { upload } from '../config/upload';
import { requireAdmin } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  contactoConfigSchema,
  createContactoLinkSchema,
  reorderContactoLinksSchema,
  contactoImportSchema,
} from '../schemas/contacto.schema';

export const contactoRouter = Router();

// Public read endpoint (página Contáctame del catálogo)
contactoRouter.get('/', getContacto);

// Admin-only endpoints
contactoRouter.get('/admin', requireAdmin, getContactoAdmin);
contactoRouter.patch('/config', requireAdmin, validate(contactoConfigSchema), saveContactoConfig);
contactoRouter.post('/avatar', requireAdmin, upload.single('image'), uploadContactoAvatar);
contactoRouter.post('/fondo', requireAdmin, upload.single('image'), uploadContactoFondo);
contactoRouter.get('/export', requireAdmin, exportContacto);
contactoRouter.post('/import', requireAdmin, validate(contactoImportSchema), importContacto);
contactoRouter.post('/links', requireAdmin, validate(createContactoLinkSchema), addContactoLink);
contactoRouter.post('/links/reorder', requireAdmin, validate(reorderContactoLinksSchema), reorderContactoLinks);
contactoRouter.patch('/links/:id', requireAdmin, validate(createContactoLinkSchema), editContactoLink);
contactoRouter.delete('/links/:id', requireAdmin, removeContactoLink);
