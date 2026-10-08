import * as React from "react"

import { Input } from "@/components/ui/input"

/** Solo los dígitos de lo que se escribió: "17.000", "$17,000" y "17000" son 17000. */
export const digitosDePesos = (texto: string) => texto.replace(/\D/g, "")

/** "17000" → "17.000", como se escriben los pesos en Colombia. */
const conPuntos = (digitos: string) => digitos.replace(/\B(?=(\d{3})+(?!\d))/g, ".")

/**
 * Casilla para PESOS. Existe porque `<input type="number">` lee el punto como
 * decimal: el dueño escribía "17.000" y se guardaban $17 (2026-10-08). Aquí el
 * punto, la coma y el signo $ se ignoran, y lo escrito se muestra con puntos
 * de miles. `onValor` recibe solo los dígitos ("" si está vacía).
 */
function CampoPesos({ value, onValor, ...props }: Omit<React.ComponentProps<"input">, "type" | "value" | "onChange"> & {
  value: string | number | null | undefined
  onValor: (digitos: string) => void
}) {
  const digitos = digitosDePesos(String(value ?? ""))
  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={conPuntos(digitos)}
      onChange={(e) => onValor(digitosDePesos(e.target.value))}
    />
  )
}

export { CampoPesos }
