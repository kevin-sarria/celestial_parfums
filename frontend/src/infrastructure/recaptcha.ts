const SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string;
const SCRIPT_ID = 'recaptcha-script';

declare global {
  interface Window {
    grecaptcha: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

function loadScript(): void {
  if (document.getElementById(SCRIPT_ID)) return;
  const script = document.createElement('script');
  script.id = SCRIPT_ID;
  script.src = `https://www.google.com/recaptcha/api.js?render=${SITE_KEY}`;
  script.async = true;
  document.head.appendChild(script);
}

function waitForRecaptcha(timeout = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.grecaptcha?.ready) {
      resolve();
      return;
    }
    const start = Date.now();
    const interval = setInterval(() => {
      if (window.grecaptcha?.ready) {
        clearInterval(interval);
        resolve();
      } else if (Date.now() - start > timeout) {
        clearInterval(interval);
        reject(new Error('reCAPTCHA no cargado'));
      }
    }, 100);
  });
}

export function showRecaptchaBadge(): void {
  loadScript();
  const badge = document.querySelector('.grecaptcha-badge') as HTMLElement | null;
  if (badge) badge.style.visibility = 'visible';
}

export function hideRecaptchaBadge(): void {
  const badge = document.querySelector('.grecaptcha-badge') as HTMLElement | null;
  if (badge) badge.style.visibility = 'hidden';
}

export async function executeRecaptcha(action: string): Promise<string> {
  loadScript();
  await waitForRecaptcha();
  return new Promise((resolve, reject) => {
    window.grecaptcha.ready(async () => {
      try {
        const token = await window.grecaptcha.execute(SITE_KEY, { action });
        resolve(token);
      } catch (err) {
        reject(err);
      }
    });
  });
}
