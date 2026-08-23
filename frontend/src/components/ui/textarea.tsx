import * as React from "react"

import { useIdDeCampo } from "@/components/ui/campoEtiqueta"
import { cn } from "@/lib/utils"

function Textarea({ className, id, ...props }: React.ComponentProps<"textarea">) {
  // Se enlaza solo con la etiqueta de su `Field`, si es que está dentro de uno.
  const idCampo = useIdDeCampo(id)

  return (
    <textarea
      id={idCampo}
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
