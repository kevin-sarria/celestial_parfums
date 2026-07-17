import { Request, Response } from 'express';
import * as contactoService from '../services/contacto.service';
import { getPublicBaseUrl } from '../utils/publicUrl';

export const getContacto = async (_req: Request, res: Response) => {
  try {
    const data = await contactoService.getPublicContacto();
    res.json({ data });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const getContactoAdmin = async (_req: Request, res: Response) => {
  try {
    const data = await contactoService.getAdminContacto();
    res.json({ data });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const saveContactoConfig = async (req: Request, res: Response) => {
  try {
    await contactoService.saveConfig(req.body);
    res.json({ message: 'Configuración guardada' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const uploadContactoAvatar = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No se recibió archivo' });
      return;
    }
    const url = await contactoService.updateAvatar(req.file.filename, getPublicBaseUrl(req));
    res.json({ message: 'Avatar actualizado', data: { url } });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const addContactoLink = async (req: Request, res: Response) => {
  try {
    const id = await contactoService.createLink(req.body);
    res.status(201).json({ message: 'Link creado', data: { id } });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const editContactoLink = async (req: Request, res: Response) => {
  try {
    await contactoService.updateLink(String(req.params.id), req.body);
    res.json({ message: 'Link actualizado' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const removeContactoLink = async (req: Request, res: Response) => {
  try {
    await contactoService.deleteLink(String(req.params.id));
    res.json({ message: 'Link eliminado' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const exportContacto = async (_req: Request, res: Response) => {
  try {
    const data = await contactoService.exportContacto();
    res.setHeader('Content-Disposition', 'attachment; filename="contacto_config.json"');
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(data, null, 2));
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const importContacto = async (req: Request, res: Response) => {
  try {
    const result = await contactoService.importContacto(req.body);
    res.json({ message: `Configuración importada (${result.links} links)` });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const reorderContactoLinks = async (req: Request, res: Response) => {
  try {
    await contactoService.reorderLinks(req.body.ids);
    res.json({ message: 'Orden actualizado' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};
