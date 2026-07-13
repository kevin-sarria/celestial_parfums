import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';

type PasswordInputProps = Omit<React.ComponentProps<'input'>, 'type'>;

/** Input de contraseña con botón para mostrar/ocultar. */
export function PasswordInput(props: PasswordInputProps) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <Input type={show ? 'text' : 'password'} className="pr-10" {...props} />
      <button
        type="button"
        tabIndex={-1}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
        onClick={() => setShow(v => !v)}
        aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}
