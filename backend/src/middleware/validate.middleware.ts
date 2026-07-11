import { Request, Response, NextFunction } from 'express';
import { z } from 'zod/v4';

export const validate = (schema: z.ZodType) =>
  (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const firstError = result.error.issues[0]?.message ?? 'Datos inválidos';
      res.status(400).json({ error: firstError });
      return;
    }
    req.body = result.data;
    next();
  };
