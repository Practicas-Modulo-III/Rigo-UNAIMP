import { useSyncExternalStore } from 'react';

/**
 * Token de sesión en memoria (no persiste en sessionStorage/localStorage):
 * se pierde al recargar la página o cerrar la pestaña, así que cada vez
 * que se quiera entrar al panel admin hay que volver a iniciar sesión.
 */
let currentToken: string | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function getToken(): string | null {
  return currentToken;
}

export function setToken(token: string | null): void {
  currentToken = token;
  notify();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAuthToken(): string | null {
  return useSyncExternalStore(subscribe, getToken);
}
