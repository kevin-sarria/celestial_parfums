import { beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { prisma } from '../config/prisma';
import { limpiarBase } from '../test/baseDePrueba';
import { registroCambios } from './registroCambios';

/**
 * El middleware de punta a punta, con un servidor mínimo: se escribe solo si
 * el cambio salió bien, solo para el panel, y con el nombre de quien lo hizo.
 */
const servidor = (rol_id: number, id: number) => {
  const app = express();
  app.use(express.json());
  app.use('/api', registroCambios);
  // Lo que en la app real pone `requireAdmin`
  app.use((req, _res, next) => { req.jwtUser = { id, email: 'dueno@x.co', rol_id }; next(); });
  app.patch('/api/parfums/:id', (_req, res) => { res.json({ ok: true }); });
  app.delete('/api/ventas/:id', (_req, res) => { res.status(400).json({ error: 'no' }); });
  return new Promise<string>((listo) => {
    const s = app.listen(0, () => listo(`http://127.0.0.1:${(s.address() as AddressInfo).port}`));
  });
};

const esperarFilas = async (n: number) => {
  for (let i = 0; i < 40; i++) {
    if ((await prisma.registroCambio.count()) >= n) return;
    await new Promise((r) => setTimeout(r, 50));
  }
};

describe('el historial de cambios, de punta a punta', () => {
  beforeEach(limpiarBase);

  it('anota lo que el dueño cambió, con su nombre y sin la contraseña', async () => {
    const rol = await prisma.role.create({ data: { id: 1, nombre: 'admin' } });
    const dueno = await prisma.user.create({ data: { nombre: 'Kevin', apellido: 'Sarria', email: 'k@x.co', password: 'x', rol_id: rol.id } });
    const url = await servidor(1, dueno.id);

    await fetch(`${url}/api/parfums/12`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: 'Khamrah', precio: 60000, password: 'secreta' }),
    });
    await esperarFilas(1);

    const fila = await prisma.registroCambio.findFirstOrThrow();
    expect(fila).toMatchObject({ usuario: 'Kevin Sarria', modulo: 'Catálogo', resumen: 'Editó en Catálogo #12 · Khamrah' });
    expect(fila.datos).toEqual({ nombre: 'Khamrah', precio: 60000 });
  });

  it('no anota lo que el servidor rechazó, ni lo que hace un cliente', async () => {
    const urlDueno = await servidor(1, 1);
    await fetch(`${urlDueno}/api/ventas/5`, { method: 'DELETE' });
    const urlCliente = await servidor(2, 2);
    await fetch(`${urlCliente}/api/parfums/12`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    await new Promise((r) => setTimeout(r, 300));
    expect(await prisma.registroCambio.count()).toBe(0);
  });
});
