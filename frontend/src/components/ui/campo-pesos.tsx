import * as React from "react"

import { Input } from "@/components/ui/input"

/** Solo los dígitos de lo que se escribió: "17.000", "$17,000" y "17000" son 17000. */
export const digitosDePesos = (texto: string) => texto.replace(/\D/g, "")

/**
 * Lo que llega en `value`. Lo que escribe el dueño ya entra como dígitos (el
 * `onChange` los limpia), así que un punto aquí solo puede venir de los DATOS:
 * un número de JS o un decimal de la base ("64098.02", "22000.00"). Ese punto
 * es decimal, no de miles: se redondea. Leerlo como miles mostraría 6.409.802.
 */
export const digitosDeValor = (value: string | number | null | undefined) => {
  if (value == null || value === "") return ""
  if (typeof value === "number") return Number.isFinite(value) ? String(Math.round(value)) : ""
  return /^\d+(\.\d+)?$/.test(value) ? String(Math.round(Number(value))) : digitosDePesos(value)
}

/** "17000" → "17.000", como se escriben los pesos en Colombia. */
const conPuntos = (digitos: string) => digitos.replace(/\B(?=(\d{3})+(?!\d))/g, ".")

/**
 * Casilla para PESOS. Existe porque `<input type="number">` lee el punto como
 * decimal: el dueño escribía "17.000" y se guardaban $17 (2026-10-08). Aquí el
 * punto, la coma y el signo $ se ignoran, y lo escrito se muestra con puntos
 * de miles.
 *
 * Misma forma que un `<input>` (como `CampoFecha`): `onChange` recibe
 * `e.target.value` con SOLO los dígitos ("" si está vacía), así que cambiar
 * `<Input type="number">` por `<CampoPesos>` no obliga a tocar el manejador.
 * Solo pesos enteros: un costo por ml con decimales sigue en su casilla numérica.
 */
function CampoPesos({ value, onChange, ...props }: Omit<React.ComponentProps<"input">, "type" | "value" | "onChange" | "step"> & {
  value: string | number | null | undefined
  onChange: (e: { target: { value: string } }) => void
}) {
  const digitos = digitosDeValor(value)
  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={conPuntos(digitos)}
      onChange={(e) => onChange({ target: { value: digitosDePesos(e.target.value) } })}
    />
  )
}

export { CampoPesos }
