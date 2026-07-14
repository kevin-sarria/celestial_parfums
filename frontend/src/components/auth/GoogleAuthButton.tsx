import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BASE_URL } from '../../infrastructure/api/client';
import { useAuthContext } from '../../application/context/useAuthContext';
import type { AuthUser } from '../../domain/entities/auth.schema';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const GSI_SRC = 'https://accounts.google.com/gsi/client';

interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleIdentity {
  accounts: {
    id: {
      initialize: (config: {
        client_id: string;
        callback: (res: GoogleCredentialResponse) => void;
      }) => void;
      renderButton: (
        parent: HTMLElement,
        options: Record<string, unknown>,
      ) => void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

/** Carga el script de Google Identity Services una sola vez. */
function loadGsiScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const existing = document.getElementById('gsi-script') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('No se pudo cargar Google')));
      return;
    }
    const script = document.createElement('script');
    script.id = 'gsi-script';
    script.src = GSI_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('No se pudo cargar Google'));
    document.head.appendChild(script);
  });
}

interface Props {
  /** Texto del botón: 'signin_with' | 'signup_with' | 'continue_with'. */
  text?: 'signin_with' | 'signup_with' | 'continue_with';
  onError?: (message: string) => void;
}

/**
 * Botón oficial "Continuar con Google". Verifica el ID token en el backend,
 * que crea o reutiliza la cuenta y devuelve las mismas cookies de sesión.
 */
export function GoogleAuthButton({ text = 'continue_with', onError }: Props) {
  const navigate = useNavigate();
  const auth = useAuthContext();
  const containerRef = useRef<HTMLDivElement>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (!CLIENT_ID) {
      setUnavailable(true);
      return;
    }

    let cancelled = false;

    const handleCredential = async (res: GoogleCredentialResponse) => {
      if (!res.credential) {
        onError?.('No se recibió la credencial de Google');
        return;
      }
      try {
        const r = await fetch(`${BASE_URL}/api/auth/google`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ credential: res.credential }),
        });
        const json = await r.json();
        if (!r.ok) {
          onError?.(json.error ?? 'No se pudo iniciar sesión con Google');
          return;
        }
        const user = json.data.user as AuthUser;
        auth.login(json.data.token, user);
        navigate(user.rol_id === 1 ? '/dashboard' : '/');
      } catch {
        onError?.('No se pudo conectar con el servidor');
      }
    };

    loadGsiScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: handleCredential,
        });
        const width = Math.min(containerRef.current.offsetWidth || 320, 400);
        window.google.accounts.id.renderButton(containerRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text,
          shape: 'pill',
          logo_alignment: 'center',
          width,
        });
      })
      .catch(() => {
        if (!cancelled) setUnavailable(true);
      });

    return () => { cancelled = true; };
  }, [auth, navigate, onError, text]);

  if (unavailable) return null;

  // Contenedor centrado donde Google inyecta su botón oficial.
  return <div ref={containerRef} className="flex w-full justify-center [&>div]:!w-full" />;
}
