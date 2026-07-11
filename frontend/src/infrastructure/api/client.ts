export const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

/** Fetch with credentials (httpOnly cookies) automatically included. */
export function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (!headers.has('Content-Type') && !(init?.body instanceof FormData))
    headers.set('Content-Type', 'application/json');
  return fetch(input, { ...init, headers, credentials: 'include' });
}

/** Attempt to refresh the access token using the httpOnly refresh cookie. */
export async function refreshAccessToken(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** authFetch with automatic retry on 401 (tries refresh once). */
export async function authFetchWithRefresh(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await authFetch(input, init);
  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return authFetch(input, init);
    }
  }
  return res;
}
