import { getToken } from '@/services/auth';

const configuredBaseUrl = (import.meta.env.VITE_RIGO_API_URL ?? '').replace(/\/$/, '');

function resolveApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : '/' + path;
  if (configuredBaseUrl.endsWith('/api') && normalizedPath.startsWith('/api/')) {
    return configuredBaseUrl + normalizedPath.slice(4);
  }
  return configuredBaseUrl + normalizedPath;
}

/** Resolves backend-served assets such as local PDFs when Vercel hosts the UI separately. */
export function resolveBackendUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith('/') ? path : '/' + path;
  const backendBase = configuredBaseUrl.endsWith('/api') ? configuredBaseUrl.slice(0, -4) : configuredBaseUrl;
  return backendBase + normalizedPath;
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set('Authorization', 'Bearer ' + token);
  return fetch(resolveApiUrl(path), { ...init, headers });
}
