import { z } from 'zod';

/**
 * Los casos en los que el panel manda un WhatsApp.
 *
 * Uno nuevo se agrega AQUÍ y en la pantalla. Hoy solo el cobro, que es el que
 * hacía falta: el 2026-10-04 el dueño tenía **$1.059.500 en la calle** y ningún
 * sitio donde escribir el mensaje —los textos vivían dentro del código—.
 */
export const CASOS_MENSAJE = ['credito'] as const;
export type CasoMensaje = (typeof CASOS_MENSAJE)[number];

export const plantillaMensajeSchema = z.object({
  caso: z.enum(CASOS_MENSAJE),
  nombre: z.string().trim().min(1, 'Ponle un nombre para reconocerla').max(60),
  /**
   * El mensaje tal como lo escribe él. Los marcadores (`{nombre}`, `{saldo}`,
   * `{vence}`, `{fecha}`) los reemplaza el panel al abrir WhatsApp; aquí no se
   * validan a propósito: si escribe uno que no existe, la vista previa se lo
   * muestra tal cual y lo corrige sin que el servidor le estorbe.
   */
  texto: z.string().trim().min(1, 'El mensaje no puede quedar vacío').max(1000),
  orden: z.number().int().min(0).max(999).optional(),
});

export type PlantillaMensajeInput = z.infer<typeof plantillaMensajeSchema>;
