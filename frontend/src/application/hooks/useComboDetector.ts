import { useEffect, useMemo, useState } from 'react';
import type { CartItem } from '../context/CartContext';
import type { Combo } from '../../domain/entities/combo.schema';
import { BASE_URL } from '../../infrastructure/api/client';
import { finalPrice } from '@/lib/format';

/** Un combo del catálogo armado automáticamente con los perfumes del carrito. */
export interface ComboDetectado {
  comboId: number;
  nombre: string;
  /** Cuántas veces se arma este combo con lo que hay en el carrito. */
  veces: number;
  unidades: number;
  categoria: string;
  presentacion: string;
  /** Lo que valdrían esas unidades sueltas vs. el precio del combo. */
  precioIndividual: number;
  precioCombo: number;
  ahorro: number;
}

/** Combo que está a 1-2 perfumes de armarse: empujón de venta en el carrito. */
export interface ComboSugerido {
  nombre: string;
  categoria: string;
  presentacion: string;
  faltan: number;
}

export interface DeteccionCombos {
  detectados: ComboDetectado[];
  /** Unidades de cada item ya cubiertas por un combo (no reciben cupón). */
  consumidas: Map<string, number>;
  ahorroTotal: number;
  sugerencias: ComboSugerido[];
}

/**
 * Detección automática de combos: si el carrito junta N perfumes sueltos de la
 * misma categoría y presentación que un combo del catálogo, el pedido se cobra
 * al precio del combo (solo si sale más barato). Los perfumes con descuento
 * propio no entran: los descuentos jamás se acumulan.
 */
export function detectarCombos(items: CartItem[], combos: Combo[]): DeteccionCombos {
  const detectados: ComboDetectado[] = [];
  const consumidas = new Map<string, number>();
  const sugerencias: ComboSugerido[] = [];

  // Perfumes sueltos sin descuento propio, agrupados por categoría+presentación
  const grupos = new Map<string, CartItem[]>();
  for (const item of items) {
    if (item.esCombo || item.descuento > 0) continue;
    const key = `${item.tipo}||${item.presentacion}`;
    grupos.set(key, [...(grupos.get(key) ?? []), item]);
  }

  for (const [key, grupo] of grupos) {
    const [categoria, presentacion] = key.split('||');
    // Unidades sueltas, las más caras primero (el combo cubre las de mayor valor)
    const unidades = grupo
      .flatMap((i) => Array.from({ length: i.cantidad }, () => ({ itemId: i.id, precio: i.precio })))
      .sort((a, b) => b.precio - a.precio);

    const candidatos = combos
      .filter(
        (c) =>
          c.activo &&
          c.categoria === categoria &&
          (c.presentacion == null || c.presentacion === presentacion) &&
          c.cantidad >= 2,
      )
      .sort((a, b) => b.cantidad - a.cantidad); // primero el combo más grande

    for (const combo of candidatos) {
      const precioCombo = finalPrice(combo.precio, combo.descuento);
      let veces = 0;
      let precioIndividual = 0;
      while (unidades.length >= combo.cantidad) {
        const tomadas = unidades.slice(0, combo.cantidad);
        const suelto = tomadas.reduce((s, u) => s + u.precio, 0);
        // Solo se arma si el combo es mejor precio para el cliente
        if (precioCombo >= suelto) break;
        unidades.splice(0, combo.cantidad);
        for (const u of tomadas) consumidas.set(u.itemId, (consumidas.get(u.itemId) ?? 0) + 1);
        veces++;
        precioIndividual += suelto;
      }
      if (veces > 0) {
        detectados.push({
          comboId: combo.id,
          nombre: combo.nombre,
          veces,
          unidades: veces * combo.cantidad,
          categoria,
          presentacion,
          precioIndividual,
          precioCombo: precioCombo * veces,
          ahorro: precioIndividual - precioCombo * veces,
        });
      }
    }

    // Empujón de venta: si con 1-2 perfumes más se arma un combo, se sugiere.
    // Se ofrece el combo más pequeño alcanzable con las unidades sueltas restantes.
    if (unidades.length > 0) {
      const alcanzable = [...candidatos]
        .sort((a, b) => a.cantidad - b.cantidad)
        .find((c) => c.cantidad > unidades.length && c.cantidad - unidades.length <= 2);
      if (alcanzable) {
        sugerencias.push({
          nombre: alcanzable.nombre,
          categoria,
          presentacion,
          faltan: alcanzable.cantidad - unidades.length,
        });
      }
    }
  }

  return {
    detectados,
    consumidas,
    ahorroTotal: detectados.reduce((s, d) => s + d.ahorro, 0),
    sugerencias,
  };
}

/** Combos activos del catálogo + detección sobre los items del carrito. */
export function useComboDetector(items: CartItem[], habilitado: boolean) {
  const [combos, setCombos] = useState<Combo[]>([]);

  useEffect(() => {
    if (!habilitado || combos.length > 0) return;
    const ac = new AbortController();
    fetch(`${BASE_URL}/api/combos`, { signal: ac.signal })
      .then((r) => r.json())
      .then((json) => setCombos(((json.data ?? []) as Combo[]).filter((c) => c.activo)))
      .catch(() => {}); // sin combos no hay detección, el carrito sigue normal
    return () => ac.abort();
  }, [habilitado, combos.length]);

  return useMemo(() => detectarCombos(items, combos), [items, combos]);
}
