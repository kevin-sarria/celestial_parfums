import type { Lookup } from '../../types';

/**
 * Grupo de checkboxes para relaciones (aromas, ocasiones, presentaciones).
 *
 * Salió de `PerfumesTab.tsx` (iba en 547 líneas). No sabe nada de perfumes: se
 * le dan las opciones y las marcadas, y avisa cuál se tocó.
 */
interface CheckGroupProps {
  items: Lookup[];
  selected: number[];
  onToggle: (id: number) => void;
}

export function CheckGroup({ items, selected, onToggle }: CheckGroupProps) {
  return (
    <div className="grid max-h-36 grid-cols-2 gap-x-3 gap-y-1 overflow-y-auto rounded-lg border border-border bg-secondary/30 p-2.5">
      {items.map(item => (
        <label
          key={item.id}
          className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-[13px] text-foreground transition-colors hover:bg-secondary"
        >
          <input
            type="checkbox"
            className="accent-primary"
            checked={selected.includes(item.id)}
            onChange={() => onToggle(item.id)}
          />
          {item.nombre}
        </label>
      ))}
    </div>
  );
}
