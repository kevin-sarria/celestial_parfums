export const BASE_URL = 'http://localhost:4000';

export const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

/** Fetch with Bearer token automatically injected from localStorage. */
export function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = localStorage.getItem('token');
  const headers = new Headers(init?.headers);
  if (!headers.has('Content-Type') && !(init?.body instanceof FormData))
    headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}
